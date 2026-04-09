---
name: learn
description: Save team-shared learnings to git-tracked files for collaborative knowledge building
argument-hint: "[--consolidate] [description]"
---

<Purpose>
Save development learnings (problems, causes, solutions) to git-tracked files under `.harness/learnings/`.
Team members share knowledge via git pull. INDEX.md provides a concise summary; individual files hold details.
Optionally proposes hook rules to prevent recurrence.
</Purpose>

<Use_When>
- A problem was discovered and solved — user wants to record the lesson
- User says "learn", "save learning", "record this", "remember this for the team"
- User runs `/harness-marketplace:learn`
- INDEX.md exceeds 200 lines and needs consolidation (`--consolidate`)
</Use_When>

<Do_Not_Use_When>
- User wants personal notes — use Claude memory instead
- User wants to modify code — use implement phase
- User wants to create a hook directly — edit hooks manually or use self-learning
</Do_Not_Use_When>

<Execution_Policy>
- Always ask user to confirm before writing files
- Always ask user to confirm before git commit
- NEVER auto-push — present commit result and let user decide when to push
- Individual learning files MUST be under 50 lines
- INDEX.md MUST stay under 200 lines (trigger consolidation if exceeded)
- File names use timestamp + git author to prevent team conflicts
</Execution_Policy>

---

## Directory Structure

```
.harness/learnings/
├── INDEX.md                                    ← Always loaded, one-line summaries
├── 20260409-143022-scott-plugin-config.md      ← Individual learning (≤50 lines)
├── 20260409-151530-john-git-workflow.md
├── plugin-config-consolidated.md               ← Merged from duplicates
└── archive/                                    ← Originals after consolidation
    └── 20260409-143022-scott-plugin-config.md
```

---

## Mode Detection

```
If argument contains "--consolidate":
  → Go to Consolidation Mode
Else:
  → Go to New Learning Mode
```

---

## New Learning Mode

### Step 1: Gather Information

```
AskUserQuestion:
  question: "What did you learn? Describe the problem, cause, and solution."
  header: "New Learning"
  options:
    - label: "Describe in detail"
      label_ko: "상세 설명"
      description: "I'll ask follow-up questions about the problem, cause, and solution."
      description_ko: "문제, 원인, 해결책에 대해 후속 질문을 드립니다."
    - label: "Quick note"
      label_ko: "간단 메모"
      description: "Write a one-liner summary. I'll structure it for you."
      description_ko: "한 줄 요약을 작성하면 구조화해 드립니다."
```

If "Describe in detail":
```
AskUserQuestion: "What was the problem?"
Store as: learning.problem

AskUserQuestion: "What was the root cause?"
Store as: learning.cause

AskUserQuestion: "How was it solved?"
Store as: learning.solution

AskUserQuestion: "How can it be prevented in the future?"
Store as: learning.prevention
```

If "Quick note":
```
AskUserQuestion: "Describe the learning in one sentence."
Store as: learning.summary
AI generates problem/cause/solution/prevention from the summary.
```

### Step 2: Categorize

AI auto-detects category from content. Categories:
- `git-workflow` — Git/GitHub process issues
- `plugin-config` — Plugin manifest/configuration issues
- `i18n` — Internationalization/translation issues
- `hook-enforcement` — Hook rule issues
- `ci-cd` — CI/CD pipeline issues
- `architecture` — Code architecture/pattern issues
- `dependency` — Package/dependency issues
- `general` — Other

AI auto-assigns severity:
- `critical` — Data loss, security, breaking changes
- `important` — Recurring issues, team-wide impact
- `minor` — One-off fixes, local impact

### Step 3: Generate File

```
Detect git author:
  Run: git config user.name
  Store as: author_name (sanitized to lowercase, spaces → hyphens)

Generate timestamp:
  Format: YYYYMMDD-HHMMSS

Generate filename:
  Pattern: {timestamp}-{author}-{category}.md
  Example: 20260409-143022-scott-plugin-config.md
```

Individual learning file format:
```markdown
---
id: {auto-increment from INDEX.md count + 1}
category: {category}
severity: {critical|important|minor}
created: {YYYY-MM-DD}
author: {git user.name}
---
## {Short title}

**Problem**: {description}
**Cause**: {root cause}
**Solution**: {what was done}
**Prevention**: {how to avoid in future}
```

### Step 4: Initialize Directory (if needed)

```
If .harness/learnings/ does not exist:
  Create .harness/learnings/
  Create .harness/learnings/INDEX.md with header:
    "# Team Learnings\n\n"
  Create .harness/learnings/archive/  (empty, with .gitkeep)
```

### Step 5: Write Files

```
1. Write individual learning file to .harness/learnings/{filename}
2. Append one-line entry to INDEX.md:
   "- [{id}]({filename}) — {short title} [{severity}]"
3. Present both files to user for confirmation before writing
```

### Step 6: Check INDEX.md Size

```
Count lines in INDEX.md
If > 200:
  Warn user: "INDEX.md has {N} lines (recommended: ≤200). Run /harness-marketplace:learn --consolidate to clean up."
```

### Step 7: Optional Hook Proposal

```
AskUserQuestion:
  question: "Would you like to propose a hook rule to prevent this issue?"
  header: "Hook Rule Proposal"
  options:
    - label: "Yes, propose a hook rule"
      label_ko: "네, hook 규칙을 제안해주세요"
      description: "AI will draft a PreToolUse hook rule based on this learning."
      description_ko: "AI가 이 학습을 기반으로 PreToolUse hook 규칙 초안을 작성합니다."
    - label: "No, just save the learning"
      label_ko: "아니요, 학습만 저장합니다"
      description: "Save the learning file without creating a hook rule."
      description_ko: "hook 규칙 없이 학습 파일만 저장합니다."

If yes:
  AI generates a hook rule in self-learning format:
    # [LEARNED {date}] {name}
    # Root cause: {description}
    if [[ "$1" =~ {file_pattern} ]]; then
      ...
    fi

  Present to user → if approved, append to appropriate hook script's Custom Rules section
```

### Step 8: Git Commit (with approval)

```
AskUserQuestion:
  question: "Commit the new learning to git?"
  header: "Git Commit"
  options:
    - label: "Yes, commit"
      label_ko: "네, 커밋합니다"
    - label: "No, I'll commit later"
      label_ko: "아니요, 나중에 커밋합니다"

If yes:
  git add .harness/learnings/{new_file} .harness/learnings/INDEX.md
  git commit -m "learn: {short title}"
  
  Present result. NEVER auto-push.
```

---

## Consolidation Mode (`--consolidate`)

### Step C1: Analyze INDEX.md

```
Read .harness/learnings/INDEX.md
Count total entries
Group entries by category
Identify entries with similar titles or overlapping content
```

### Step C2: Present Consolidation Plan

```
Show user:
  Total entries: {N}
  By category: git-workflow(5), plugin-config(3), ...
  
  Proposed merges:
    1. plugin-config: 3 entries → 1 consolidated
       - 20260409-scott-plugin-config.md
       - 20260409-john-plugin-config.md  
       - 20260410-scott-plugin-config-2.md
    2. git-workflow: 2 entries → 1 consolidated
       ...

AskUserQuestion: "Approve this consolidation plan?"
  options:
    - "Approve all"
    - "Review each merge individually"
    - "Cancel"
```

### Step C3: Execute Consolidation

```
For each approved merge group:
  1. Read all individual files in the group
  2. Generate consolidated file: {category}-consolidated.md
     - Merge problem/cause/solution/prevention
     - Keep the highest severity
     - List all original authors
  3. Move originals to archive/
  4. Update INDEX.md:
     - Remove old entries
     - Add consolidated entry
  5. Present result for user confirmation
```

### Step C4: Verify Result

```
Count INDEX.md lines
If still > 200:
  Warn: "INDEX.md is still {N} lines. Consider archiving older entries."
  
  AskUserQuestion: "Archive entries older than 90 days?"
    If yes:
      Move old entries to archive/
      Remove from INDEX.md
      Add entry to archive/INDEX-archive.md
```

---

<Tool_Usage>
- Use `Read` to check existing INDEX.md and learning files
- Use `Write` to create new learning files
- Use `Edit` to append to INDEX.md
- Use `Bash` for: `git config user.name`, `date`, `git add`, `git commit`, `wc -l`
- Use `Glob` to list existing learning files
- Use `AskUserQuestion` at every decision point
</Tool_Usage>

<Final_Checklist>
- [ ] .harness/learnings/ directory exists
- [ ] Individual file created with correct naming (timestamp-author-category)
- [ ] Individual file is ≤ 50 lines
- [ ] INDEX.md updated with one-line entry
- [ ] INDEX.md is ≤ 200 lines (or consolidation warning shown)
- [ ] User confirmed all file writes
- [ ] Git commit completed (if user approved)
- [ ] No auto-push performed
</Final_Checklist>
