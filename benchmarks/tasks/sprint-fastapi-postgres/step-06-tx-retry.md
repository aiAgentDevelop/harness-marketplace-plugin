---
id: sprint-fa-06-tx-retry
sprint: fastapi-postgres
step: 6
stack: fastapi-postgres
timeout_ms: 900000
allowed_file_budget: 10
asvs: []
checks:
  - type: file_contains
    path: "app/**/*.py"
    regex: "(?i)retry|backoff|deadlock"
    reason: "Some retry/deadlock-handling mechanism must be present"
  - type: file_contains
    path: "app/**/*.py"
    regex: "(?i)serializable|repeatable[_ ]read|isolation"
    reason: "Transaction isolation level must be considered"
---

Add a `POST /notes/{id}/move` endpoint that reorders notes (toggles `pinned: bool` and updates `updated_at`).

To handle concurrent updates, wrap the operation in a transaction with serializable isolation, and add automatic retry (max 3 attempts with exponential backoff, e.g. 50ms / 200ms / 800ms) on `IntegrityError` or `DeadlockDetected` (`SerializationFailure`).

Also: add migration `alembic/versions/0003_pinned.py` to add `pinned bool not null default false` to `notes`.

Don't break existing tests. Don't change other endpoints' isolation level.
