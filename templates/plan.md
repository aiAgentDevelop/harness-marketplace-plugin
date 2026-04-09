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

{{GUIDES_LIST}}
