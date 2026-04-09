---
name: project-harness
description: {{DESCRIPTION}}
---

# {{PROJECT_NAME}} Harness

## Overview

`/project-harness "task description"` runs the full **classify→explore→design→[user confirm]→implement→test→[visual QA]→verify** pipeline automatically.

Chains four sub-skills (`project-plan`, `project-implement`, `project-visual-qa`, `project-verify`) in a sequential pipeline. All behavior is driven by the project's `project-config.yaml`.

## Usage

```
/project-harness "task description"           — auto-classify + full pipeline
/project-harness --type feature "desc"        — specify type directly (feature|bugfix|refactor|config)
/project-harness --resume                      — resume an interrupted pipeline
/project-harness --dry-run "desc"             — plan phase only (design preview)
/project-harness --no-team "desc"             — disable team (force sequential mode)
/project-harness --skip-qa "desc"             — skip visual QA even if has_ui (minor UI changes)
/project-harness --skip-verify "desc"         — skip verification (prototype/PoC)
/project-harness --verbose "desc"             — show internal worker status in detail
/project-harness --quiet "desc"               — show final result only
{{RUN_OPTIONS}}
```

### Mode Combinations

```
allowed: /project-harness ralph interview "task"     — interview → full + ralph validation
allowed: /project-harness autopilot ultrawork "task" — auto-approve + parallel implement
allowed: /project-harness deep-dive ralph "task"     — trace → interview → full + ralph
forbidden: interview + deep-dive (deep-dive includes interview)
forbidden: trace + deep-dive (deep-dive includes trace)
```

---

## Pipeline Structure

```
/project-harness "task description"
  │
  ├─ Phase 0+1+2+3 ──→ Skill: project-plan
  │                      → PlanResult (classify + explore + design + user confirm)
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
  └─ Cleanup ───────→ TeamDelete + state_clear
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
4. state_write(mode="project-pipeline", state={
     "config_loaded": true,
     "classification": <Classification JSON>,
     "task_description": "<task description>"
   })
```

### Step 1: Team Creation

Unless `--no-team`, create a single team and maintain it across the entire pipeline.

```
TeamCreate: "project-harness-{slug}"
state_write(mode="pipeline", state={
  "linked_team": true,
  "team_name": "project-harness-{slug}",
  "task_description": "<task description>"
})
state_write(mode="team", state={
  "linked_harness": true,
  "current_stage": "team-plan"
})
```

### Step 2: project-plan Invocation

```
Skill: project-plan
args: "--team-name project-harness-{slug} --config <Classification JSON> <task description>"
  (pass --type, --dry-run when user specifies them)
  (with --no-team: "--no-team --config <Classification JSON> <task description>")
```

**Output**: PlanResult (notepad key: `project-plan-result`)
**State update**: state_write(current_phase="project-plan-done")

**`--dry-run` exits here.**

### Step 3: project-implement Invocation

```
Skill: project-implement
args: "--team-name project-harness-{slug} --plan-result project-plan-result --config <Classification JSON> <task description>"
  (with --no-team: "--no-team --plan-result project-plan-result --config <Classification JSON> <task description>")
```

**Output**: ImplementationResult (notepad key: `project-implement-result`)
**State update**: state_write(current_phase="project-implement-done")

### Step 4: project-visual-qa Invocation (Conditional)

Check `has_ui` from PlanResult. Skip if `has_ui: false` or `--skip-qa`.

```
Skill: project-visual-qa
args: "--classification <PlanResult.classification JSON> <target page paths>"
```

**Target page path determination**:
- Extract modified/created page paths from PlanResult.design
- If extraction fails → AskUserQuestion for target page

**Output**: VisualQAResult (notepad key: `project-visual-qa-result`)
**State update**: state_write(current_phase="project-visual-qa-done")

### Step 5: project-verify Invocation

Skip this step with `--skip-verify` (for prototype/PoC use).

```
Skill: project-verify
args: "--team-name project-harness-{slug} --classification <PlanResult.classification JSON>"
  (with --no-team: "--no-team --classification <JSON>")
```

**Output**: VerificationResult (notepad key: `project-verify-result`)
**State update**: state_write(current_phase="project-verify-done")

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

4. state_clear(mode="pipeline")
5. state_clear(mode="team")
6. (if ralph linked) state_clear(mode="ralph")
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

### Layer 2: OMC Pipeline State + Team State

```
state_write(mode="pipeline", state={
  "active": true,
  "current_skill": "project-implement",
  "task_description": "<task description>",
  "classification": { ... },
  "linked_team": true,
  "team_name": "project-harness-{slug}",
  "skills_completed": ["project-plan"],
  "skills_remaining": ["project-implement", "project-visual-qa", "project-verify"]
})
```

### Layer 3: Notepad Working Memory

```
project-plan-result           # project-plan final result
project-implement-result      # project-implement final result
project-visual-qa-result      # project-visual-qa final result (when has_ui)
project-verify-result         # project-verify final result
```

### Layer 4: Handoff Files

`.omc/handoffs/{stage}.md`

```
.omc/handoffs/team-plan.md    # project-plan exploration result
.omc/handoffs/team-prd.md     # project-plan design result
.omc/handoffs/team-exec.md    # project-implement result
.omc/handoffs/team-verify.md  # project-verify result
```

---

## `--resume` Behavior

Resumes an interrupted pipeline.

### Recovery Procedure

```
1. state_read(mode: "pipeline") → load last state
   - If state missing/corrupt → report to user + offer new pipeline
2. state_read(mode: "team") → check existing team
   - If team missing → switch to --no-team mode
3. Read handoff files in .omc/handoffs/
4. Restore each skill result from Notepad
   - If notepad key missing → fallback from handoff file
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
state_write(mode="pipeline", state={ "linked_team": true, "linked_ralph": true })
state_write(mode="team", state={ "linked_harness": true, "linked_ralph": true })
state_write(mode="ralph", state={ "linked_team": true, "linked_harness": true })
```

project-verify passes → ralph architect validation → final completion.
Cleanup adds: `state_clear(mode="ralph")`

### Interview Integration

`/project-harness interview "task"`:

**Phase -1** (before project-plan): invoke `oh-my-claudecode:deep-interview`.

```
Step 0: Skill: oh-my-claudecode:deep-interview
        args: "<task description>"
        → save interview result to notepad key `project-interview-result`

Step 1: include interview result when invoking project-plan
        args: "--interview-result project-interview-result --config <Classification JSON> <task description>"
```

Cleanup: clear `project-interview-result` notepad key.

### Autopilot Integration

`/project-harness autopilot "task"`:

Auto-approves all user confirmation gates across the pipeline.

```
state_write(mode="pipeline", state={ "autopilot": true })
```

**Note**: Regression loops also auto-proceed. Auto-exits after max 2 regressions.

### Ultrawork Integration

`/project-harness ultrawork "task"`:

Activates parallel execution engine in project-implement phase.

```
Step 3 (project-implement):
  Skill: oh-my-claudecode:ultrawork
  args: "<task list from project-plan-result>"
```

### UltraQA Integration

`/project-harness ultraqa "task"`:

Activates aggressive auto-fix loop after project-verify.

```
Step 5 (after project-verify):
  Skill: oh-my-claudecode:ultraqa
  args: "<verification failure items>"
  → test → fix → retest → repeat until pass (max 10 attempts)
```

### Trace Integration

`/project-harness trace "task"`:

**Phase -1** (before project-plan): run bug-tracing agent.

```
Step 0: Skill: oh-my-claudecode:trace
        args: "<bug description>"
        → save trace result to notepad key `project-trace-result`

Step 1: project-plan uses trace result as starting point for classify/explore
```

Best combined with `--type bugfix`: `/project-harness trace --type bugfix "error description"`

### Deep-Dive Integration

`/project-harness deep-dive "task"`:

**Phase -2 → -1**: trace(root-cause) → deep-interview(requirement crystallization) → project-plan → rest.

```
Step 0a: Skill: oh-my-claudecode:trace
         → save to notepad key `project-trace-result`

Step 0b: Skill: oh-my-claudecode:deep-interview
         args: "<refined questions based on trace>"
         → save to notepad key `project-interview-result`

Steps 1-7: normal pipeline (trace + interview results injected)
```

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
