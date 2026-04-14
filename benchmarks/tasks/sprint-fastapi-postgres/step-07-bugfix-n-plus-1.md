---
id: sprint-fa-07-bugfix-n-plus-1
sprint: fastapi-postgres
step: 7
stack: fastapi-postgres
timeout_ms: 900000
allowed_file_budget: 8
asvs: []
checks:
  - type: file_contains
    path: "app/notes/**/*.py"
    regex: "(?i)selectinload|joinedload|in_\\s*\\("
    reason: "Must use eager-loading or IN-batch query, not per-row loop"
  - type: no_file_contains
    path: "app/notes/**/*.py"
    regex: "for\\s+\\w+\\s+in\\s+notes\\s*:\\s*\\n\\s*await\\s+(?:db|session)\\.execute"
    reason: "Per-row execute() inside a notes loop is the N+1 we just fixed"
---

**Bugfix**: `GET /notes` is slow when a user has many notes. Profiling shows it's because we lazily load attachment counts for each note in a loop (one extra query per note → N+1).

Note: pretend the codebase has a `note_attachments` table joined to `notes` (you don't need to add it — just assume it exists with columns `id, note_id, filename`). The `GET /notes` response includes a `attachments_count` field.

Fix the N+1 in `app/notes/router.py` `GET /notes` handler. Use eager loading via SQLAlchemy `selectinload` / `joinedload`, or a single grouped count query, whichever is cleaner.

Don't change the response schema. Don't break other endpoints.
