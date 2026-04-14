---
name: project-verify
description: Multi-agent parallel verification. Fixed workers cover arch/code-quality/type/deploy. Conditional workers from config agents list. Includes regression loop (max 2 attempts).
---

# project-verify (Multi-Agent Parallel Verification)

## Overview

`/project-verify` runs 4+ verification agents simultaneously using a Fan-out/Fan-in pattern.
Fixed workers always run; conditional workers are activated by config flags and the `agents` list in `project-config.yaml`.

## Usage

```
/project-verify                            — auto-verify based on git diff
/project-verify --scope src/features/auth/ — verify specific scope
/project-verify --full-audit               — force all verification items
/project-verify --no-team                  — team disabled (sequential mode)
/project-verify --focus arch,type,lint     — run only specific checks (comma-separated)
```

### Harness integration options

```
/project-verify --team-name <name>          — join existing team (called by project-harness)
/project-verify --classification <JSON>     — pass classification result directly
```

---

## Step 0: Pre-requisites

### Flag Determination

- When `--classification` is passed → use as-is
- When not passed → read classification rules and run classification:
  - Extract changed file list from git diff
  - Detect flags from file patterns/keywords: has_ui, has_backend, has_database, has_auth, has_realtime, etc.
- `--full-audit` → force-activate all conditional verification items
- `--focus <items>` → run only specified verifications

### Changed File List

- When `--scope` specified → files in that path
- When not specified → `git diff --name-only HEAD` result

---

## Step 1: Spawn Verification Agents

### Single mode (`--no-team`)

Run sequentially:
1. arch-audit skill
2. codex-review skill (or equivalent code review)
3. `{config.commands.typecheck} && {config.commands.lint}`
4. deploy-validator (build verification + impact analysis)
5. (when has_ui) UX checklist code review + design review
6. (when has_backend) Security guide validation from config
7. (when has_database) Database query/schema audit
8. (when has_auth) Auth boundary verification

### Team mode (default)

**Team Stage**: team-verify

1. If no `--team-name`: TeamCreate: `project-verify-{slug}`
2. Update state/pipeline-state.json: set current_phase="team-verify"
3. TaskCreate + spawn workers:

**Fixed workers (4)**:

| Role | subagent_type | Responsibility |
|------|--------------|---------------|
| arch-auditor | Agent (model="opus", description="Architecture audit") | Architecture audit (layer violations, circular deps, size limits). Inject architecture checklist from config. |
| code-reviewer | Agent (model="opus", description="Code review") | AI code review (logic bugs, type safety, anti-patterns). Inject coding standards from config. |
| type-linter | Agent (model="sonnet", description="Verification") | `{config.commands.typecheck} && {config.commands.lint}` |
| deploy-validator | Agent (model="sonnet", description="Verification") | Build verification + deployment impact analysis (`{config.commands.build}`) |

**Conditional workers (from config flags)**:

{{CONDITION:has_ui}}
| Condition | Role | subagent_type | Responsibility |
|-----------|------|--------------|---------------|
| has_ui | ux-reviewer | Agent (model="sonnet", description="UI/UX design") | UX checklist static analysis (overflow, spacing, alignment) |
| has_ui | design-reviewer | Agent (model="sonnet", description="UI/UX design") | Design system/token compliance review |
{{/CONDITION:has_ui}}

{{CONDITION:has_backend}}
| has_backend | backend-auditor | security-engineer | Backend security validation (injection, auth bypass, data exposure) based on config guides |
{{/CONDITION:has_backend}}

{{CONDITION:has_database}}
| has_database | db-auditor | general-purpose | Slow query detection, N+1 risks, migration safety |
{{/CONDITION:has_database}}

{{CONDITION:has_auth}}
| has_auth | auth-auditor | security-engineer | Auth flow integrity, permission boundary correctness, session security |
{{/CONDITION:has_auth}}

{{CONDITION:has_realtime}}
| has_realtime | realtime-auditor | Agent (model="opus", description="Code review") | WebSocket/SSE event correctness, connection leak detection |
{{/CONDITION:has_realtime}}

**Config agents workers**:

{{AGENTS_LIST}}

```
[leader] ─┬─ arch-auditor            ─┐
           ├─ code-reviewer            ─┤
           ├─ type-linter              ─┤
           ├─ deploy-validator         ─┤
           ├─ ux-reviewer              ─┤  ← has_ui only
           ├─ design-reviewer          ─┤  ← has_ui only
           ├─ backend-auditor          ─┤  ← has_backend only
           ├─ db-auditor               ─┤  ← has_database only
           ├─ auth-auditor             ─┤  ← has_auth only
           ├─ realtime-auditor         ─┤  ← has_realtime only
           └─ [config agent workers]   ─┘  ← from agents list in config
                                            [leader aggregates → unified report]
```

**Intermediate result files** (written to `state/results/`):

```
state/results/verify-arch.json              # architecture audit result
state/results/verify-review.json            # code review result
state/results/verify-typelint.json          # typecheck/lint result
state/results/verify-deploy.json            # deployment impact analysis result
state/results/verify-ux.json                # UX checklist result (has_ui)
state/results/verify-design.json            # design review result (has_ui)
state/results/verify-backend.json           # backend security result (has_backend)
state/results/verify-database.json          # database audit result (has_database)
state/results/verify-auth.json              # auth audit result (has_auth)
state/results/verify-realtime.json          # realtime audit result (has_realtime)
state/results/verify-agent-{name}.json      # per config-agent results
```

---

## Step 2: Aggregate Results + Report

Update progress as each worker completes. On full completion, output unified report.

**Unified report format**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 project-verify Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
arch-auditor      ✅ pass  (0 critical, 2 warnings)
code-reviewer     ✅ pass  (0 critical, 1 warning)
type-linter       ✅ pass
deploy-validator  ✅ pass
ux-reviewer       ✅ pass  (0 overflow, 0 spacing)    ← has_ui
design-reviewer   ✅ pass  (score: 92)               ← has_ui
backend-auditor   ✅ pass                             ← has_backend
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Overall: ✅ PASS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 3: Failure Handling & Regression

### Critical violation found (arch-auditor)

```
Regression loop (max 2 attempts):
  1. Update state/pipeline-state.json: set current_phase="team-fix"
  2. Spawn arch-fix worker → auto-fix
  3. After fix: re-run typecheck + build
  4. Re-verify (re-run Steps 1–2)
  5. After 2 attempts: report to user + guide manual fix
```

### deploy-validator / typecheck / lint failure

```
Auto-fix loop (max 5 attempts):
  1. If lint fails: try `{config.commands.lint} --fix` first → re-validate
  2. If auto-fix not possible: analyze error messages
  3. Spawn fix worker → fix affected files
  4. Re-run
  5. After 5 attempts: report to user
```

### has_backend security BLOCK

```
Regression loop (max 2 attempts):
  1. Spawn fix worker following security guide BLOCK item guidance
  2. Re-verify
  3. After 2 attempts: report to user
```

### Non-blocking warnings (no regression)

- **code-reviewer Critical**: Guide manual fix. No auto-fix.
- **design-reviewer warnings**: Report only. No pipeline block.
- **db-auditor WARN**: Warn about slow query/N+1 risk patterns. Only BLOCK items trigger regression.
- **Config agent WARN**: Report as checklist non-pass items.

### After all retries exceeded

Report failure items, attempt counts, and remaining issues to user. Guide manual fix.

---

## Output (VerificationResult)

Written to `state/results/verify.json` | Handoff: `state/handoffs/verify.md`

```json
{
  "arch_audit": { "critical": 0, "warning": 2, "info": 1 },
  "code_review": { "critical": 0, "warning": 1 },
  "typecheck": "pass",
  "lint": "pass",
  "deploy_validation": { "status": "pass", "build": "pass" },
  "ux_review": { "overflow": 0, "spacing": 0, "alignment": 0 },
  "design_review": { "score": 92, "critical": 0, "warning": 1 },
  "backend_security": { "status": "pass|n/a" },
  "database_audit": { "slow_query": 0, "migration_safe": true },
  "auth_audit": { "status": "pass|n/a" },
  "realtime_audit": { "status": "pass|n/a" },
  "agent_audits": {},
  "overall": "pass",
  "regression_needed": false
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
The `guides` list in `project-config.yaml` determines which guides are loaded for which workers.

{{GUIDES_LIST}}

---

## Learning Loop (after regression fix)

When a fix was applied during regression loop, automatically suggest guide improvements and enforcement rules.
Extended procedure (same as project-implement, with hook rule support):

1. **Classify root cause** → determine category (PATTERN_VIOLATION, UNSAFE_OPERATION, CONVENTION_BREAK, TYPE_ERROR, SECURITY_ISSUE, LOGIC_ERROR) and relevant guide
2. **Draft guide note** for recurrence prevention
3. **Analyze for hook potential** (when `self_learning.enabled` is true):
   - Can this be auto-detected by regex or shell command?
   - If yes → draft hook rule (name, event, matcher, check command, message)
   - If LOGIC_ERROR → guide note only
4. **AskUserQuestion** for user approval:
   - "Add guide note + hook rule" (when hook was drafted)
   - "Add guide note only"
   - "Add hook rule only" (when hook was drafted)
   - "Skip"
5. **Apply**: Append guide note, hook Custom Rules entry, and learning-log.yaml entry

---

## Failure Tiers (BLOCK / WARN / INFO)

검증 결과를 3 tier 로 분류. Tier 에 따라 regression loop 트리거 여부와 사용자 메시지 강도 결정.

### Tier 정의

| Tier | 아이콘 | 의미 | 회귀 루프 |
|------|-------|------|---------|
| **BLOCK** | ❌ | 배포/머지 차단 수준. 반드시 수정 필요 | 트리거 (최대 2회 자동 수정 시도) |
| **WARN** | ⚠️ | 주의 필요하지만 차단은 아님. 사용자 결정 | 트리거하지 않음 (report 만) |
| **INFO** | ℹ️ | 참고 사항 (convention 제안 등) | 무시 |

### Tier 매핑 — 체커별 기본 할당

| 체커 | 실패 시 tier | 근거 |
|------|------------|------|
| arch-audit | BLOCK (critical 위반), WARN (경고), INFO (개선 제안) | 레이어 위반은 구조적 부채 |
| code-review | BLOCK (기능 파괴), WARN (가독성/컨벤션), INFO (alternative) | LLM 판단 결과 심각도에 따라 |
| typecheck | BLOCK (error), INFO (deprecated 사용) | 타입 에러는 런타임 실패 직결 |
| lint | WARN (warning rule), BLOCK (error rule) | eslint/ruff 규칙별 설정 존중 |
| deploy-validation | BLOCK (destructive migration, env 누락) | 배포 중단 위험 |
| ux-review | BLOCK (overflow/clipping), WARN (spacing/alignment drift) | 사용자 가시성 영향에 따라 |
| design-review | WARN (토큰 미사용), INFO (alternative) | 차단이 아닌 방향 제시 |
| db-security | BLOCK (RLS 누락, N+1 production impact), WARN (인덱스 제안) | 데이터 유출/성능 위험 |
| auth-security | BLOCK (인증 우회 가능), WARN (세션 만료 정책) | 보안 게이트 |
| security-audit | BLOCK (HIGH), WARN (MEDIUM), INFO (LOW) | 취약점 심각도 |
| domain-{id}-audit | 도메인 agent 가 자체 판정 | 도메인별 룰 |

### 회귀 루프 트리거 조건

```
regression_needed = (BLOCK_count > 0) AND (regression_attempt < max_attempts)
```

- `max_attempts` = 2 (project-config.yaml.pipeline.regression_loop.max_attempts 로 설정 가능)
- `regression_attempt` 0 → 1 → 2 까지 시도. 2회 시도 후에도 BLOCK 남으면 `overall: fail` + 사용자 판단 요청
- WARN / INFO 만 있으면 `overall: pass_with_warnings` + 루프 없이 종료

### tier_breakdown 기록 (schemas.md VerificationResult)

```json
{
  "tier_breakdown": {
    "BLOCK": 0,
    "WARN": 3,
    "INFO": 1
  }
}
```

### 사용자 출력 예시 (ui-conventions.md 요약 포맷과 결합)

```
🔍 project-verify 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━
arch-audit:        ✅ BLOCK 0 | ⚠️ WARN 2 | ℹ️ INFO 1
code-review:       ✅ BLOCK 0 | ⚠️ WARN 1
...
━━━━━━━━━━━━━━━━━━━━━━━━━━━
종합: ⚠️ pass_with_warnings  (BLOCK 0 | WARN 3 | INFO 1)
회귀 필요: false
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 설계 원칙

1. **체커가 자체적으로 tier 결정** — verify.md 는 통합만. 각 agent/checker 가 자체 rubric 에 따라 BLOCK/WARN/INFO 분류 후 상위로 보고
2. **BLOCK 은 자동 수정 시도 트리거** — regression loop 에서 team-fix 워커 스폰
3. **WARN 은 report-only** — 사용자가 읽고 판단. `--fix-warnings` 플래그 시 수정 시도
4. **INFO 는 notepad 기록만** — 리포트에 요약 라인으로 표시, 상세는 notepad 에서 조회
5. **도메인별 tier 자유 재정의 가능** — domain agent 가 자신의 checklist 항목에 tier 할당. data/agents.yaml 의 agent metadata 에 기본 tier 필드 예약

---

## 관련 참조 파일

- `ui-conventions.md` — §"V4. 완료 요약" 에서 tier_breakdown 표시 규칙
- `schemas.md` — VerificationResult 의 `tier_breakdown` + `overall` 필드 계약
- `progress-format.md` — 진행 중 tier 별 집계 표시
- `handoff-templates.md` — verify.md handoff 에 tier 정보 전파
