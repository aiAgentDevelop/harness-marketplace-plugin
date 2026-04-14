---
name: project-debug
description: Systematic debugging investigation phase for bugfix tasks. Reproduces errors, generates and tests hypotheses in parallel, analyzes impact scope, and produces structured evidence for the implement phase.
argument-hint: "[--team-name <name>] [--no-team] [--plan-result <path>] [--config <JSON>] <task description>"
---

## Overview

Inserted between project-plan and project-implement **only for bugfix tasks** when `debug_complexity != "low"`.
Transforms harness debugging from static analysis into systematic parallel investigation that outperforms interactive single-agent debugging.

## Usage

```
/project-debug --team-name <name> --plan-result state/results/plan.json --config <Classification JSON> <task description>
/project-debug --no-team --plan-result state/results/plan.json --config <Classification JSON> <task description>
```

When called by project-harness orchestrator, `--team-name` joins the existing pipeline team.

## Pre-requisites

```
Read: .claude/skills/project-harness/project-config.yaml
Read: state/results/plan.json (PlanResult from project-plan)
Load: data/debug-strategies.yaml (from plugin root)
Parse Classification JSON from --config argument.
```

## Step 0: Debug Triage

```
Evaluate debug_complexity from Classification JSON.

If debug_complexity == "low":
  Write state/results/debug.json: { "skipped": true, "reason": "simple_bug" }
  Return immediately — do not proceed to further steps.

If debug_complexity == "medium" or "high":
  Proceed with full debug phase.
  Write state/pipeline-state.json: current_phase = "project-debug"
```

## Step 1: Error Reproduction (Phase: Reproduce)

```
Goal: Capture the actual error output, stack trace, and failure context.

1. Determine reproduction command:
   - If config.commands.test exists → use it (with appropriate filter for affected area)
   - If task description includes a command → use it
   - If PlanResult.exploration has test files → run those specific tests
   - Fallback: ask user for reproduction steps via AskUserQuestion

2. Execute reproduction:
   Run the command via Bash tool.
   Capture full stdout + stderr output.

3. Parse error output:
   - Extract error type (TypeError, ReferenceError, AssertionError, etc.)
   - Extract error message
   - Extract stack trace (file paths + line numbers)
   - Extract affected files list
   - Match error against data/debug-strategies.yaml patterns

4. If reproduction fails (no error):
   - Check if error is intermittent → note in findings
   - Try running 3 times to catch intermittent failures
   - If still no error → ask user for additional context

Write: state/results/debug-reproduce.json
{
  "command": "<reproduction command>",
  "error_type": "<parsed error type>",
  "error_message": "<parsed error message>",
  "stack_trace": ["file:line", ...],
  "affected_files": ["path", ...],
  "reproducible": true|false,
  "strategy_match": "<matched debug-strategies.yaml entry id>",
  "raw_output": "<truncated stderr, max 200 lines>"
}
```

## Step 2: Hypothesis Generation (Phase: Hypothesize)

```
Based on:
  - Reproduction results (error type, stack trace, affected files)
  - Matched debug strategy (investigation_steps, common_causes from debug-strategies.yaml)
  - PlanResult exploration findings (related files, dependency graph)
  - Git recent changes (git log --oneline -20, git diff on affected files)

Generate 3-5 ranked hypotheses. Each hypothesis:
{
  "id": 1,
  "description": "concise root cause theory",
  "likelihood": "high|medium|low",
  "files_to_investigate": ["path:line", ...],
  "check_to_perform": "specific investigation action",
  "evidence_needed": "what would confirm or refute this"
}

Ranking criteria:
  1. Stack trace proximity (closer to error = higher)
  2. Recent git changes in affected files (changed recently = higher)
  3. Pattern match against debug-strategies.yaml common_causes
  4. Complexity (simpler explanation = higher, Occam's razor)
```

## Step 3: Parallel Investigation (Phase: Investigate)

### Team Mode (default)

```
Spawn 4 workers using Fan-out / Fan-in pattern.
All workers read state/results/debug-reproduce.json and the hypothesis list.

Worker 1: root-cause-analyst (model: opus)
  - Test top 2 hypotheses systematically
  - Read the code paths in the stack trace
  - Trace data flow from input to failure point
  - Check each hypothesis against actual code logic
  - Produce: { hypothesis_id, status: "confirmed|refuted|inconclusive", evidence }

Worker 2: error-trace-mapper (model: sonnet)
  - Parse full stack trace → map to source files with line numbers
  - Run git log --oneline -10 on each affected file
  - Run git blame on the specific failing lines
  - Check if failure point was recently changed
  - Produce: { source_map, recent_changes, blame_info }

Worker 3: impact-analyzer (model: sonnet)
  - Grep for the same code pattern across entire codebase
  - Search for: same function call without null check, same API usage, same pattern
  - Use investigation_steps from matched debug strategy
  - Produce: { same_pattern_locations: ["file:line", ...], total_affected }

Worker 4: runtime-inspector (model: sonnet)
  - CRITICAL: Create a git stash point BEFORE adding any debug code
  - Add targeted console.log/debug statements at key locations:
    - Function entry points in stack trace
    - Variable values before the failing line
    - Conditional branch entries
  - Re-run reproduction command
  - Capture debug output → extract variable values
  - CRITICAL: Restore original code (git checkout -- <files> or git stash pop)
  - Produce: { runtime_state: { variable: value, ... }, execution_path }

Leader: Wait for all workers → aggregate findings.
```

### Single Mode (--no-team)

```
Run steps sequentially:
1. Parse stack trace and map to source
2. Check git blame on failure points
3. Test top hypothesis by reading code logic
4. Grep for same pattern across codebase
5. If still inconclusive: add debug logging, run, capture, clean up
```

## Step 4: Git Bisection (Conditional)

```
Run ONLY when ALL of these are true:
  - debug_complexity == "high"
  - Investigation results are inconclusive (no hypothesis confirmed)
  - Git history has > 10 commits since last known tag/release

Process:
1. git log --oneline -30 → identify recent commits
2. Find last known-good state (tag, or user-specified)
3. Binary search through commits:
   - git stash (save current work)
   - git checkout <mid-commit>
   - Run reproduction command
   - Record pass/fail
   - git checkout <branch> && git stash pop
4. Narrow down to introducing commit
5. git diff <good>..<bad> → identify exact change that introduced the bug

Write bisection results to investigation findings.
```

## Step 5: Evidence Collection & Synthesis

```
Leader aggregates all worker findings into DebugResult.

1. Rank hypotheses by evidence strength:
   - "confirmed" > "inconclusive" > "refuted"
   - Weight by evidence quality (runtime state > code analysis > pattern match)

2. Determine root cause:
   - If 1 hypothesis confirmed → root_cause.confirmed = true
   - If multiple inconclusive → pick highest likelihood + present alternatives
   - If all refuted → flag for user input

3. Compile recommended fix:
   - Primary fix: file, line, approach (from confirmed hypothesis)
   - Impact fixes: all same_pattern_locations that need the same fix

4. Write DebugResult and handoff:
   - state/results/debug.json (structured JSON)
   - state/handoffs/debug.md (human-readable summary)
```

## Output Format

### DebugResult (state/results/debug.json)

```json
{
  "skipped": false,
  "debug_complexity": "medium|high",
  "reproduction": {
    "command": "npm run test -- --filter auth",
    "error_type": "TypeError",
    "error_message": "Cannot read properties of undefined (reading 'id')",
    "stack_trace": ["src/auth/service.ts:42", "src/auth/controller.ts:18"],
    "reproducible": true,
    "strategy_match": "null-reference"
  },
  "hypotheses": [
    {
      "id": 1,
      "description": "User object is null when session expired",
      "likelihood": "high",
      "status": "confirmed",
      "evidence": "git blame shows null guard was removed in abc1234",
      "files": ["src/auth/service.ts:42"]
    },
    {
      "id": 2,
      "description": "Session lookup returns stale cache entry",
      "likelihood": "medium",
      "status": "refuted",
      "evidence": "Cache TTL is correct, verified via runtime inspection"
    }
  ],
  "impact": {
    "same_pattern_locations": ["src/profile/service.ts:28", "src/orders/service.ts:55"],
    "total_affected_files": 3
  },
  "root_cause": {
    "confirmed": true,
    "hypothesis_id": 1,
    "category": "LOGIC_ERROR",
    "description": "Missing null guard on user object after session lookup",
    "introducing_commit": "abc1234"
  },
  "recommended_fix": {
    "primary_file": "src/auth/service.ts",
    "primary_line": 42,
    "approach": "Add null check with early return for expired sessions",
    "additional_fixes": ["src/profile/service.ts:28", "src/orders/service.ts:55"]
  },
  "runtime_state": {
    "user": "undefined",
    "session": "{ expired: true, userId: null }",
    "request.headers.authorization": "Bearer eyJ..."
  }
}
```

### Handoff (state/handoffs/debug.md)

```markdown
# Debug Investigation Results

## Root Cause
**Confirmed**: Missing null guard on user object after session lookup (src/auth/service.ts:42)

## Evidence
- Stack trace points to `AuthService.validate()` line 42
- git blame: null guard removed in commit abc1234 (3 days ago)
- Runtime inspection: `user` is `undefined` when session is expired

## Recommended Fix
1. **Primary**: Add null check in `src/auth/service.ts:42` — early return for expired sessions
2. **Impact**: Apply same fix to `src/profile/service.ts:28` and `src/orders/service.ts:55`

## Hypotheses Tested
| # | Description | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Null user from expired session | **Confirmed** | git blame + runtime |
| 2 | Stale cache entry | Refuted | Cache TTL verified |
```

## Team Cleanup

```
Do NOT call TeamDelete — the orchestrator manages the team lifecycle.
Only write results to state/ files.
```

## Timeout

```
Default: 300 seconds (5 minutes)
If timeout reached: write partial DebugResult with available findings + "timeout": true
```

## Guide Reference

```
When fixing, reference these generated guides if available:
- error-handling guide
- testing-strategy guide
- Project-specific guides from project-config.yaml
```
