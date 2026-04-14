---
id: sprint-nx-02-auth-pages
sprint: nextjs-supabase
step: 2
stack: nextjs-supabase
timeout_ms: 900000
allowed_file_budget: 10
asvs: [V2.1.1, V3.3.1]
checks:
  - type: file_exists
    path: src/app/login/page.tsx
    reason: "Login page must exist"
  - type: file_exists
    path: src/app/signup/page.tsx
    reason: "Signup page must exist"
  - type: no_file_contains
    path: "src/app/**/*.tsx"
    regex: "supabase\\.auth\\.getSession\\s*\\(\\s*\\)(?!.*getUser)"
    flags: "s"
    reason: "Server-side auth must use getUser, not getSession"
  - type: file_missing_or_no_contains
    path: src/middleware.ts
    regex: "(?!.*getUser)"
    flags: "s"
    reason: "If middleware exists, it must call getUser to refresh JWT"
---

Building on the schema you just created, add authentication pages:

1. `src/app/login/page.tsx` — email + password login form. On success, redirect to `/notes`.
2. `src/app/signup/page.tsx` — email + password signup form. On success, redirect to `/notes`.
3. `src/middleware.ts` — protect `/notes/*` routes. Redirect unauthenticated users to `/login`.

Use Supabase SSR (`@supabase/ssr`) with the existing `getSupabaseServer()` helper. Server-side auth checks must use the proper Supabase server-side auth API.

Keep the UI minimal — just functional forms.
