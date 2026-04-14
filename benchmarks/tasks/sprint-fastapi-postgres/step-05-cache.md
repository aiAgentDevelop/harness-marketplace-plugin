---
id: sprint-fa-05-cache
sprint: fastapi-postgres
step: 5
stack: fastapi-postgres
timeout_ms: 900000
allowed_file_budget: 10
asvs: []
checks:
  - type: file_exists
    path: app/cache.py
    reason: "Cache helper module"
  - type: file_contains
    path: app/notes/router.py
    regex: "(?i)cache|invalidate"
    reason: "Notes router must integrate cache"
  - type: file_contains
    path: app/cache.py
    regex: "(?i)redis|aioredis|cachetools|TTLCache"
    reason: "A cache backend (Redis or in-memory TTL) must be used"
---

Add a caching layer for `GET /notes/{id}`:

1. `app/cache.py` — async helpers `get(key) -> Optional[bytes]`, `set(key, value, ttl_seconds)`, `delete(key)`. Backend: Redis (using `redis.asyncio`) if `REDIS_URL` is set, otherwise an in-memory TTL cache via `cachetools.TTLCache`. Add `redis` and/or `cachetools` to deps.
2. Update `GET /notes/{id}` to:
   - Try cache first (`note:{user_id}:{note_id}`)
   - On miss, query DB, set cache with 60s TTL
3. Update `PUT /notes/{id}` and `DELETE /notes/{id}` to invalidate the cache key.

Cache key MUST include `user_id` so users don't see each other's cached notes (cross-tenant isolation).
