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
2. state_write: mode="team", current_phase="team-verify"
3. TaskCreate + spawn workers:

**Fixed workers (4)**:

| Role | subagent_type | Responsibility |
|------|--------------|---------------|
| arch-auditor | oh-my-claudecode:architect | Architecture audit (layer violations, circular deps, size limits). Inject architecture checklist from config. |
| code-reviewer | oh-my-claudecode:code-reviewer | AI code review (logic bugs, type safety, anti-patterns). Inject coding standards from config. |
| type-linter | oh-my-claudecode:verifier | `{config.commands.typecheck} && {config.commands.lint}` |
| deploy-validator | oh-my-claudecode:verifier | Build verification + deployment impact analysis (`{config.commands.build}`) |

**Conditional workers (from config flags)**:

{{CONDITION:has_ui}}
| Condition | Role | subagent_type | Responsibility |
|-----------|------|--------------|---------------|
| has_ui | ux-reviewer | oh-my-claudecode:designer | UX checklist static analysis (overflow, spacing, alignment) |
| has_ui | design-reviewer | oh-my-claudecode:designer | Design system/token compliance review |
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
| has_realtime | realtime-auditor | oh-my-claudecode:code-reviewer | WebSocket/SSE event correctness, connection leak detection |
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

**Notepad keys for intermediate results**:

```
project-verify-arch              # architecture audit result
project-verify-review            # code review result
project-verify-typelint          # typecheck/lint result
project-verify-deploy            # deployment impact analysis result
project-verify-ux                # UX checklist result (has_ui)
project-verify-design            # design review result (has_ui)
project-verify-backend           # backend security result (has_backend)
project-verify-database          # database audit result (has_database)
project-verify-auth              # auth audit result (has_auth)
project-verify-realtime          # realtime audit result (has_realtime)
project-verify-agent-{name}      # per config-agent results
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
  1. state_write: current_phase="team-fix"
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

Saved to notepad key: `project-verify-result` | Handoff: `.omc/handoffs/team-verify.md`

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

When a fix was applied during regression loop, automatically suggest guide improvements.
Same procedure as project-implement:

1. Classify root cause → determine relevant guide
2. Draft recurrence-prevention note
3. AskUserQuestion for user approval
4. On approval: append to guide's `## Notes (Learned Lessons)` section
