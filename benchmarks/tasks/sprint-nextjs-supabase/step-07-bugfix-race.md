---
id: sprint-nx-07-bugfix-race
sprint: nextjs-supabase
step: 7
stack: nextjs-supabase
timeout_ms: 900000
allowed_file_budget: 6
asvs: [V11.1.6]
preexisting_pages:
  - src/app/notes/[id]/edit/page.tsx
checks:
  - type: file_contains
    path: src/app/notes/[id]/edit/page.tsx
    regex: "updated_at|version|If-Match|optimistic|conflict"
    flags: "i"
    reason: "Edit page must have some optimistic-concurrency mechanism"
  - type: file_missing_or_no_contains
    path: supabase/migrations/0003_*.sql
    regex: "(?!.*version).*$"
    flags: "s"
    reason: "Optional: a migration may add version column or trigger"
---

**Bugfix**: A user reported that when they have the same note open in two tabs and edit both, whichever tab saves last silently overwrites the other's changes — no warning.

Fix the edit page (`src/app/notes/[id]/edit/page.tsx`) to detect this and reject the second save with a clear "This note was modified by another session — refresh and re-apply your changes" error.

Acceptable approaches: optimistic-concurrency on `updated_at` (compare on UPDATE), or add a `version int` column with UPDATE … WHERE version = $expected, or use Postgres transaction-isolation primitives. Pick whichever you can implement minimally.

Don't break previously-passing behavior — single-tab editing must still save normally.
