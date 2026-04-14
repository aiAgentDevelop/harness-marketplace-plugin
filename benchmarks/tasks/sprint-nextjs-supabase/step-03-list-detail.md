---
id: sprint-nx-03-list-detail
sprint: nextjs-supabase
step: 3
stack: nextjs-supabase
timeout_ms: 900000
allowed_file_budget: 12
asvs: [V4.1.1]
checks:
  - type: file_exists
    path: src/app/notes/page.tsx
    reason: "Notes list page must exist"
  - type: file_exists
    path: src/app/notes/[id]/page.tsx
    reason: "Note detail page must exist"
  - type: file_contains
    path: src/app/notes/page.tsx
    regex: "from\\s*\\(\\s*['\"]notes['\"]"
    reason: "Must query notes table"
  - type: no_file_contains
    path: "src/app/**/*.tsx"
    regex: "service_role|SUPABASE_SERVICE_ROLE"
    reason: "Service-role key must not appear in app code"
---

Add the notes list and detail pages:

1. `src/app/notes/page.tsx` — Server Component that lists the current user's notes (title + created_at), each linking to `/notes/[id]`. Order by `created_at desc`. Show "No notes yet" if empty.
2. `src/app/notes/[id]/page.tsx` — Server Component showing the note's title + body + created_at.

Use the existing `getSupabaseServer()` and rely on RLS — don't manually filter by user_id in the query (RLS does it). If a non-existent or unauthorized note id is requested, render `notFound()` from `next/navigation`.
