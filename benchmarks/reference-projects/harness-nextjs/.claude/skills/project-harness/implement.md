---
name: project-implement
description: Task-type-adaptive implementation + testing pipeline. Config-driven workers based on project-config.yaml flags. Supports feature/bugfix/refactor/config types.
---

# project-implement (Implement + Test)

## Overview

`/project-implement "task description"` performs **implementation + testing** appropriate to the task type.
Automatically selects a different pipeline for feature/bugfix/refactor/config types.

All workers and conditional checks are driven by `project-config.yaml` flags — no hardcoded technology assumptions.

## Usage

```
/project-implement "task description"                  — auto-invoke project-plan then implement
/project-implement --skip-plan "specific instructions" — skip plan, implement directly
/project-implement --type bugfix "desc"                — specify type directly
/project-implement --no-team "desc"                    — team disabled (sequential mode)
```

### Harness integration options

```
/project-implement --team-name <name> "desc"                    — join existing team
/project-implement --plan-result <result-file-path> --config <JSON> "desc"  — reference project-plan result directly
```

---

## Pre-requisites

### Obtain PlanResult

- When `--plan-result` is passed → Read from that file path (e.g., `state/results/plan.json`)
- When `--skip-plan` → implement from task description only (classification done internally)
- When neither specified → internally invoke project-plan skill (classify → explore → design → confirm)

### Obtain DebugResult (bugfix only)

- When `--debug-result` is passed → Read from that file path (e.g., `state/results/debug.json`)
- When debug was skipped → DebugResult either missing or `{ "skipped": true }` — proceed normally
- When DebugResult contains confirmed root cause:
  - Inject `root_cause`, `affected_files`, and `recommended_fix` into fixer worker prompt
  - Inject `impact.same_pattern_locations` into test-writer worker prompt (test all affected locations)
  - Skip hypothesis exploration in fixer — go directly to implementing the fix

### Check Classification

Extract type, has_ui, has_backend, has_database, has_auth, has_realtime, debug_complexity, and any config-defined domain flags from PlanResult to determine worker composition.

---

## feature type

### Single mode (`--no-team`)

```
Step 0 (when has_ui): Load UI/design system reference from config guides

Step 1: Scaffold boilerplate from project structure patterns
  - Use module/component scaffold based on config.tech_stack.architecture
  - Follow project conventions discovered in exploration

Step 2: TDD implementation (core logic)
  - Write failing tests first
  - Implement until tests pass

Step 3: Integration code (not covered by scaffold/TDD)
  - Module wiring, routing connections, provider setup

Step 3.5 (when has_ui): Self-validation based on UI checklist from config guides

Step 4 (when has_backend): Backend security guide validation from config guides
  BLOCK: fix → re-validate (max 2 times)

Step 5 (common build gate):
  1. {config.commands.typecheck}
  2. {config.commands.lint}   (if fail: auto-fix attempt → re-validate)
  3. {config.commands.build}
  4. If fail: auto-fix loop (max 5 attempts)
```

### Team mode (default)

**Team Stage**: team-exec

1. If no `--team-name`: TeamCreate: `project-implement-{slug}`
2. Update state/pipeline-state.json: set current_phase="team-exec"
3. TaskCreate + spawn workers — **하이브리드**: 독립 워커는 단일 메시지 내 parallel spawn, 의존 체인은 blockedBy 로 연결.

### PARALLEL vs CHAIN — 워커별 blockedBy 규약

**병렬 시작 (blockedBy: [] — 서로 독립, 한 메시지에서 동시 spawn)**:

- `scaffolder` — 디렉터리 구조 생성. 입력: plan 결과만
- `test-writer` — acceptance criteria 기반 테스트 작성. 구현 결과 불필요 (TDD 전략에서는 Red 단계)
- `security-checker` (has_security_surface) — 정적 보안 분석. 독립
- `ui-checker` (has_ui) — UI 코드 정적 리뷰. 독립 (구현 파일 탐지는 `git status` 로)

→ 4 개 워커를 **단일 메시지 내 4 개 Task tool-use 블록으로 동시 spawn**. wall-time 75% 감소.

**체인 실행 (blockedBy 로 의존 명시)**:

- `implementer` — `blockedBy: [scaffolder-task-id]`. 스캐폴드된 파일에 실제 로직 작성
- `integrator` — `blockedBy: [implementer-task-id]`. 주변 코드 통합, 라우팅, provider
- `test-runner` — `blockedBy: [implementer, test-writer]`. 구현 + 테스트 둘 다 필요
- `build-checker` — `blockedBy: [implementer]`. 최종 typecheck/lint/build

### 예시 — 올바른 병렬 spawn

```js
// 단일 메시지에 4 개 Task 동시 호출 (모두 blockedBy: []):
[
  Task({ subagent_type: "general-purpose",
         description: "scaffolder",
         prompt: "<디렉터리 구조 + 파일 boilerplate 생성>" }),
  Task({ subagent_type: "general-purpose",
         description: "test-writer",
         prompt: "<acceptance criteria 기반 실패 테스트>" }),
  Task({ subagent_type: "security-engineer",
         description: "security-checker",
         prompt: "<인증/secret/DB 쿼리 정적 분석>" }),
  Task({ subagent_type: "general-purpose",
         description: "ui-checker",
         prompt: "<ui-defect-patterns 8개 패턴 정적 검사>" })
]
// → 4 개 동시 실행. 완료 후 체인 워커 spawn (implementer, integrator, ...)
```

**금지된 순차 spawn** (wall-time 4배 증가):
```
Task(scaffolder) → 대기 → Task(test-writer) → 대기 → Task(security-checker) → 대기 → Task(ui-checker)
```

자세한 병렬 규약은 `references/parallel-execution.md` §"blockedBy 규약" 참조.


**Fixed workers**:

| Order | Role | subagent_type | Responsibility | Condition |
|-------|------|--------------|---------------|-----------|
| 1 | scaffolder | general-purpose | Scaffold boilerplate from project patterns + config architecture | fixed |
| 2 | implementer | general-purpose | TDD core logic implementation | fixed |
| 3 | integrator | general-purpose | Module wiring, routing, providers | fixed |
| N | build-checker | Agent (model="sonnet", description="Verification") | typecheck + lint + build | fixed |
| N+1 | test-writer | Agent (model="sonnet", description="Test engineering") | Generate tests based on config test_strategy | fixed |
| N+2 | test-runner | Agent (model="sonnet", description="Verification") | Run tests + self-fix | fixed |

**Conditional workers (from config flags)**:

{{CONDITION:has_ui}}
| Condition | Order | Role | subagent_type | Responsibility |
|-----------|-------|------|--------------|---------------|
| has_ui | after implementer | ux-checker | Agent (model="sonnet", description="UI/UX design") | UI review + fixes based on config UI guidelines |
{{/CONDITION:has_ui}}

{{CONDITION:has_backend}}
| has_backend | after integrator | security-checker | security-engineer | Backend security validation based on config security guides |
{{/CONDITION:has_backend}}

{{CONDITION:has_database}}
| has_database | after integrator | db-checker | general-purpose | Schema validation, migration safety, query patterns |
{{/CONDITION:has_database}}

{{CONDITION:has_auth}}
| has_auth | after security-checker | auth-checker | security-engineer | Auth flow correctness, permission boundary validation |
{{/CONDITION:has_auth}}

{{CONDITION:has_realtime}}
| has_realtime | after integrator | realtime-checker | general-purpose | WebSocket/SSE event integrity, connection lifecycle |
{{/CONDITION:has_realtime}}

{{AGENTS_LIST}}

**Execution order example (all flags active)**:

```
scaffolder → implementer → ux-checker (has_ui) → integrator → db-checker (has_database)
  → security-checker (has_backend) → auth-checker (has_auth)
  → realtime-checker (has_realtime) → [config agent workers]
  → build-checker → test-writer → test-runner
```

4. Write handoff: `state/handoffs/exec.md`

---

## bugfix type

### Single mode (`--no-team`)

```
Step 0 (new): Load DebugResult if available (--debug-result)
Step 1: Write reproduction test
  - When DebugResult available: use reproduction.command and reproduction.error_message as test basis
  - When DebugResult has impact locations: write tests for ALL affected locations
  - When no DebugResult: write failing test from task description
Step 2: Fix bug
  - When DebugResult.root_cause.confirmed: apply recommended_fix directly (skip investigation)
  - When DebugResult not confirmed: use hypotheses as investigation guide
  - When no DebugResult: standard Read → investigate → Edit
Step 2.5 (when DebugResult has impact locations): Fix same bug pattern at all impact.same_pattern_locations
Step 3: Verify test passes ({config.commands.test})
Step 4 (when has_backend): Security guide validation from config
Step 5 (common build gate)
```

### Team mode (default)

| Order | Role | subagent_type | Responsibility |
|-------|------|--------------|---------------|
| 1 | test-writer | Agent (model="sonnet", description="Test engineering") | Write reproduction test + tests for impact locations |
| 2 | fixer | general-purpose | Fix bug guided by DebugResult.root_cause + recommended_fix |
| 2.5 | impact-fixer | general-purpose | Fix same pattern at DebugResult.impact.same_pattern_locations (only when DebugResult has impact data) |
| 3 | test-runner | Agent (model="sonnet", description="Verification") | Run full test suite |
| 4 | build-checker | Agent (model="sonnet", description="Verification") | typecheck + build |

```
When DebugResult available:
  test-writer (with impact data) → fixer (with root_cause) → impact-fixer → test-runner → build-checker

When no DebugResult:
  test-writer → fixer → test-runner → build-checker
```

---

## refactor type (no team — internal 3-agent self-managed)

```
Step 1: Analyze refactor target
  - Identify files exceeding size/complexity thresholds
  - Plan split/extract strategy

Step 2: Execute refactoring
  - Split large files/components
  - Extract reusable logic
  - Update import paths

Step 3 (when has_backend): Security guide validation from config

Step 4 (common build gate)
```

---

## config type (no team — simple sequential)

```
Step 1: Direct modification (Read → Edit, install if needed)

Step 2: Build verification ({config.commands.typecheck} + {config.commands.build})

Step 3 (when has_backend): Security guide validation from config
```

---

## tsc/lint Auto-fix Loop

Common to all types:

```
loop (attempt = 1..5):
  1. {config.commands.typecheck} 2>&1
  2. {config.commands.lint} 2>&1
     (if lint errors: try auto-fix command first → re-validate)
  3. Analyze error messages
  4. Read affected file → Edit to fix
  5. if errors == 0: break
  6. else: continue

After 5 attempts: report to user
```

---

## Final Completion Output

Display summary of worker completion status, test results, and build status.

---

## Output (ImplementationResult)

Written to `state/results/implement.json` | Handoff: `state/handoffs/exec.md`

```json
{
  "type": "feature",
  "files_created": ["path1", "path2"],
  "files_modified": ["path3"],
  "test_results": { "passed": 0, "failed": 0 },
  "build_status": "success",
  "lint_status": "success",
  "typecheck_status": "success",
  "security_gate": "pass|warn|n/a",
  "agent_reviews": {}
}
```

---

## Team Cleanup

### Standalone invocation

- Called without `--team-name` → self-TeamCreate → TeamDelete on completion
- `--no-team` → sequential execution without team

### Called by project-harness

- `--team-name <name>` → use existing team, do NOT TeamDelete

---

## Guide + Checklist Auto-reference

When generating worker prompts, conditionally inject guide files from the project's `.claude/guides/` directory.
The `guides` list in `project-config.yaml` determines which guides are loaded and when.

{{GUIDES_LIST}}

---

## Learning Loop (after bugfix completion)

After bugfix implementation, automatically suggest guide improvements and enforcement rules to prevent recurrence.

### Procedure

1. **Classify root cause**: Determine category and which guide file applies
   - UI defect → UI guidelines guide
   - Architecture violation → architecture guide
   - Security issue → security guide
   - Other → global rules guide
   - Categories: PATTERN_VIOLATION, UNSAFE_OPERATION, CONVENTION_BREAK, TYPE_ERROR, SECURITY_ISSUE, LOGIC_ERROR

2. **Draft guide note**: Write a `> ⚠️ Note:` block for recurrence prevention

3. **Analyze for hook potential** (when `self_learning.enabled` is true):
   - Can this mistake be detected automatically by a shell command or regex?
   - Is there a file path pattern that narrows the scope?
   - Would a PreToolUse hook prevent it, or PostToolUse catch it?
   - If auto-detectable → draft a hook rule (name, event, matcher, check command, message)
   - If LOGIC_ERROR → guide note only (no hook)

4. **Request user approval**:
```
AskUserQuestion:
  question: "A bug was fixed. To prevent recurrence:"
  header: "Learning Loop"
  options:
    - "Add guide note + hook rule" → both (only shown when hook rule was drafted)
    - "Add guide note only" → append to guide's Notes section
    - "Add hook rule only" → add to hook Custom Rules section (only shown when hook rule was drafted)
    - "Skip" → do not learn from this fix
```

5. **Apply approved changes**:
   - **Guide note format**:
   ```markdown
   > ⚠️ **[date]** concise title
   > Detailed description + resolution
   ```
   - **Hook rule**: Append to the target hook script's Custom Rules section:
   ```bash
   # [LEARNED {date}] {name}
   # Root cause: {description}
   {check_logic}
   ```
   - **Learning log**: Append entry to `state/learning-log.yaml` with date, type, root_cause, category, prevention, approved_by

---

## Implementation Strategy Switch

project-implement 의 실행 순서는 `project-config.yaml.pipeline.implement_strategy` 에 따라 결정:

| Strategy | Worker 순서 | 로드 reference |
|---|---|---|
| `standard` (default) | scaffolder → implementer → integrator → ui-checker (has_ui) → test-writer → test-runner → build-checker | 없음 |
| `tdd` | test-writer (Red) → implementer (Green) → refactorer → ui-checker (has_ui) → test-runner → build-checker | `references/tdd-implementation.md` |
| `bdd` | 예약 — 현재는 standard 와 동일 + 경고 출력 | 없음 |

### 분기 처리 (wizard 렌더링)

`{{CONDITION:implement_strategy_tdd}} ... {{/CONDITION:implement_strategy_tdd}}` 블록이 Step 5.2 에서:
- `implement_strategy == "tdd"` → 블록 **포함**, standard 블록 제거
- 그 외 → 블록 제거, standard 유지

### `{{CONDITION:implement_strategy_tdd}}` 블록 내용

- test-writer 가 Phase 4 가장 먼저 실행 (Red — 실패 테스트 작성)
- implementer 는 테스트 통과용 최소 구현만 (Green)
- refactorer 워커가 integrator 대신 스폰 (Refactor — 중복 제거 + 네이밍)
- test-runner 는 Refactor 후 최종 실행
- 전체 사이클은 `references/tdd-implementation.md` Red-Green-Refactor 명세 준수
- `state/results/implement.json` 에 `tdd_cycle` optional 필드 기록 (schemas.md 확장)

### 안전장치 / Fallback

- `pipeline.implement_strategy` 필드 누락 → **standard** 로 fallback (wizard 가 자동 기록하지만 사용자가 수동으로 제거 시 대비)
- `references/tdd-implementation.md` 파일 부재 → "strategy=tdd 지정됐지만 reference 파일 없음. standard 로 fallback" 경고 + 실행

### 세션별 오버라이드

`/project-harness "..." --strategy tdd` 또는 `/project-implement --strategy tdd "..."` 로 config 값 우회. 해당 세션 한정.
