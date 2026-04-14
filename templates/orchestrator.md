---
name: project-harness
description: {{DESCRIPTION}}
---

# {{PROJECT_NAME}} Harness

## Overview

`/project-harness "task description"` runs the full **classify→explore→design→[user confirm]→[debug]→implement→test→[visual QA]→verify** pipeline automatically.

Chains up to five sub-skills (`project-plan`, `project-debug`, `project-implement`, `project-visual-qa`, `project-verify`) in a sequential pipeline. All behavior is driven by the project's `project-config.yaml`.

## Usage

```
/project-harness "task description"           — auto-classify + full pipeline
/project-harness --type feature "desc"        — specify type directly (feature|bugfix|refactor|config)
/project-harness --resume                      — resume an interrupted pipeline
/project-harness --dry-run "desc"             — plan phase only (design preview)
/project-harness --no-team "desc"             — disable team (force sequential mode)
/project-harness --skip-qa "desc"             — skip visual QA even if has_ui (minor UI changes)
/project-harness --skip-debug "desc"          — skip debug phase for bugfix tasks
/project-harness --skip-verify "desc"         — skip verification (prototype/PoC)
/project-harness --verbose "desc"             — show internal worker status in detail
/project-harness --quiet "desc"               — show final result only
{{RUN_OPTIONS}}
```

### Mode Combinations

```
allowed: /project-harness ralph interview "task"     — interview → full + ralph validation
allowed: /project-harness autopilot "task"           — auto-approve all confirmation gates
```

### Monitor Subcommand (idle auto-watch)

```
/project-harness monitor                      — 프론트+백엔드 동시 감시 (기본)
/project-harness monitor --backend            — 백엔드 로그 + /health 만 감시
/project-harness monitor --frontend           — chrome-devtools MCP 브라우저 감시
/project-harness monitor --interval 2m        — 감시 간격 (기본 1분)
/project-harness monitor stop                 — 감시 종료 + 서버 종료
```

상세 동작 (CronCreate 기반 idle-mode 루프, 에러 감지 후 3-옵션 게이트 등) 은 `references/monitor-mode.md` 참조. Pipeline 과 독립 실행되며 다른 harness 작업과 동시 사용 가능.

---

## Pipeline Structure

```
/project-harness "task description"
  │
  ├─ Phase 0+1+2+3 ──→ Skill: project-plan
  │                      → PlanResult (classify + explore + design + user confirm)
  │
  ├─ Phase 3.5 ────→ Skill: project-debug  (only when type=bugfix AND debug_complexity != "low")
  │                      → DebugResult (reproduce + hypothesize + investigate + evidence)
  │
  ├─ Phase 4+5 ────→ Skill: project-implement
  │                      → ImplementationResult (implement + test)
  │
  ├─ Phase 6 ──────→ Skill: project-visual-qa  (only when has_ui)
  │                      → VisualQAResult (browser QA)
  │
  ├─ Phase 7 ──────→ Skill: project-verify
  │                      → VerificationResult (multi-agent verification)
  │
  ├─ Regression loop → when VerificationResult.regression_needed
  │                      → project-implement → project-visual-qa → project-verify re-run
  │
  └─ Cleanup ───────→ TeamDelete + remove state files
```

---

## Enforcement System

{{CONDITION:enforcement_active}}
Code enforcement is active at level **{{ENFORCEMENT_LEVEL}}**.

**Active Hooks:**
| Hook | Event | Purpose |
|------|-------|---------|
{{ENFORCEMENT_HOOKS_TABLE}}

Hook scripts are located in `.claude/skills/project-harness/hooks/`.
Hook configuration is in `.claude/skills/project-harness/hooks-config.json`.

**Self-Learning:** {{SELF_LEARNING_STATUS}}
When self-learning is enabled, the Learning Loop in implement and verify phases can propose
new hook rules based on regression patterns. Rules are appended to the "Custom Rules" section
of hook scripts and logged in `state/learning-log.yaml`.
{{/CONDITION:enforcement_active}}

{{CONDITION:enforcement_none}}
Enforcement is disabled. The harness operates in markdown-only mode (agents follow guidelines without code-level enforcement).
To enable enforcement, re-run the wizard or edit `enforcement.level` in project-config.yaml.
{{/CONDITION:enforcement_none}}

---

## CI/CD Pipelines

{{CONDITION:cicd_active}}
CI/CD platform: **{{CICD_PLATFORM}}**

**Generated Pipelines:**
{{CICD_PIPELINES_LIST}}

Workflow files are located in `.github/workflows/` (GitHub Actions) or `.gitlab-ci.yml` (GitLab CI).
{{/CONDITION:cicd_active}}

{{CONDITION:cicd_none}}
No CI/CD pipelines configured. To add CI/CD, re-run the wizard or manually create workflow files.
{{/CONDITION:cicd_none}}

---

## Execution Flow

### Step 0: Load project-config.yaml

```
1. Read: .claude/skills/project-harness/project-config.yaml
   - If missing → AskUserQuestion: "project-config.yaml not found. Run --init to create?"
2. Parse YAML → derive Classification JSON
   - Read classification rules from .claude/skills/project-harness/references/classification.md
3. Derive flags automatically:
   - has_ui, has_backend, has_database, has_cache, has_auth, has_realtime, visual_qa_capable
4. Write state/pipeline-state.json with:
   {
     "mode": "project-pipeline",
     "config_loaded": true,
     "classification": <Classification JSON>,
     "task_description": "<task description>"
   }
```

### Step 1: Team Creation

Unless `--no-team`, create a single team and maintain it across the entire pipeline.

```
TeamCreate: "project-harness-{slug}"
Write state/pipeline-state.json with:
{
  "mode": "pipeline",
  "linked_team": true,
  "team_name": "project-harness-{slug}",
  "task_description": "<task description>",
  "current_phase": "team-plan"
}
```

### Step 2: project-plan Invocation

```
Skill: project-plan
args: "--team-name project-harness-{slug} --config <Classification JSON> <task description>"
  (pass --type, --dry-run when user specifies them)
  (with --no-team: "--no-team --config <Classification JSON> <task description>")
```

**Output**: PlanResult (written to `state/results/plan.json`)
**State update**: Update `current_phase` to `"project-plan-done"` in `state/pipeline-state.json`

**`--dry-run` exits here.**

### Step 2.5: project-debug Invocation (Conditional)

Check `type` from Classification JSON. **Skip if**:
- type != "bugfix"
- OR `debug_complexity == "low"`
- OR `--skip-debug` flag is set

```
Skill: project-debug
args: "--team-name project-harness-{slug} --plan-result state/results/plan.json --config <Classification JSON> <task description>"
  (with --no-team: "--no-team --plan-result state/results/plan.json --config <Classification JSON> <task description>")
```

**Output**: DebugResult (written to `state/results/debug.json`)
**State update**: Update `current_phase` to `"project-debug-done"` in `state/pipeline-state.json`

**Note**: When `--skip-debug` is used on a `high` complexity bug, emit a warning:
`⚠️ Skipping debug phase on high-complexity bug. Fix may be less targeted.`

### Step 3: project-implement Invocation

```
Skill: project-implement
args: "--team-name project-harness-{slug} --plan-result state/results/plan.json --debug-result state/results/debug.json --config <Classification JSON> <task description>"
  (with --no-team: "--no-team --plan-result state/results/plan.json --debug-result state/results/debug.json --config <Classification JSON> <task description>")
  (when debug was skipped: omit --debug-result)
```

**Output**: ImplementationResult (written to `state/results/implement.json`)
**State update**: Update `current_phase` to `"project-implement-done"` in `state/pipeline-state.json`

### Step 4: project-visual-qa Invocation (Conditional)

Check `has_ui` from PlanResult. Skip if `has_ui: false` or `--skip-qa`.

```
Skill: project-visual-qa
args: "--classification <PlanResult.classification JSON> <target page paths>"
```

**Target page path determination**:
- Extract modified/created page paths from PlanResult.design
- If extraction fails → AskUserQuestion for target page

**Output**: VisualQAResult (written to `state/results/visual-qa.json`)
**State update**: Update `current_phase` to `"project-visual-qa-done"` in `state/pipeline-state.json`

### Step 5: project-verify Invocation

Skip this step with `--skip-verify` (for prototype/PoC use).

```
Skill: project-verify
args: "--team-name project-harness-{slug} --classification <PlanResult.classification JSON>"
  (with --no-team: "--no-team --classification <JSON>")
```

**Output**: VerificationResult (written to `state/results/verify.json`)
**State update**: Update `current_phase` to `"project-verify-done"` in `state/pipeline-state.json`

### Step 6: Regression Loop (if needed)

When VerificationResult.regression_needed is true:

```
Progress output:
  🔄 Regression loop (attempt 1/2)
  → project-implement → project-visual-qa → project-verify re-run

loop (attempt = 1..2):
  1. Re-invoke project-implement (apply fixes)
  2. Re-invoke project-visual-qa (when has_ui)
  3. Re-invoke project-verify
  4. if VerificationResult.overall == "pass": break
  5. else: continue

After 2 attempts: report to user + guide manual fix
```

### Step 7: Cleanup

```
Progress output:
  🧹 Cleaning up pipeline...

1. SendMessage: shutdown_request to all workers
2. Wait for worker shutdown_response (30s timeout)
3. TeamDelete: "project-harness-{slug}"

4. Bash: rm -f state/pipeline-state.json state/handoffs/*.md state/results/*.json
```

---

## State Management (4 Layers)

### Layer 1: TaskCreate/TaskUpdate

```
TaskCreate: { subject: "project-harness: project-plan", activeForm: "classify+explore+design" }
TaskCreate: { subject: "project-harness: project-implement", activeForm: "implement+test" }
TaskCreate: { subject: "project-harness: project-visual-qa", activeForm: "browser QA" }
TaskCreate: { subject: "project-harness: project-verify", activeForm: "verifying" }
```

### Layer 2: Pipeline State File

`state/pipeline-state.json`

```json
{
  "mode": "pipeline",
  "active": true,
  "current_skill": "project-implement",
  "current_phase": "team-exec",
  "task_description": "<task description>",
  "classification": { ... },
  "linked_team": true,
  "team_name": "project-harness-{slug}",
  "skills_completed": ["project-plan"],
  "skills_remaining": ["project-implement", "project-visual-qa", "project-verify"]
}
```

### Layer 3: Result Files

`state/results/{name}.json`

```
state/results/plan.json           # project-plan final result
state/results/implement.json      # project-implement final result
state/results/visual-qa.json      # project-visual-qa final result (when has_ui)
state/results/verify.json         # project-verify final result
```

### Layer 4: Handoff Files

`state/handoffs/{stage}.md`

```
state/handoffs/plan.md    # project-plan exploration result
state/handoffs/prd.md     # project-plan design result
state/handoffs/exec.md    # project-implement result
state/handoffs/verify.md  # project-verify result
```

---

## `--resume` Behavior

Resumes an interrupted pipeline.

### Recovery Procedure

```
1. Read state/pipeline-state.json → load last state
   - If file missing/corrupt → report to user + offer new pipeline
2. Check team_name field in pipeline state → verify existing team
   - If team missing → switch to --no-team mode
3. Read handoff files in state/handoffs/
4. Restore each skill result from state/results/
   - If result file missing → fallback from handoff file
   - If handoff also missing → re-run from that skill
5. Resume from the skill after the last completed one:
   - project-plan done → resume from project-implement
   - project-implement done → resume from project-visual-qa (has_ui) or project-verify
   - project-visual-qa done → resume from project-verify
   - project-verify failed → resume from regression loop
```

### Recovery Status Display

```
🔄 Resuming pipeline
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Task: <task description>
Team: project-harness-{slug} (active)
Last completed: project-plan
Resuming at: project-implement
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Failure Handling & Fallback

| Situation | Handling |
|-----------|---------|
| Sub-skill agent failure | 2 retries within each skill → single-agent fallback |
| Sub-skill itself fails | 2 retries → report to user |
| Timeout | project-plan 180s, project-implement 600s, project-visual-qa 300s, project-verify 180s |
| Team creation failure | Immediately switch to `--no-team` mode |

### Fallback Principles

1. If team creation fails, immediately switch to `--no-team` mode
2. When a sub-skill partially fails, preserve successful results and retry only failed items
3. After 2 retries, report the situation to the user

---

## Team Pipeline Integration

### Single Team Lifecycle

- TeamCreate in Step 1 → maintained across entire pipeline
- TeamDelete on final completion/failure
- With `--no-team`: all sub-skills also called with `--no-team`

### Phase → Team Stage Mapping

| Sub-skill | Team Stage | Executor |
|-----------|-----------|---------|
| project-plan (explore) | team-plan | team workers |
| project-plan (design) | team-prd | team workers |
| project-plan (confirm) | - (team paused) | harness itself (AskUserQuestion) |
| project-implement | team-exec | team workers |
| project-visual-qa | - (outside team) | harness itself (chrome MCP) |
| project-verify | team-verify | team workers |
| (regression fix) | team-fix | team workers |

### Communication Patterns

| Pattern | Description | Used by |
|---------|-------------|---------|
| **Fan-out / Fan-in** | Fully independent parallel → leader aggregates | project-plan, project-verify |
| **Pipeline** | Sequential dependency (A→B→C) | project-implement |
| **Direct execution** | harness uses chrome MCP directly | project-visual-qa |

---

## Mode Integrations

### Ralph Integration

`/project-harness ralph "task"`:

```
Update state/pipeline-state.json with:
{
  "linked_team": true,
  "linked_ralph": true
}
```

project-verify passes → ralph architect validation → final completion.
Cleanup removes ralph fields from `state/pipeline-state.json`.

### Interview Integration

`/project-harness interview "task"`:

**Phase -1** (before project-plan): run an interview agent to crystallize requirements.

```
Step 0: Agent (model="sonnet", description="Deep requirements interview")
        args: "<task description>"
        → Write interview result to state/results/interview.json

Step 1: include interview result when invoking project-plan
        args: "--interview-result state/results/interview.json --config <Classification JSON> <task description>"
```

Cleanup: `rm -f state/results/interview.json`

### Autopilot Integration

`/project-harness autopilot "task"`:

Auto-approves all user confirmation gates across the pipeline.

```
Update state/pipeline-state.json with: { "autopilot": true }
```

**Note**: Regression loops also auto-proceed. Auto-exits after max 2 regressions.

---

## Guide System

Sub-skills conditionally load guides from the project's `.claude/guides/` directory.

**Guide loading is config-driven**. The guides listed in `project-config.yaml` under `guides` are loaded by sub-skills at the appropriate phase.

{{GUIDES_LIST}}

### Learning Loop

After bugfix/regression fixes, project-implement and project-verify automatically suggest adding notes to the relevant guide's `## Notes (Learned Lessons)` section.

On user approval, the note is appended in this format:
```markdown
> ⚠️ **[date]** concise title
> Detailed description + resolution
```

---

## Sub-skill Reference

| Skill | File | Responsibility |
|-------|------|---------------|
| project-plan | `.claude/skills/project-harness/project-plan/SKILL.md` | classify + explore + design + confirm |
| project-implement | `.claude/skills/project-harness/project-implement/SKILL.md` | implement + test |
| project-visual-qa | `.claude/skills/project-harness/project-visual-qa/SKILL.md` | browser QA |
| project-verify | `.claude/skills/project-harness/project-verify/SKILL.md` | multi-agent verification |

Each skill can also be invoked standalone:
```
/project-plan "desc"           — pre-work only
/project-implement "desc"      — implement+test only
/project-visual-qa "/path"     — browser QA only
/project-verify                — verify only
```

---

## Related References (UX & Data Contract)

모든 sub-skill 이 공유하는 출력/데이터 표준:

- `references/progress-format.md` — 진행 중 배너·이모지·phase N/M·워커 트리 표준
- `references/ui-conventions.md` — 확인 게이트(3-옵션) + 완료 요약 스키마
- `references/classification.md` — Phase 0 분류 출력 포맷 (🏷️)
- `references/handoff-templates.md` — phase 간 `state/handoffs/*.md` 구조
- `references/schemas.md` — PlanResult / ImplementationResult / VerificationResult JSON 계약
- `references/guide-injection.md` — 워커 역할 → 가이드 파일 매핑
