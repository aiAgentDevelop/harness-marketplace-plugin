---
id: sprint-fa-08-refactor-router-split
sprint: fastapi-postgres
step: 8
stack: fastapi-postgres
timeout_ms: 900000
allowed_file_budget: 14
asvs: []
checks:
  - type: file_exists
    path: app/notes/router.py
    reason: "Router file must still exist after refactor"
  - type: file_exists
    path: app/notes/service.py
    reason: "Service layer must be extracted"
  - type: file_exists
    path: app/notes/schemas.py
    reason: "Pydantic schemas must be extracted"
  - type: no_file_contains
    path: app/notes/router.py
    regex: "execute\\s*\\(.*select\\("
    flags: "i"
    reason: "Router should not contain raw queries after refactor — those go in service.py"
  - type: no_file_contains
    path: "**/*.py"
    regex: "TODO|FIXME"
    flags: "i"
    reason: "No leftover TODO from refactor"
---

**Refactor**: `app/notes/router.py` has grown to ~400 lines mixing HTTP concerns, query logic, validation schemas, cache logic. Split it cleanly:

- `app/notes/router.py` — only FastAPI route handlers, request/response wiring, dependency injection
- `app/notes/service.py` — all DB queries (move SQLAlchemy `select(...)` / `update(...)` / etc here as functions like `list_notes(db, user_id, limit, offset)`)
- `app/notes/schemas.py` — Pydantic request/response models

Constraints:
- Same external HTTP API (no breaking changes to clients)
- Same behavior for all 6 endpoints (list, get, create, update, delete, move-pin)
- All previous tests should still pass
- Cache integration must remain intact
- Rate limit decorators stay on router
- N+1 fix from the previous step must remain fixed
