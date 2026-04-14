---
id: sprint-fa-04-rate-limit
sprint: fastapi-postgres
step: 4
stack: fastapi-postgres
timeout_ms: 900000
allowed_file_budget: 8
asvs: [V11.1.2, V2.2.1]
checks:
  - type: file_contains
    path: "app/**/*.py"
    regex: "(?i)slowapi|ratelimit|rate_limit|limiter"
    reason: "Rate limiting library must be wired in"
  - type: file_contains
    path: pyproject.toml
    regex: "(?i)slowapi"
    reason: "slowapi (or equivalent) must be added to deps"
  - type: file_contains
    path: app/auth/router.py
    regex: "(?i)limit|limiter|@.*ratelimit"
    reason: "Auth endpoints (login/signup) should be rate-limited"
---

Add rate limiting to the API.

1. Add `slowapi` to `pyproject.toml` dependencies.
2. In `app/main.py` configure SlowAPI limiter with Redis or in-memory backend (in-memory is OK for the demo).
3. Apply per-IP limits:
   - `POST /auth/login` — 5/minute per IP
   - `POST /auth/signup` — 3/minute per IP
   - `POST /notes` — 30/minute per user (use `get_current_user` for key function)
   - default for other endpoints — 100/minute per IP

Don't break existing tests/endpoints. Limits should return HTTP 429 with a clear error body.
