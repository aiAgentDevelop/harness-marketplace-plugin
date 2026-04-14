# Self-Learning Engine

<Purpose>
Analyzes regression patterns detected during implement and verify phases, then proposes
new enforcement rules (hook additions + guide updates) to prevent recurrence.
The harness evolves over time, becoming smarter with each corrected mistake.
</Purpose>

<Activation>
This engine is invoked automatically when:
- A regression fix loop completes in implement or verify phases
- An auto-fix loop (lint/typecheck) exceeds 2 iterations
- A verification agent flags the same issue type more than once in a session
</Activation>

<Configuration>
Read from `project-config.yaml`:
```yaml
self_learning:
  enabled: true
  mode: "{{SELF_LEARNING_MODE}}"      # approval | automatic
  max_auto_rules: {{MAX_AUTO_RULES}}   # default: 20
  modifiable_targets:
    - "hooks/*.sh"
    - "guides/*.md"
    - "state/learning-log.yaml"
```
</Configuration>

<Guardrails>
## What Self-Learning CAN Modify
- `hooks/*.sh` — Only the "Custom Rules" section (below the `═══ CUSTOM RULES` marker)
- `guides/*.md` — Append to the "Notes" or "Lessons Learned" section
- `state/learning-log.yaml` — Append new entries

## What Self-Learning CANNOT Modify
- Any `SKILL.md` file (orchestrator, plan, implement, verify, visual-qa)
- `project-config.yaml` core fields (project_type, platform, flags, commands)
- `.claude/settings.json` directly (must go through merge-hooks.js)
- `references/` directory files
- Any file outside `.claude/skills/project-harness/`

## Rule Limits
- Maximum {{MAX_AUTO_RULES}} auto-generated rules total
- Check `state/learning-log.yaml` entry count before adding
- If limit reached, propose replacing lowest-priority rule instead of adding
</Guardrails>

<Steps>

## Step 1: Detect and Classify Root Cause

When a regression is detected:

```
1. Read the regression context:
   - What code was changed?
   - What test/check failed?
   - What was the fix?

2. Classify root cause into categories:
   - PATTERN_VIOLATION: Architectural rule broken (e.g., wrong import direction)
   - UNSAFE_OPERATION: Dangerous command or code pattern
   - CONVENTION_BREAK: Coding standard violated
   - TYPE_ERROR: TypeScript type issue
   - SECURITY_ISSUE: Security vulnerability introduced
   - LOGIC_ERROR: Business logic mistake (harder to auto-detect)

3. Determine if the root cause is auto-detectable:
   - Can a regex or shell command detect this before it happens?
   - Is there a file path pattern that narrows the scope?
   - Would a PreToolUse hook prevent it, or PostToolUse catch it?
```

## Step 2: Draft Prevention Rule

For auto-detectable root causes:

```
Draft a hook rule:
  name: descriptive-kebab-case identifier
  event: PreToolUse (prevention) or PostToolUse (detection)
  matcher: Edit | Write | Bash (which tool to watch)
  check: shell command or pattern that detects the mistake
  message: clear explanation of why this is blocked

Draft a guide note:
  section: which guide to update
  content: lesson learned with example of what NOT to do
```

For non-auto-detectable root causes (LOGIC_ERROR):

```
Draft only a guide note — no hook rule.
Guide notes serve as documentation for the AI to reference in future sessions.
```

## Step 3: Propose Changes to User

{{CONDITION:self_learning_approval}}
### Approval Mode

Use AskUserQuestion to present the proposed changes:

```
AskUserQuestion:
  question: "A regression was detected and fixed. To prevent recurrence:"
  header: "Self-Learning Proposal"
  options:
    - label: "Apply hook rule + guide note"
      description: |
        Hook: {event} on {matcher} — {description}
        Guide: Append note to {guide_name}
    - label: "Apply guide note only"
      description: "Add lesson learned to {guide_name} without hook enforcement"
    - label: "Apply hook rule only"
      description: "Add {event} hook without guide update"
    - label: "Skip"
      description: "Do not learn from this regression"
```
{{/CONDITION:self_learning_approval}}

{{CONDITION:self_learning_automatic}}
### Automatic Mode

Apply changes without asking, but log everything:

```
1. Apply hook rule to Custom Rules section
2. Apply guide note
3. Log entry to learning-log.yaml
4. Print summary: "Self-learning: Added hook rule '{name}' to prevent {description}"
```
{{/CONDITION:self_learning_automatic}}

## Step 4: Apply Approved Changes

### Hook Rule Application

```
1. Read target hook script (e.g., hooks/pattern-guard.sh)
2. Find the "═══ CUSTOM RULES" marker
3. Append the new rule after existing custom rules:

   # [LEARNED {date}] {name}
   # Root cause: {root_cause_description}
   if [[ "$1" =~ {file_pattern} ]]; then
     if grep -qP '{check_pattern}' "$1" 2>/dev/null; then
       echo "BLOCKED: {message}"
       exit 1
     fi
   fi

4. If this requires a NEW hook script (not just appending):
   → Generate hooks-config.json update
   → Run merge-hooks.js to update settings.json
```

### Guide Note Application

```
1. Read target guide (e.g., guides/architecture-guide.md)
2. Find the "## Notes" or "## Lessons Learned" section (create if missing)
3. Append:

   ### [{date}] {title}
   **Root cause**: {description}
   **Prevention**: {what the hook rule does}
   **Example (do NOT do this)**:
   ```
   {bad_code_example}
   ```
   **Instead, do this**:
   ```
   {good_code_example}
   ```
```

### Learning Log Entry

```
Append to state/learning-log.yaml:

- date: "{YYYY-MM-DD}"
  type: "{hook_addition|guide_update|both}"
  root_cause: "{description}"
  category: "{PATTERN_VIOLATION|UNSAFE_OPERATION|...}"
  prevention: "{what was added to prevent recurrence}"
  hook_script: "{hooks/pattern-guard.sh}"  # if hook added
  guide_updated: "{guides/architecture-guide.md}"  # if guide updated
  approved_by: "{user|automatic}"
  regression_context:
    file: "{file that was fixed}"
    phase: "{implement|verify}"
    fix_description: "{what the fix was}"
```

</Steps>

<Tool_Usage>
- `Read` — Read existing hook scripts, guides, learning log, project config
- `Edit` — Append to hook Custom Rules section, guide Notes section
- `Write` — Create learning-log.yaml if it doesn't exist
- `Bash` — Run merge-hooks.js if new hook entry needed
- `AskUserQuestion` — Present proposals in approval mode
- `Grep` — Check if similar rule already exists (prevent duplicates)
</Tool_Usage>

<Duplicate_Prevention>
Before adding any rule:
1. Read state/learning-log.yaml
2. Check if a rule with similar root_cause already exists
3. If similar rule exists:
   - If exact match → Skip (already learned)
   - If partial match → Propose updating the existing rule instead
4. Check total rule count against max_auto_rules limit
</Duplicate_Prevention>

<Examples>

<Good>
Regression: AI wrote a raw SQL query in a NestJS service file instead of using the repository.
Root cause: PATTERN_VIOLATION — direct DB access outside data layer.
Hook added: PreToolUse on Edit — check for SQL keywords in services/*.ts files.
Guide updated: architecture-guide.md — "All database access must go through repository classes."
</Good>

<Good>
Regression: AI accidentally imported from features/ inside shared/ directory (FSD violation).
Root cause: PATTERN_VIOLATION — FSD layer import direction.
Hook added: PreToolUse on Edit — grep for 'from.*features/' in shared/ files.
Guide updated: architecture-guide.md — "shared/ layer cannot depend on features/, widgets/, or pages/."
</Good>

<Good>
Regression: AI used console.log instead of the project's logger utility.
Root cause: CONVENTION_BREAK — logging standard violated.
Hook added: PostToolUse on Edit — detect console.log in src/ files (exclude test files).
Guide updated: coding-standards.md — "Use logger from @/lib/logger, never console.log."
</Good>

<Bad>
Regression: AI implemented wrong business logic for discount calculation.
Root cause: LOGIC_ERROR — not auto-detectable.
Action: Guide note only (no hook). "Discount rules: percentage-based, not flat amount."
Why bad as hook: Business logic errors cannot be caught by pattern matching.
</Bad>

</Examples>
