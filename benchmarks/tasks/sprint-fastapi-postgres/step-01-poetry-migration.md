---
id: sprint-fa-01-init-migration
sprint: fastapi-postgres
step: 1
stack: fastapi-postgres
timeout_ms: 900000
allowed_file_budget: 10
asvs: [V1.4.4]
checks:
  - type: file_exists
    path: alembic.ini
    reason: "Alembic config must exist"
  - type: file_exists
    path: alembic/env.py
    reason: "Alembic env.py must exist"
  - type: file_contains
    path: pyproject.toml
    regex: "alembic\\s*[>=~]"
    flags: "i"
    reason: "alembic must be added as a dependency"
  - type: file_contains
    path: pyproject.toml
    regex: "sqlalchemy\\s*[>=~]"
    flags: "i"
    reason: "sqlalchemy must be added"
---

We're starting a Notes API on FastAPI + PostgreSQL.

Set up the migration tooling:

1. Add `alembic` and `sqlalchemy[asyncio]` to `pyproject.toml` dependencies (don't modify existing deps).
2. Run/scaffold Alembic init at the project root: `alembic.ini` + `alembic/env.py` + empty `alembic/versions/` dir.
3. Configure `alembic/env.py` to use the existing `DATABASE_URL` env var (already in `.env.example`) and async engine.

Don't add any actual migration scripts yet — just the scaffolding.
