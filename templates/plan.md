---
name: project-plan
description: Classification→exploration→design→user-confirmation pre-work pipeline. Config-driven workers based on project-config.yaml flags.
---

# project-plan (Classify + Explore + Design + Confirm)

## Overview

`/project-plan "task description"` performs **classify→explore→design→user confirmation** in a single flow.
Handles all analysis and design needed before touching code.

All workers and conditional logic are driven by `project-config.yaml` flags — no hardcoded technology assumptions.

## Usage

```
/project-plan "task description"                  — auto-classify + full pre-work
/project-plan --type feature "desc"               — specify type directly (feature|bugfix|refactor|config)
/project-plan --dry-run "desc"                    — design only (no confirmation gate)
/project-plan --no-team "desc"                    — team disabled (sequential mode)
```

### Harness integration options

```
/project-plan --team-name <name> --config <JSON> "desc"   — join existing team (called by project-harness)
/project-plan --interview-result <result-file-path> "desc"  — inject interview result
```

---

## Interview Result Integration

When `--interview-result` is provided:

1. Read InterviewResult JSON from the specified file path
2. Read PRD from `.claude/skills/project-harness/prd/service-prd.md`
3. Inject PRD content into worker prompts at each phase:
   - **structure-explorer**: PRD's data model + feature list for targeted exploration
   - **dependency-explorer**: PRD's integrations for dependency scope awareness
   - **pattern-explorer**: PRD's feature specs for pattern matching
   - **architect**: Full PRD for design alignment with service requirements
   - **ui-designer**: PRD's user flows + feature specs for UX design
4. Include interview-created agents (from InterviewResult.agents_created) as conditional workers in exploration and design phases
5. Use PRD's clarity breakdown to focus exploration on lower-clarity areas

**Note**: Interview result enhances but does not replace classification. Type and flags are still auto-detected or specified via `--type`.

---

## Step 1: Classification (Phase 0)

Analyze the task description to determine type and flags.
Classification rules: read `.claude/skills/project-harness/references/classification.md`.

- If `--type` is specified, skip auto-classification.
- Classification output: type, plus all flags defined in `project-config.yaml` flags section.
  - Standard flags: `has_ui`, `has_backend`, `has_database`, `has_cache`, `has_auth`, `has_realtime`
  - Extended flags: any additional flags in `project-config.yaml` that match detected patterns

**Classification output format:**

```
🏷️ Classification complete
   → type: feature | has_ui: true | has_backend: true | has_database: true
   → has_auth: true | has_realtime: false | visual_qa_capable: true
```

---

## Step 2: Exploration (Phase 1)

Explore the codebase to gather context needed for the task.

### Single mode (`--no-team`)

1. **Explore agent** (Agent tool, subagent_type: "Explore") for codebase exploration:
   - Collect related files/modules
   - Identify existing patterns and conventions
   - Check dependency graph
   - Verify package integrity (`npm ls 2>&1 | grep -E "missing|WARN|ERR"` or equivalent)
   - If missing packages found: auto-run install command from config + re-verify

2. Task-type additional analysis:
   - **feature**: Locate insertion point in project structure, check related modules
   - **bugfix**: Trace error reproduction path, check related tests
   - **refactor**: Measure file size/complexity, determine impact scope
   - **config**: List current config files, check dependency tree

### Team mode (default)

**Team Stage**: team-plan

1. If no `--team-name`: TeamCreate: `project-plan-{slug}`
2. Update state/pipeline-state.json: set current_phase="team-plan"
3. TaskCreate × 3 fixed workers:

**Fixed workers (3)**:

| Role | subagent_type | Responsibility |
|------|--------------|---------------|
| structure-explorer | Explore | Project directory structure, file listing, architecture layout |
| dependency-explorer | Explore | import/export dependency graph, impact scope + package integrity check |
| pattern-explorer | Explore | Existing patterns/conventions, similar implementation references |

**Conditional workers (from config flags)**:

{{CONDITION:has_ui}}
| Condition | Role | subagent_type | Responsibility |
|-----------|------|--------------|---------------|
| has_ui | ui-explorer | Explore | UI component tree, design system usage, layout patterns |
{{/CONDITION:has_ui}}

{{CONDITION:has_backend}}
| has_backend | backend-explorer | Explore | API routes, service layer patterns, request/response conventions |
{{/CONDITION:has_backend}}

{{CONDITION:has_database}}
| has_database | schema-explorer | Explore | Database schema, migration history, query patterns |
{{/CONDITION:has_database}}

{{CONDITION:has_auth}}
| has_auth | auth-explorer | Explore | Authentication flow, permission model, session handling |
{{/CONDITION:has_auth}}

{{CONDITION:has_realtime}}
| has_realtime | realtime-explorer | Explore | WebSocket/SSE event patterns, connection lifecycle, message schemas |
{{/CONDITION:has_realtime}}

{{AGENTS_LIST}}

```
[leader] ─┬─ structure-explorer    ─┐
           ├─ dependency-explorer    ─┤
           ├─ pattern-explorer       ─┤
           ├─ [conditional workers]  ─┼─ [leader aggregates]
           └─ [config agent workers] ─┘
```

4. Leader aggregates results → Write to `state/results/plan-phase1.json`
5. Write handoff: `state/handoffs/plan.md`

On completion, output worker results status, related files, and impact scope.

---

## Step 3: Design (Phase 2)

Formulate an implementation plan based on exploration results.

### Single mode (`--no-team`)

1. **Plan agent** (Agent tool, subagent_type: "Plan") for implementation plan:
   - Files to create/modify
   - Task order and dependencies
   - Estimated change scope

2. Task-type design patterns:
   - **feature**: Module structure design, component tree, state management strategy
   - **bugfix**: Fix point + regression test design
   - **refactor**: Split strategy, new module structure, import path mapping
   - **config**: Change item list, build impact analysis

3. **If has_ui**: derive design direction from config's UI guidelines

4. Validate design feasibility with pre-check review

### Team mode (default)

**Team Stage**: team-prd (transition from team-plan)

1. Update state/pipeline-state.json: set current_phase="team-prd"
2. TaskCreate × 1–3 workers:

**Fixed workers**:

| Role | subagent_type | Responsibility |
|------|--------------|---------------|
| architect | Plan | Technical implementation plan. Inject architecture checklist from config agents. |

**Conditional workers**:

{{CONDITION:has_ui}}
| Condition | Role | subagent_type | Responsibility |
|-----------|------|--------------|---------------|
| has_ui | ux-designer | Agent (model="sonnet", description="UI/UX design") | UI/UX design — spacing strategy, layout direction, overflow prevention |
{{/CONDITION:has_ui}}

{{AGENTS_LIST}}

```
[leader] ─┬─ architect (Plan)         ─┐
           ├─ ux-designer (designer)   ─┤  ← only when has_ui
           └─ [config agents]          ─┼─ [leader aggregates → unified design]
                                          ← based on config flags
```

3. Each agent saves results to `state/results/`:
   - `state/results/plan-phase2-arch.json`: technical implementation plan
   - `state/results/plan-phase2-ux.json`: UI/UX design direction (when has_ui)
4. Leader aggregates results → Write to `state/results/plan-phase2.json`
5. Write handoff: `state/handoffs/prd.md`

On completion, output worker results, implementation plan (file list/order), and UI/UX design direction (when has_ui).

### `--dry-run` exits here

If dry-run option, output design and terminate pipeline.

---

## Step 4: User Confirmation Gate (Phase 3)

**Must use AskUserQuestion to get user approval. Auto-proceed is forbidden.**

### Confirmation content

```
AskUserQuestion:
  question: "Proceed with the implementation plan above?"
  options:
    - label: "Proceed"
      description: "Start implementation according to the plan"
    - label: "Revise then proceed"
      description: "Modify the plan before proceeding"
    - label: "Cancel"
      description: "Stop the pipeline"
```

### Response handling

- **"Proceed"**: return PlanResult (so project-implement can take over)
- **"Revise then proceed"**: apply user feedback → re-run Step 3 → re-display Step 4
- **"Cancel"**: save pipeline state and exit

On final completion, output 4-phase status summary.

---

## Output (PlanResult)

Written to `state/results/plan.json` | Handoff: `state/handoffs/prd.md`

```json
{
  "classification": {
    "type": "feature|bugfix|refactor|config",
    "has_ui": true,
    "has_backend": true,
    "has_database": false,
    "has_cache": false,
    "has_auth": true,
    "has_realtime": false,
    "visual_qa_capable": true
  },
  "exploration": {
    "related_files": ["path1", "path2"],
    "impact_scope": ["module-a", "module-b"],
    "existing_patterns": "pattern summary",
    "warnings": []
  },
  "design": {
    "files_to_create": [],
    "files_to_modify": [],
    "task_order": [],
    "ux_design": {}
  },
  "user_approved": true
}
```

---

## Team Cleanup

### Standalone invocation

- Called without `--team-name` → self-TeamCreate → TeamDelete on completion
- `--no-team` → sequential execution without team

### Called by project-harness

- `--team-name <name>` → use existing team, do NOT TeamDelete (project-harness manages it)

---

## Guide + Checklist Auto-reference

When generating worker prompts, conditionally inject guide files from the project's `.claude/guides/` directory.
The `guides` list in `project-config.yaml` determines which guides are available and their load conditions.

자세한 워커별 가이드/에이전트 주입 매핑은 `references/guide-injection.md` 참조.

{{GUIDES_LIST}}

---

## Reader / Fan-in Pattern (Phase 1 + Phase 2)

team 모드에서 **여러 워커가 병렬 실행** 후 결과를 한 곳에 수집하는 패턴.
`schemas.md` 의 PlanResult 에 통합된 형태로 쓰이기 전에 reader 워커가 취합 단계를 거침.

### PARALLEL REQUIRED — 단일 메시지 내 동시 spawn

**CRITICAL**: Phase 1 / Phase 2 의 fan-out 워커들은 **단일 assistant 메시지 내 여러 Task tool-use 블록으로 동시에 spawn**. 순차 호출 금지 — 3 워커 기준 wall-time 이 3배 증가.

```js
// ✅ 올바른 형태 (Phase 1 — single message, 3-4 parallel Task calls):
[
  Task({ subagent_type: "Explore",
         description: "structure-explorer",
         prompt: "<프로젝트 구조 탐색 — FSD 레이어 / 모듈 배치 / 파일 목록>" }),
  Task({ subagent_type: "Explore",
         description: "dependency-explorer",
         prompt: "<import/export 그래프 + npm/pip 패키지 영향>" }),
  Task({ subagent_type: "Explore",
         description: "pattern-explorer",
         prompt: "<기존 패턴/컨벤션 수집>" })
  // + 조건부 도메인 워커 (활성 플래그 시)
]
// → 3개 이상 Task 동시 실행. wall-time ≈ max(탐색 시간) + reader merge

// ❌ 금지된 형태 (sequential — 보수적 Claude 가 자주 하는 실수):
// Task(structure) → 완료 대기 → Task(dependency) → 완료 대기 → Task(pattern)
// wall-time = sum(탐색 시간). 3배 느림.
```

**blockedBy 규약** (TaskCreate 호출 시):
- 모든 explorer / validator: `blockedBy: []` (독립 실행)
- reader 워커: `blockedBy: [structure-task-id, dependency-task-id, pattern-task-id, ...domain-task-ids]` (전부 완료 후)

Reader 본체는 단일 tool call 로 각 결과 `TaskGet` 으로 읽어 merge. 자세한 규약은 `references/parallel-execution.md` 참조.

### Phase 1 — 분석 (Fan-out / Fan-in)

```
[ team-plan ]
     │
     ├─ Fan-out: 3 고정 워커 + 조건부 도메인 워커
     │     ├─ structure-explorer       → notepad: project-plan-phase1-structure
     │     ├─ dependency-explorer      → notepad: project-plan-phase1-deps
     │     ├─ pattern-explorer         → notepad: project-plan-phase1-patterns
     │     └─ {domain}-explorer (조건부) → notepad: project-plan-phase1-domain-{id}
     │
     └─ Fan-in: reader 워커
           ├─ 입력: 위 모든 notepad 키
           ├─ 처리: 결과 취합 + 충돌/중복 제거 + 우선순위 판정
           └─ 출력: notepad project-plan-phase1-merged
```

**reader 워커 책임** (명시적 책임 분리):

1. 각 explorer 결과를 읽어 **중복 파일 경로 병합**
2. dependency 그래프 + pattern 관찰을 교차 검증하여 **warnings 생성**
3. 도메인 워커 결과가 있으면 **설계 영향도 추가**
4. 최종 `project-plan-phase1-merged` notepad 에 PlanResult.exploration 포맷으로 저장

### Phase 2 — 설계 (Fan-out / Fan-in)

```
[ team-prd ]
     │
     ├─ Fan-out: architect + ui-designer (has_ui) + {domain}-validator (조건부)
     │     ├─ architect          → notepad: project-plan-phase2-arch
     │     ├─ ui-designer        → notepad: project-plan-phase2-ux      (has_ui)
     │     └─ {domain}-validator → notepad: project-plan-phase2-domain-{id}
     │
     └─ Fan-in: reader 워커
           ├─ 입력: 위 설계 notepad 들 + phase1-merged
           ├─ 처리: 설계 일관성 검증 (UI 설계와 architect 결정 충돌 없는지) + 도메인 제약 반영
           └─ 출력: notepad project-plan-phase2-merged + state/results/plan.json
```

### 왜 reader 가 필요한가

- **워커별 notepad 독립성** — 각 워커는 자신의 결과만 책임. 취합 로직을 워커마다 중복하지 않음
- **충돌 감지 단일 지점** — 서로 다른 워커 간 모순(예: pattern-explorer 가 관찰한 컨벤션 ≠ architect 의 제안) 을 reader 가 탐지
- **deterministic merge** — reader 로직이 한 곳에 있어 결과 재현성 보장
- **handoff 작성 간소화** — reader 가 최종 병합 결과만 `handoff-templates.md` 형식으로 직렬화

### reader 워커 구현 가이드

- reader 는 **team 의 일부 워커**로 스폰 (별도 skill 아님). 일반 워커와 동일한 interface
- **순수 로직**: 외부 I/O 최소. 입력 notepad 읽기 → 병합 → 출력 notepad 쓰기
- **경합 회피**: fan-out 워커들의 `TaskGet` 으로 완료 확인 후 실행. 타이밍 의존 X
- **에러 내성**: 한 fan-out 워커가 실패해도 부분 결과로 reader 진행. reader 결과에 "partial: true" 플래그 기록
- 세 명 이하 fan-out 은 reader 없이 architect 이 직접 취합해도 됨. 도메인 워커 포함으로 4+ 시 reader 필수

### project-config.yaml 설정

```yaml
pipeline:
  team_mode:
    fan_in_reader_threshold: 4  # 4명 이상 fan-out 시 reader 자동 스폰
    reader_partial_ok: true     # 일부 fan-out 실패해도 reader 진행
```

### 관련 참조 파일

- `references/progress-format.md` §"Phase 1 진행 중 (팀 모드)" — reader 진행 표시
- `references/guide-injection.md` — reader 는 주입 없이 순수 로직 (가이드/에이전트 미주입)
- `references/schemas.md` — reader 출력이 PlanResult.exploration / PlanResult.design 에 직접 매핑
