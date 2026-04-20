---
name: launch-check
description: Pre-launch readiness gate — verifies safety net, operational readiness, legal compliance, testing completeness, and runbooks before a service goes to production
argument-hint: "[--section <1..5>] [--format md|json]"
---

<Purpose>
Production launch readiness gate. Runs a five-section checklist on the target
project and produces a PASS/BLOCK report. Section 1 delegates to the existing
verify pipeline (safety net). Section 2 is fully implemented and covers the
service-operational readiness axis (observability, error boundaries, health
checks, rollback paths, cost estimate). Sections 3-5 (legal, testing, runbooks)
are currently placeholders that emit WARN but not BLOCK — they will be filled
in as separate PRs.

This skill is intentionally **separate from `verify`**: verify runs on every
change, launch-check runs once per release candidate.
</Purpose>

<Use_When>
- User says "launch check", "pre-launch audit", "ready to ship", "production readiness"
- User runs `/harness-marketplace:launch-check`
- A release candidate is about to be tagged and the team wants a final gate
- CI workflow wants to block a prod deploy until the checklist passes
</Use_When>

<Do_Not_Use_When>
- Normal per-change verification needed — use `/project-harness` verify phase
- User wants ongoing monitoring — use the observability platform directly
- Project was never scaffolded with this plugin — no project-config.yaml to read
</Do_Not_Use_When>

<Execution_Policy>
- Read-only by default. NEVER edit application code. May write one report file
  to `.claude/skills/project-harness/state/launch-check-{ISO-timestamp}.md`.
- Each section runs independently. A section returning BLOCK halts the overall
  verdict but later sections still run for a full picture.
- Section 2 checks MUST reference the `observability` block of project-config.yaml
  as source of truth. If the block is missing, Section 2 immediately BLOCKS
  with "observability not configured — re-run wizard".
- Sections 3-5 WARN instead of BLOCK until their real implementations ship.
  This is intentional so the skill is useful today without overpromising.
</Execution_Policy>

---

## Overview

`/harness-marketplace:launch-check` performs a five-section pre-launch audit.

| Section | Title | Status | Blocking? |
|---|---|---|---|
| 1 | Safety Net | Implemented via verify delegation | BLOCK on failure |
| 2 | Service Operational Readiness | **Fully implemented** | BLOCK on failure |
| 3 | Legal / Compliance | Placeholder | WARN only |
| 4 | Testing Completeness | Placeholder | WARN only |
| 5 | Runbooks & Playbooks | Placeholder | WARN only |

Overall verdict: `PASS` only if Sections 1 and 2 both PASS. Placeholder
sections (3-5) contribute to the report but never block the verdict on their
own until their real implementations ship.

---

## Phase 0: Prerequisites

```
1. Resolve project root (cwd or first argument).
2. Read .claude/skills/project-harness/project-config.yaml.
   → If missing: exit with "Project not scaffolded with harness-marketplace."
3. Determine --section filter. If unset, run all five.
4. Determine --format. Default "md".
5. Initialize empty report object with five section slots.
```

## Phase 1: Section 1 — Safety Net (delegate to verify)

```
If project-harness/SKILL.md and project-harness/verify.md both exist:
  Invoke the verify skill with `--full-audit` equivalent scope:
    - Run fixed 4 auditors: arch-audit, code-review, type-lint, deploy-validator
    - Run conditional auditors from project-config.yaml flags
      (ux-reviewer if has_ui, auth-auditor if has_auth, db-auditor if has_database, ...)
    - Parallel fan-out (single assistant message, multiple Task tool-use blocks)
    - Collect BLOCK items
  Record in report.section_1:
    - verdict: PASS | BLOCK
    - block_items: [{auditor, reason, file_path?}, ...]

Else:
  Record verdict: WARN, reason: "no verify skill generated; run wizard first"
```

## Phase 2: Section 2 — Service Operational Readiness (FULL IMPL)

Seven checks. Each yields `ok | warn | block` plus a one-sentence reason.

### 2.1 Observability platforms are connected

```
Source: project-config.yaml → observability.error_tracking

Check:
  - observability.error_tracking.platform_id exists (not null) → else BLOCK
    reason: "No error tracking platform selected — re-run wizard Phase 4 Step D"
  - observability.error_tracking.env_vars all present in project's .env.example
    → else WARN reason: "env var {NAME} declared but missing from .env.example"

Additional:
  - If observability.apm is set: same env_var check.
  - If observability.product_analytics is non-empty: same env_var check.
```

### 2.2 Error boundary file exists (frontend projects)

```
Only when flags.has_ui == true.

Check:
  - Search for a file ending in "error-boundary.tsx" OR "error-boundary.jsx" OR
    "global-error.tsx" (Next.js App Router convention) OR "ErrorBoundary.*".
  - → if none found: BLOCK
    reason: "No top-level error boundary detected. Drop integrations/sentry/error-boundary.tsx into your root layout."
```

### 2.3 Error capture init wired on client AND server

```
Only when observability.error_tracking.platform_id != null.

Check (sentry example):
  - Search for "Sentry.init" OR "@sentry/nextjs" import in project source.
    Expect at least 2 occurrences (client + server, or nextjs instrumentation.ts).
  - → 0 occurrences: BLOCK reason: "Sentry SDK not imported anywhere"
  - → 1 occurrence: WARN reason: "Sentry init present but may be single-runtime only"
  - → 2+ occurrences: OK

Generalize per platform (posthog → 'posthog.init', rollbar → 'Rollbar.init', etc.)
```

### 2.4 Health check endpoint exists (backend projects)

```
Only when flags.has_backend == true.

Check:
  - Look for "app/api/health" OR "pages/api/health" OR any file matching
    "health-check.*" OR a route handler mentioning "/health" OR "/healthz" OR "/ready".
  - → if none found: BLOCK
    reason: "No readiness endpoint detected. Drop integrations/sentry/health-check.ts or equivalent."
  - Optionally fetch in dry-run: check endpoint response includes the word
    "release" or "status" (light heuristic).
```

### 2.5 Rollback workflow is present in CI/CD

```
Only when ci_cd.platform == "github-actions".

Check:
  - Look for a workflow file under .github/workflows/ that either:
    (a) supports workflow_dispatch with a "version" or "tag" input, OR
    (b) triggers on deletion of a release, OR
    (c) contains the literal string "rollback" in its name or steps.
  - → if none found: WARN
    reason: "No explicit rollback workflow detected. Launches without a tested rollback path are risky."

Not BLOCK for now: many teams rely on Vercel/Netlify platform-level rollback,
which is valid but not detectable from workflow files alone. Document in report.
```

### 2.6 Release identifier injection

```
Check:
  - project-config.yaml → ci_cd pipelines include at least one that sets
    SENTRY_RELEASE, NEW_RELIC_APP_VERSION, or equivalent env var in the build step.
  - Simpler heuristic: grep .github/workflows/*.yml for "_RELEASE" or
    "GITHUB_SHA" being exported to the build env.
  - → if none: WARN reason: "No release identifier wired into CI. Source maps and release health will be limited."
```

### 2.7 Cost estimate placeholder

```
This is a structural check — the full cost-guard work is a separate P1 item.

Check:
  - `.claude/skills/project-harness/cost-estimate.md` exists.
  - → if missing: WARN
    reason: "No cost estimate recorded. Run cost-report skill (future) or fill in manually."

Not BLOCK until cost-guard P1 ships.
```

## Phase 3: Sections 3-5 (Placeholders — WARN only)

Each placeholder records the intent and a one-line warning.

### 3.1 Section 3 — Legal / Compliance (placeholder)

```
report.section_3 = {
  verdict: "WARN",
  status: "placeholder — full implementation pending",
  planned_checks: [
    "Privacy policy / ToS files exist",
    "License audit: no GPL/AGPL in production deps",
    "PII data flow documented",
    "Cookie consent (web only, when applicable)",
  ],
  advice: "Manually verify these items before launch. A dedicated legal-auditor agent is tracked separately."
}
```

### 3.2 Section 4 — Testing Completeness (placeholder)

```
report.section_4 = {
  verdict: "WARN",
  status: "placeholder — full implementation pending",
  planned_checks: [
    "At least one E2E test covers a critical user journey",
    "API contract test exists when has_backend",
    "Load test baseline recorded",
  ],
  advice: "The templates/e2e-patterns.md and contract-test-patterns.md are tracked as a separate P1."
}
```

### 3.3 Section 5 — Runbooks & Playbooks (placeholder)

```
report.section_5 = {
  verdict: "WARN",
  status: "placeholder — full implementation pending",
  planned_checks: [
    "docs/runbooks/onboarding.md exists",
    "docs/runbooks/incident-response.md exists",
    "docs/runbooks/secret-rotation.md exists",
  ],
  advice: "Runbook templates will be added as a separate P1 (templates/playbooks/*.md)."
}
```

## Phase 4: Report Assembly and Output

```
Compute overall verdict:
  - overall = PASS only if section_1.verdict == PASS AND section_2.verdict == PASS
  - overall = BLOCK if either blocking section is BLOCK
  - overall = WARN if blocking sections PASS but placeholders have advice

Format per --format flag:

  md (default):
    ## Launch Check Report — {ISO timestamp}
    **Overall: {PASS | BLOCK}**

    ### Section 1 — Safety Net: {verdict}
    ...block items rendered as checklist...

    ### Section 2 — Service Operational Readiness: {verdict}
    2.1 Observability connected: {✓ | ✗} — {reason}
    2.2 Error boundary: ...
    ...

    ### Section 3-5 (placeholders): WARN
    ...planned checks + advice per section...

    ### How to fix
    For each BLOCK, link:
      - Section 1 items → `.claude/skills/project-harness/verify.md` references
      - Section 2.1 → docs link to Wizard Phase 4 Step D
      - Section 2.2 → templates/integrations/sentry/error-boundary.tsx.template
      - Section 2.3 → templates/integrations/sentry/nextjs-init.ts.template
      - Section 2.4 → templates/integrations/sentry/health-check.ts.template
      - Section 2.5 → Link to GitHub Actions rollback workflow examples

  json:
    emit structured object as-is.

Write to: .claude/skills/project-harness/state/launch-check-{ISO-timestamp}.md (or .json)

Also print the report to stdout.
```

## Exit codes (for CI integration)

| Overall verdict | Exit code |
|---|---|
| PASS | 0 |
| WARN | 0 (non-blocking) |
| BLOCK | 1 |

When used in a GitHub Actions workflow, failing exit codes halt the deploy-prod
pipeline until the BLOCK items are resolved.

---

## Roadmap — when do placeholder sections become real?

| Section | Tracked as | Expected |
|---|---|---|
| 3 — Legal / Compliance | `data/guides.yaml` legal-compliance domain + `license-auditor`, `privacy-auditor` agents | next release after observability lands |
| 4 — Testing Completeness | `templates/e2e-patterns.md`, `templates/contract-test-patterns.md` | follow-up P1 |
| 5 — Runbooks & Playbooks | `templates/playbooks/onboarding.md`, `incident-response.md`, `secret-rotation.md` | follow-up P1 |

Until these ship, the three placeholder sections stay as WARN, and `launch-check`
remains actionable through Sections 1 and 2.
