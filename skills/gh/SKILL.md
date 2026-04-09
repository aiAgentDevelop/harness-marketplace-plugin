---
name: gh
description: Automate GitHub workflow (Issue → Branch → Commit → PR) with user approval at every step
argument-hint: "[--no-issue] [--draft] [description]"
---

<Purpose>
Wrap code changes in a proper GitHub workflow: create Issue, create branch, commit changes,
push and create PR. Every step requires explicit user approval. PR merge is NEVER performed
automatically — the PR URL is presented and execution stops.
</Purpose>

<Use_When>
- User wants to make a code change following GitHub best practices
- User says "gh flow", "github workflow", "create PR", "proper git flow"
- User runs `/harness-marketplace:gh`
- After completing a fix or feature that needs to be submitted
</Use_When>

<Do_Not_Use_When>
- User just wants to commit without PR — use regular git commands
- User wants to manage issues only — use `gh issue` directly
- User is working on a throwaway branch — no workflow needed
</Do_Not_Use_When>

<Execution_Policy>
- EVERY step requires explicit user approval via AskUserQuestion
- NEVER merge a PR — present the URL and stop
- NEVER push without user confirmation
- NEVER create an issue without user reviewing the title and body
- Branch naming: `fix/{issue-number}-{slug}` or `feat/{issue-number}-{slug}`
- Commit messages MUST reference the issue number (e.g., "Fixes #4")
- If user denies any step, gracefully stop and report what was completed
</Execution_Policy>

---

## Flag Detection

```
--no-issue: Skip Issue creation, start from branch creation
--draft: Create PR as draft
description: Used as Issue title and branch name basis
```

---

## Step 1: Describe the Change

```
If description argument provided:
  Store as: change.description
Else:
  AskUserQuestion:
    question: "What change are you making?"
    header: "Change Description"
    options:
      - label: "Bug fix"
        label_ko: "버그 수정"
        description: "Fix a defect or incorrect behavior"
        description_ko: "결함 또는 잘못된 동작을 수정합니다"
      - label: "New feature"
        label_ko: "새 기능"
        description: "Add new functionality"
        description_ko: "새로운 기능을 추가합니다"
      - label: "Improvement"
        label_ko: "개선"
        description: "Improve existing functionality"
        description_ko: "기존 기능을 개선합니다"
      - label: "Documentation"
        label_ko: "문서"
        description: "Update documentation only"
        description_ko: "문서만 업데이트합니다"

  Store as: change.type (fix|feat|improve|docs)

  AskUserQuestion: "Describe the change in one sentence."
  Store as: change.description
```

## Step 2: Create GitHub Issue (unless --no-issue)

```
If --no-issue flag:
  Skip to Step 3
  Store as: issue.number = null

Generate Issue title:
  AI creates concise title from change.description (under 70 chars)

Generate Issue body:
  ## Problem / Feature
  {extracted from change.description}
  
  ## Proposed Solution
  {AI suggests approach based on codebase context}

Present to user:
  AskUserQuestion:
    question: "Create this GitHub Issue?"
    header: "Issue Preview"
    Show: title and body preview
    options:
      - label: "Create"
        label_ko: "생성"
      - label: "Edit title/body first"
        label_ko: "제목/본문 수정 후 생성"
      - label: "Skip issue creation"
        label_ko: "이슈 생성 건너뛰기"

If "Create":
  Run: gh issue create --title "{title}" --body "{body}" --label "{change.type}"
  Store as: issue.number (parse from output URL)
  Report: "Issue #{issue.number} created"

If "Edit":
  AskUserQuestion: "Enter the title:"
  AskUserQuestion: "Enter the body (or 'keep' to keep current):"
  Then create issue

If "Skip":
  Store as: issue.number = null
```

## Step 3: Create Branch

```
Generate branch name:
  If issue.number exists:
    {change.type}/{issue.number}-{slug-from-description}
    Example: fix/4-wizard-korean-label-typo
  Else:
    {change.type}/{slug-from-description}
    Example: fix/wizard-korean-label-typo

  Slug rules: lowercase, spaces → hyphens, max 40 chars, ASCII only

Check current branch:
  If already on a feature branch (not main/master):
    AskUserQuestion: "You're on branch '{current}'. Create a new branch or use current?"
      - "Create new branch"
      - "Use current branch"

If creating new:
  Run: git checkout -b {branch_name}
  Report: "Branch '{branch_name}' created"
```

## Step 4: Make Changes (Delegate or Wait)

```
AskUserQuestion:
  question: "How would you like to proceed with the code changes?"
  header: "Implementation"
  options:
    - label: "I'll make changes myself — continue when I say 'done'"
      label_ko: "직접 변경하겠습니다 — 'done' 이라고 하면 계속 진행"
      description: "You make the changes, then tell me to continue with commit and PR."
      description_ko: "직접 변경 후 커밋과 PR 생성을 계속 진행합니다."
    - label: "Help me implement the changes"
      label_ko: "변경 작업을 도와주세요"
      description: "I'll help you implement the changes, then proceed to commit and PR."
      description_ko: "변경 작업을 도와드린 후 커밋과 PR 생성을 진행합니다."
    - label: "Changes are already done — proceed to commit"
      label_ko: "변경이 이미 완료됨 — 커밋으로 진행"
      description: "Skip to commit and PR creation."
      description_ko: "커밋과 PR 생성으로 바로 진행합니다."

If "I'll make changes myself":
  Stop and wait. Resume when user says "done" or "continue".
  
If "Help me implement":
  Proceed with normal code editing workflow.
  When done, continue to Step 5.

If "Changes are already done":
  Continue to Step 5.
```

## Step 5: Review and Commit

```
Run: git status
Run: git diff (staged and unstaged)

Present changes to user:
  Show file list and diff summary

AskUserQuestion:
  question: "Commit these changes?"
  header: "Commit Review"
  options:
    - label: "Commit all shown changes"
      label_ko: "표시된 모든 변경사항 커밋"
    - label: "Select specific files to commit"
      label_ko: "커밋할 파일 선택"
    - label: "Cancel — don't commit yet"
      label_ko: "취소 — 아직 커밋하지 않음"

If commit:
  Generate commit message:
    {change.type}: {short description}
    
    {detailed description if needed}
    
    {if issue.number: "Fixes #{issue.number}"}

  Present commit message to user:
    AskUserQuestion: "Use this commit message?"
      - "Yes"
      - "Edit message"

  Run: git add {files}
  Run: git commit -m "{message}"
  Report: "Committed: {short hash} {message}"
```

## Step 6: Push and Create PR

```
AskUserQuestion:
  question: "Push and create a Pull Request?"
  header: "Push & PR"
  options:
    - label: "Push and create PR"
      label_ko: "푸시하고 PR 생성"
    - label: "Push only (create PR later)"
      label_ko: "푸시만 (PR은 나중에)"
    - label: "Don't push yet"
      label_ko: "아직 푸시하지 않음"

If "Push and create PR":
  Run: git push -u origin {branch_name}

  Generate PR title:
    {change.type}: {short description}

  Generate PR body:
    ## Summary
    - {bullet points from changes}
    
    {if issue.number: "Fixes #{issue.number}"}
    
    ## Test plan
    - [ ] {relevant test items}

  Present PR preview to user:
    AskUserQuestion: "Create this PR?"
      - "Create"
      - "Edit first"
      - "Cancel"

  draft_flag = "--draft" if --draft flag was set

  Run: gh pr create --title "{title}" --body "{body}" {draft_flag}
  Store as: pr.url

If "Push only":
  Run: git push -u origin {branch_name}
  Report: "Pushed. Create PR later with: gh pr create"
```

## Step 7: STOP — Present Result

```
CRITICAL: NEVER merge the PR. NEVER run gh pr merge.

Present final summary:
  ✅ Workflow Complete
  
  Issue:  #{issue.number} (if created)
  Branch: {branch_name}
  Commit: {short_hash} {message}
  PR:     {pr.url} (if created)
  
  ⚠️ PR merge is your responsibility. Review and merge when ready.

STOP execution. Do not proceed further.
```

---

<Tool_Usage>
- Use `Bash` for: `gh issue create`, `git checkout -b`, `git add`, `git commit`, `git push`, `gh pr create`, `git status`, `git diff`
- Use `AskUserQuestion` at EVERY step — no step is auto-executed
- Use `Read` to understand codebase context for Issue/PR body generation
- NEVER use `gh pr merge` — this is explicitly forbidden
</Tool_Usage>

<Final_Checklist>
- [ ] User approved every step that was executed
- [ ] Issue created (unless --no-issue)
- [ ] Feature branch created (not working on main)
- [ ] Commit references issue number (if issue exists)
- [ ] PR created (if user approved)
- [ ] PR was NOT merged — URL presented to user
- [ ] No auto-push was performed without approval
</Final_Checklist>
