---
id: sprint-fa-03-notes-crud
sprint: fastapi-postgres
step: 3
stack: fastapi-postgres
timeout_ms: 900000
allowed_file_budget: 14
asvs: [V4.1.1, V4.1.2, V5.3.4]
checks:
  - type: file_exists
    path: app/notes/router.py
    reason: "Notes router must exist"
  - type: file_exists
    path: app/notes/models.py
    reason: "Notes SQLAlchemy model must exist"
  - type: no_file_contains
    path: "**/*.py"
    regex: "execute\\s*\\(\\s*f['\"]"
    reason: "f-string SQL is injection-prone"
  - type: no_file_contains
    path: "app/notes/**/*.py"
    regex: "user_id\\s*=\\s*request\\.json|user_id\\s*=\\s*body\\.user_id"
    reason: "user_id must come from auth dependency, not request body"
---

Add CRUD endpoints for Notes:

1. Migration `alembic/versions/0002_notes.py` for `notes` table (id uuid pk, user_id uuid fk users not null, title text not null, body text, created_at, updated_at).
2. `app/notes/models.py` — SQLAlchemy ORM model.
3. `app/notes/router.py`:
   - `GET /notes` — list current user's notes (paginated `?limit=20&offset=0`).
   - `GET /notes/{id}` — get one (404 if not found OR not owned by current user).
   - `POST /notes` — create. `user_id` from `Depends(get_current_user)`, NOT from request body.
   - `PUT /notes/{id}` — update title/body, only if owned.
   - `DELETE /notes/{id}` — delete, only if owned.

All endpoints use `Depends(get_current_user)`. Use SQLAlchemy 2.0 async style with parameterized queries.
