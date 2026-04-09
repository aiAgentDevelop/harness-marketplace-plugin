---
name: upgrade
description: Upgrade existing project-harness to latest marketplace templates while preserving project-config.yaml
argument-hint: "[--preview] [--backup-only] [project-path]"
---

<Purpose>
Upgrade an existing project-harness to the latest harness-marketplace templates. Preserves the project's `project-config.yaml` (wizard answers, agents, guides) while replacing template-based files (SKILL.md orchestrator, plan, implement, visual-qa, verify) with the latest versions.
</Purpose>

<Use_When>
- User says "upgrade harness", "update project-harness", "update templates"
- harness-marketplace plugin was updated and user wants latest templates
- User wants to re-generate AI content (agents/guides) with new prompts
</Use_When>

<Do_Not_Use_When>
- No existing project-harness found — use `/harness-marketplace:wizard` instead
- User wants to change project type or fundamental config — re-run wizard
</Do_Not_Use_When>

<Steps>

## Phase 0: Detect Existing Harness

1. **Check for project-harness**:
   - Look for `.claude/skills/project-harness/project-config.yaml`
   - If not found → error: "No existing project-harness found. Run `/harness-marketplace:wizard` first."

2. **Read existing config**:
   - Parse `project-config.yaml`
   - Extract: version, generated_by, flags, agents, guides, run_options
   - Store as `existing_config`

3. **Compare versions**:
   - Read current marketplace plugin version from plugin metadata
   - Compare with `existing_config.generated_by` version
   - If same version → warn: "Already at latest version. Continue anyway?"

## Phase 1: Preview Changes (--preview)

If `--preview` flag or user wants to see changes first:

1. **List files that will be replaced** (template-based):
   - `SKILL.md` (orchestrator)
   - `plan/SKILL.md`
   - `implement/SKILL.md`
   - `visual-qa/SKILL.md` (if has_ui)
   - `verify/SKILL.md`
   - `references/classification.md`
   - `references/schemas.md`
   - `hooks/*.sh` — Generated Rules section only (Custom Rules section preserved)
   - `hooks-config.json` (regenerated from template)

2. **List files that will be preserved**:
   - `project-config.yaml`
   - `agents/*.md` (unless user requests regeneration)
   - `guides/*.md` (unless user requests regeneration)
   - `references/options.md`
   - `state/` (runtime data, including `learning-log.yaml`)
   - `hooks/*.sh` — Custom Rules section (below the `═══ CUSTOM RULES` marker)
   - `.github/workflows/*.yml` (CI/CD workflows, unless user requests regeneration)

3. **Show upgrade summary** via AskUserQuestion:
   - Files to replace (count + list)
   - Files to preserve (count + list)
   - Version change (old → new)
   - Options: [Proceed / Regenerate AI content too / Cancel]

## Phase 2: Backup

1. **Create backup directory**: `.claude/skills/project-harness.backup-{timestamp}/`
2. **Copy all existing files** to backup
3. **Confirm backup**: verify file count matches

## Phase 3: Upgrade Templates

1. **Re-generate template files** using existing `project-config.yaml`:
   - Load templates from marketplace plugin's `templates/` directory
   - Apply template variable substitution using existing config
   - Replace conditional blocks based on config flags
   - Write updated SKILL.md files

2. **Upgrade hook scripts** (if enforcement.level != "none"):
   - For each hook script in `hooks/*.sh`:
     a. Read existing file
     b. Extract Custom Rules section (everything below `═══ CUSTOM RULES` marker)
     c. Re-generate the Generated Rules section from latest template
     d. Append preserved Custom Rules section
     e. Write updated file
   - Regenerate `hooks-config.json` from template
   - If new hook types were added in this version, generate new hook scripts
   - Offer to re-merge hooks into settings.json

3. **Upgrade CI/CD workflows** (if ci_cd.platform != "none"):
   - Only regenerate if user selected "Regenerate CI/CD" option
   - Preserve user customizations by default
   - If new pipeline types available, offer to add them

4. **Preserve self-learning data**:
   - Never overwrite `state/learning-log.yaml`
   - Custom Rules added by self-learning are preserved (Step 2 above)

5. **Update version** in project-config.yaml:
   - Update `generated_by` to current marketplace version
   - Add new config sections if missing (enforcement, ci_cd, self_learning with defaults)
   - Preserve all existing config values

6. **If "Regenerate AI content" selected**:
   - Re-generate agents based on config.agents list
   - Re-generate guides based on config.guides list
   - Re-generate classification.md
   - Re-generate options.md

## Phase 4: Validate

1. **Run structure validation**: `scripts/validate-harness.js`
2. **Run plan dry-run**: Execute plan phase in dry-run mode
3. **Report results** to user:
   - Validation: PASS/FAIL
   - Files upgraded: count
   - Backup location
   - [Confirm / Rollback to backup / Re-run wizard]

## Phase 5: Rollback (if needed)

If validation fails or user requests rollback:
1. Remove current project-harness
2. Restore from backup directory
3. Remove backup directory
4. Report: "Rolled back to previous version"

</Steps>

<Tool_Usage>
- Use `Read` to parse existing project-config.yaml
- Use `Write` to create upgraded files
- Use `Bash` to copy backup and run validation script
- Use `AskUserQuestion` for upgrade confirmation and rollback decisions
- Use `Agent(subagent_type="Explore")` to verify file structure
</Tool_Usage>
