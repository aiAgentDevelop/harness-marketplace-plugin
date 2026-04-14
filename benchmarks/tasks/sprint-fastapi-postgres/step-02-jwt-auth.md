---
id: sprint-fa-02-jwt-auth
sprint: fastapi-postgres
step: 2
stack: fastapi-postgres
timeout_ms: 900000
allowed_file_budget: 12
asvs: [V2.4.1, V2.4.3, V3.5.2]
checks:
  - type: file_exists
    path: app/auth/jwt.py
    reason: "JWT helper module"
  - type: file_exists
    path: app/auth/router.py
    reason: "Auth router"
  - type: no_file_contains
    path: "**/*.py"
    regex: "hashlib\\.(md5|sha1|sha256)\\s*\\([^)]*password"
    flags: "i"
    reason: "Password must use bcrypt/argon2/scrypt, not raw hash"
  - type: file_contains
    path: "app/auth/*.py"
    regex: "(?i)(bcrypt|argon2|passlib|scrypt)"
    reason: "Proper password KDF must be used"
  - type: no_file_contains
    path: "**/*.py"
    regex: "JWT_SECRET\\s*=\\s*['\"][A-Za-z0-9_-]+['\"]"
    reason: "JWT secret must come from env, not hardcoded"
---

Add JWT authentication to the API.

1. Create `app/auth/jwt.py`:
   - `hash_password(plain: str) -> str` (use bcrypt or argon2 via passlib)
   - `verify_password(plain: str, hashed: str) -> bool`
   - `create_access_token(user_id: str, ttl_seconds: int = 3600) -> str` (HS256, secret from `os.environ["JWT_SECRET"]`)
   - `decode_token(token: str) -> dict` (raises `HTTPException(401)` on invalid/expired)

2. Create `app/auth/router.py`:
   - `POST /auth/signup` — create user (email+password). Hash password with proper KDF.
   - `POST /auth/login` — verify password, return `{access_token, token_type: "bearer"}`.
   - Dependency `get_current_user(token = Depends(...))` for protecting endpoints.

3. Wire the router into `app/main.py` via `app.include_router(...)`.

Add Alembic migration `alembic/versions/0001_users.py` for the `users` table (id uuid pk, email text unique not null, password_hash text not null, created_at timestamptz default now()).
