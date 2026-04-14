---
name: project-visual-qa
description: Browser-based visual QA for UI projects. Only included when has_ui=true. Detects overflow/spacing/alignment/text-clip/z-index defects and auto-fixes. Uses chrome MCP or Playwright.
---

# project-visual-qa (Browser QA)

## Overview

`/project-visual-qa "/page-path"` renders the actual UI in a real browser, detects visual defects, and auto-fixes them.

**This skill is only generated when `has_ui: true` in project-config.yaml.**

Uses chrome MCP directly — no agent team required. When fixes are needed, spawns fix workers.

## Usage

```
/project-visual-qa "/dashboard"                         — single page QA
/project-visual-qa "/home" "/settings" "/profile"       — multiple pages sequential QA
/project-visual-qa --no-fix "/dashboard"                — detect only (no auto-fix)
/project-visual-qa --max-fix 5 "/dashboard"             — change max fix attempts (default 3)
/project-visual-qa --viewport mobile "/dashboard"       — mobile viewport (375x812)
/project-visual-qa --viewport tablet "/dashboard"       — tablet viewport (768x1024)
/project-visual-qa --a11y "/dashboard"                  — include accessibility (WCAG) check
```

### Harness integration options

```
/project-visual-qa --classification <JSON> "/path"      — pass classification result directly
```

### Viewport Presets

| Name | Resolution | Use |
|------|-----------|-----|
| desktop | 1440x900 | default |
| tablet | 768x1024 | iPad reference |
| mobile | 375x812 | iPhone reference |

---

## Execution Condition

- When `--classification` is passed → check `has_ui` and `visual_qa_capable`
- When not passed → always execute (standalone invocation is for UI QA purposes)
- When called from project-harness: if `has_ui: false` → automatically skipped

---

## Step 1: Build Pre-validation

1. Run `{config.commands.build}`
2. If fail → SKIP phase + report error (build failures handled by project-implement or project-verify)
3. If success → proceed to Step 2

---

## Step 2: Browser Inspection

### Execution Procedure

#### 2-1. Dev Server Check + Start

1. Check if dev server is running → if not: start `{config.commands.dev}` in background
2. **Port conflict handling**: try default port → +1 → +2. If all fail, report to user.
3. Wait for server ready (max 15s, verify `localhost:<port>` responds)

#### 2-2. Chrome MCP Connection

**Primary: chrome-devtools-mcp**

```
1. mcp__plugin_chrome-devtools-mcp_chrome-devtools__list_pages → check active tabs
2. If chrome MCP unavailable → try Playwright MCP fallback (see 2-2b)
3. mcp__plugin_chrome-devtools-mcp_chrome-devtools__new_page → open new tab
```

**Fallback: Playwright MCP**

```
If chrome-devtools-mcp is unavailable:
  mcp__playwright__browser_navigate → navigate to page
  mcp__playwright__browser_snapshot → capture accessibility snapshot
  mcp__playwright__browser_take_screenshot → capture screenshot
  mcp__playwright__browser_evaluate → run inspection script
```

**If both unavailable**:
```
⚠️ project-visual-qa skipped: No browser MCP available
   Ensure Chrome browser with extension is running, or Playwright is configured.
```

#### 2-3. Viewport Setup

When `--viewport` is specified, resize to viewport dimensions:
- chrome-devtools-mcp: `mcp__plugin_chrome-devtools-mcp_chrome-devtools__resize_page`
- Playwright: `mcp__playwright__browser_resize`

#### 2-4. Page Navigation + Inspection

1. Navigate to target page
   - chrome-devtools-mcp: `mcp__plugin_chrome-devtools-mcp_chrome-devtools__navigate_page`
   - Playwright: `mcp__playwright__browser_navigate`

2. Run **bundle inspection script**:
   - Script path: `.claude/skills/project-harness/scripts/visual-inspect.js`
   - Read the full content of this file and pass to the browser's JavaScript execution tool
   - chrome-devtools-mcp: `mcp__plugin_chrome-devtools-mcp_chrome-devtools__evaluate_script`
   - Playwright: `mcp__playwright__browser_evaluate`

3. Capture screenshot for visual analysis:
   - chrome-devtools-mcp: `mcp__plugin_chrome-devtools-mcp_chrome-devtools__take_screenshot`
   - Playwright: `mcp__playwright__browser_take_screenshot`

4. Cross-validate screenshot visual analysis + inspection script JSON results

### Inspection Items

| Check | Detection Criteria | Always |
|-------|-------------------|--------|
| **overflow** | scrollWidth > clientWidth, scrollHeight > clientHeight (excluding intentional scroll/auto) | Yes |
| **alignment** | Vertical/horizontal alignment mismatch between siblings in flex/grid container | Yes |
| **spacing** | gap/margin/padding values not multiples of 4px | Yes |
| **text-clip** | Text truncated with overflow:hidden but no text-overflow:ellipsis | Yes |
| **z-index** | Identical z-index on positioned elements with overlapping areas (excluding parent-child) | Yes |

| Check | Detection Criteria | Condition |
|-------|-------------------|-----------|
| **accessibility (a11y)** | Missing img alt, button/link missing accessible name, positive tabindex | `--a11y` |
| **responsive** | Re-run above checks after viewport change | `--viewport` |

### Inspection Result Format

The bundle script returns structured JSON. The `results.summary` field gives immediate defect counts.

---

## Step 3: Auto-fix (When Defects Found)

With `--no-fix`: report defects only, do not fix.

### Fix Loop

```
loop (attempt = 1..max_fix):
  1. Defect → identify source file (analyze screenshot + inspection JSON selector)
  2. Fix code with Edit tool
  3. Reload browser → re-run bundle script
     - chrome-devtools-mcp: navigate to same URL to force reload
     - Playwright: mcp__playwright__browser_navigate to same URL
  4. if defects == 0: break (PASS)
  5. else: continue
```

### Post-fix Regression Check

When fixes were applied:

```
loop (attempt = 1..3):
  1. {config.commands.test} → verify tests still pass
  2. Re-run browser QA → confirm defects resolved
  3. if defects == 0 && tests pass: break (PASS)
  4. else: continue

After 3 attempts → report remaining defects to user
```

---

## Multiple Pages QA

When multiple pages are specified, run Steps 2–3 sequentially for each page.
When `--viewport` is specified, inspect each page at that viewport.

---

## Output (VisualQAResult)

Written to `state/results/visual-qa.json`

```json
{
  "pages": [
    {
      "path": "/dashboard",
      "viewport": "desktop",
      "overflow": { "count": 0, "fixed": 0 },
      "alignment": { "count": 1, "fixed": 1 },
      "spacing": { "count": 0, "fixed": 0 },
      "text_clip": { "count": 0, "fixed": 0 },
      "z_index": { "count": 0, "fixed": 0 },
      "responsive": { "breakpoints_tested": ["desktop"], "issues": 0 },
      "a11y": { "contrast": 0, "aria": 0, "keyboard": 0 }
    }
  ],
  "total_fixes": 1,
  "browser_mcp_used": "chrome-devtools-mcp|playwright|none",
  "status": "pass|pass_with_fixes|fail|skipped"
}
```

---

## Progress Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 project-visual-qa
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pages: /dashboard, /settings
Viewport: desktop (1440×900)
Browser: chrome-devtools-mcp

[1/2] /dashboard
  ✅ overflow: 0 issues
  ✅ alignment: 0 issues
  ✅ spacing: 0 issues
  ✅ text-clip: 0 issues
  ✅ z-index: 0 issues

[2/2] /settings
  ⚠️  alignment: 1 issue detected
  🔧 Auto-fixing... (attempt 1/3)
  ✅ alignment: fixed

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Result: pass_with_fixes (1 fix applied)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Agent Team

None by default. Chrome MCP cannot be accessed by workers — the skill executes directly.

When called from project-harness, there is no team stage transition; project-harness runs this skill directly.

When fixes are needed, optionally spawn a fix worker:
1. Update state/pipeline-state.json: set current_phase="team-fix"
2. Fix worker corrects defective code
3. Fix complete → re-run browser QA

---

## Guide Reference

Load the following guides before Step 2 (browser inspection) and use them as inspection criteria:

{{GUIDES_LIST}}

The specific guides loaded depend on the `guides` list in `project-config.yaml`.
