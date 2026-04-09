---
name: ci-cd
description: Configure or reconfigure CI/CD pipelines for an existing project-harness
argument-hint: "[--reconfigure] [project-path]"
---

<Purpose>
Standalone CI/CD configuration for projects that deferred CI/CD setup during wizard, or want to reconfigure their existing CI/CD pipelines. Walks through platform selection, pipeline selection, and AI review configuration independently without touching other harness files.
</Purpose>

<Use_When>
- User runs `/harness-marketplace:ci-cd`
- User deferred CI/CD during wizard (`ci_cd.platform = "deferred"`) and wants to configure it now
- User wants to change CI/CD platform or add/remove pipelines
- User says "configure CI/CD", "setup CI/CD", "add pipelines", "change CI/CD"
</Use_When>

<Do_Not_Use_When>
- No existing project-harness found — use `/harness-marketplace:wizard` first
- User wants to change non-CI/CD config (re-run wizard or edit directly)
- User wants to run the harness pipeline — use `/project-harness` instead
</Do_Not_Use_When>

<Data_Sources>
- `data/ci-cd-pipelines.yaml` — CI/CD pipeline catalog with templates
- `templates/ci-cd/github-actions/*.yml.template` — GitHub Actions workflow templates
- Existing `project-config.yaml` — reads platform, commands, language, tech_stack for template variables
</Data_Sources>

<Steps>

## Phase 0: Detect Existing Harness

### Step 0.1: Find project-harness
```
Check for .claude/skills/project-harness/project-config.yaml in current directory.
If not found:
  → Print error: "No existing project-harness found. Run /harness-marketplace:wizard first."
  → Abort
```

### Step 0.2: Read existing config
```
Parse project-config.yaml.
Extract: ci_cd, platform, language, commands, tech_stack, flags.

Display current CI/CD status:
  If ci_cd.platform == "deferred":
    → "CI/CD: Not configured yet (deferred during wizard)"
  If ci_cd.platform == "none":
    → "CI/CD: Disabled"
  If ci_cd.platform in ["github-actions", "gitlab-ci"]:
    → "CI/CD: {platform} with {count} pipelines ({pipeline_names})"
```

### Step 0.3: Choose action (if CI/CD already configured)
```
If ci_cd.platform in ["github-actions", "gitlab-ci"]:
  AskUserQuestion:
    question: "CI/CD is already configured. What would you like to do?"
    header: "CI/CD Action"
    options:
      - label: "Reconfigure from scratch"
        description: "Remove existing CI/CD config and start over. Old workflow files will be deleted."
      - label: "Add or remove pipelines"
        description: "Keep the current platform ({platform}). Add new pipelines or remove existing ones."
      - label: "Cancel"
        description: "Keep current CI/CD configuration unchanged."

  If "Reconfigure from scratch" → proceed to Phase 1 Step C1
  If "Add or remove pipelines" → skip to Phase 1 Step C2 (keep current platform)
  If "Cancel" → abort
```

## Phase 1: CI/CD Configuration

### Step C1: CI/CD Platform
```
AskUserQuestion:
  question: "Which CI/CD platform do you use?"
  header: "CI/CD Platform"
  options:
    - label: "GitHub Actions"
      description: "Integrated CI/CD in GitHub. Workflow files in .github/workflows/. Free for public repos."
    - label: "GitLab CI"
      description: "Built-in CI/CD for GitLab. Single .gitlab-ci.yml config file."
    - label: "Remove CI/CD"
      description: "Remove all CI/CD configuration and workflow files."

If "Remove CI/CD":
  → Set ci_cd.platform = "none", ci_cd.pipelines = []
  → Jump to Phase 2 (cleanup old files)

Store as: ci_cd.platform
```

### Step C2: Pipeline Selection
```
Load data/ci-cd-pipelines.yaml → filter by ci_cd.platform.

AskUserQuestion:
  question: "Which CI/CD pipelines should be generated?"
  header: "Pipelines"
  multiSelect: true
  options: (from data file, pre-checked for recommended + currently enabled)
    - label: "CI (Test + Lint + Build)"
      description: "Standard quality gate. Runs tests, lint, typecheck, and build on every push and PR."
    - label: "AI Code Review"
      description: "Claude reviews every PR automatically. Posts comments with severity ratings. Requires ANTHROPIC_API_KEY secret."
    - label: "Deploy Preview"
      description: "Deploy a preview environment for each PR. Supports Vercel, Netlify, Railway, Fly.io."
    - label: "Deploy Production"
      description: "Auto-deploy to production on merge to main. Platform-specific configuration."
    - label: "Security Scan"
      description: "Weekly dependency audit, secret scanning, and CodeQL analysis."

Store as: ci_cd.pipelines[]
```

### Step C3: AI Review Config (if "AI Code Review" selected)
```
AskUserQuestion:
  question: "How should AI code review behave?"
  header: "AI Review"
  options:
    - label: "Comment only"
      description: "AI posts review comments on PRs. Does not block merge."
    - label: "Block on critical"
      description: "AI blocks PR merge when critical issues (security, logic bugs) are found."
    - label: "Auto-approve"
      description: "AI approves PRs when no critical issues found. Use with caution."

Store as: ci_cd.ai_review.block_on_critical and ci_cd.ai_review.auto_approve
```

## Phase 2: Generate CI/CD Files

```
1. Cleanup old workflow files (if reconfiguring or removing):
   - GitHub Actions: delete .github/workflows/{old-pipeline-id}.yml for deselected pipelines
   - GitLab CI: delete .gitlab-ci.yml if switching platforms

2. For each enabled pipeline in ci_cd.pipelines:
   a. Load template from templates/ci-cd/{platform}/{pipeline}.yml.template
   b. Replace template variables from project-config.yaml:
      - {{VERSION}}, {{PROJECT_NAME}}
      - {{NODE_VERSION}} ← ci_cd.node_version (derive from tech stack)
      - {{PACKAGE_MANAGER}} ← ci_cd.package_manager (derive from commands.install)
      - {{INSTALL_COMMAND}} ← commands.install
      - {{BUILD_COMMAND}} ← commands.build
      - {{LINT_COMMAND}} ← commands.lint
      - {{TYPECHECK_COMMAND}} ← commands.typecheck
      - {{TEST_COMMAND}} ← commands.test
      - {{TEST_E2E_COMMAND}} ← commands.test_e2e
      - {{AI_REVIEW_MODEL}} ← ci_cd.ai_review.model (default: claude-sonnet-4-6)
   c. Process conditional blocks for deployment platform
   d. Write to:
      - GitHub Actions: .github/workflows/{pipeline-id}.yml
      - GitLab CI: .gitlab-ci.yml

3. If ci_cd.platform == "none" (removing):
   - Remove .github/workflows/ directory if empty
   - Skip file generation
```

## Phase 3: Update project-config.yaml

```
1. Read existing project-config.yaml
2. Update ONLY the ci_cd section:
   - ci_cd.platform → new platform
   - ci_cd.pipelines → new pipeline list
   - ci_cd.ai_review → new AI review config (if applicable)
   - ci_cd.node_version → derived from tech stack
   - ci_cd.package_manager → derived from commands.install
3. Also update additional.ci_cd for backward compatibility
4. Preserve ALL other sections untouched (enforcement, self_learning, agents, guides, etc.)
5. Write back project-config.yaml
```

## Phase 4: Validate and Report

```
1. Run CI/CD validation subset:
   - If platform != "none": workflow files exist for each enabled pipeline
   - Workflow files are valid YAML
   - Required secrets are documented

2. Display summary:

━━━━ CI/CD Configuration Complete ━━━━

🔄 Platform: {platform}
📋 Pipelines:
  ✅ CI (Test + Lint + Build) — .github/workflows/ci.yml
  ✅ AI Code Review — .github/workflows/ai-review.yml
  ✅ Security Scan — .github/workflows/security.yml

⚠️ Required secrets:
  - ANTHROPIC_API_KEY (for AI Code Review)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. AskUserQuestion:
   question: "CI/CD configuration complete. Confirm?"
   options:
     - "Confirm" → Done
     - "Modify" → Return to Step C2
     - "Cancel" → Restore original config from backup
```

</Steps>

<Tool_Usage>
- `Read` — Load project-config.yaml, data/ci-cd-pipelines.yaml, template files
- `Write` — Generate workflow files, update project-config.yaml
- `AskUserQuestion` — Each configuration step
- `Bash` — Delete old workflow files, create directories
- `Glob` — Check for existing workflow files
</Tool_Usage>

<Final_Checklist>
- [ ] Existing harness detected and config read
- [ ] Current CI/CD status displayed
- [ ] Platform selected (or "Remove CI/CD")
- [ ] Pipelines selected via multiSelect
- [ ] AI Review configured (if selected)
- [ ] Old workflow files cleaned up (if reconfiguring)
- [ ] New workflow files generated from templates
- [ ] project-config.yaml ci_cd section updated (other sections preserved)
- [ ] Validation passed
- [ ] User confirmed
</Final_Checklist>
