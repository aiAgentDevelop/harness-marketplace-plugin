---
id: sprint-nx-04-create-update
sprint: nextjs-supabase
step: 4
stack: nextjs-supabase
timeout_ms: 900000
allowed_file_budget: 12
asvs: [V5.1.4, V4.1.1]
checks:
  - type: file_exists
    path: src/app/notes/new/page.tsx
    reason: "New-note page must exist"
  - type: file_contains
    path: src/app/notes/new/page.tsx
    regex: "use\\s+server|action="
    reason: "Should use Server Action or route handler — not client-side direct insert"
  - type: no_file_contains
    path: "src/app/**/*.tsx"
    regex: "user_id\\s*:\\s*req\\.body\\.user_id|user_id\\s*=\\s*body\\.user_id"
    reason: "user_id must come from auth.getUser(), not request body"
  - type: file_exists
    path: src/app/notes/[id]/edit/page.tsx
    reason: "Edit page must exist"
---

Add note creation and editing:

1. `src/app/notes/new/page.tsx` — form to create a new note. Use a Server Action that calls Supabase insert. The `user_id` MUST come from `supabase.auth.getUser()` server-side, never from form data.
2. `src/app/notes/[id]/edit/page.tsx` — pre-fills form with existing note (404 if not user's), Server Action updates `title` + `body` + bumps `updated_at`.
3. After successful submit, redirect to the detail page.

Validation: title required (1-200 chars), body optional. Show error if validation fails.
