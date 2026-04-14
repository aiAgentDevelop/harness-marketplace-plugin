---
id: sprint-nx-06-share-link
sprint: nextjs-supabase
step: 6
stack: nextjs-supabase
timeout_ms: 900000
allowed_file_budget: 12
asvs: [V4.1.5, V1.4.4]
checks:
  - type: file_exists
    path: supabase/migrations/0002_share_tokens.sql
    reason: "New migration for share tokens"
  - type: file_contains
    path: supabase/migrations/0002_share_tokens.sql
    regex: "ENABLE ROW LEVEL SECURITY|enable\\s+row\\s+level\\s+security"
    flags: "i"
    reason: "Share tokens table must have RLS enabled"
  - type: file_exists
    path: src/app/share/[token]/page.tsx
    reason: "Public share page must exist"
  - type: no_file_contains
    path: "src/app/share/**/*.tsx"
    regex: "service_role|SUPABASE_SERVICE_ROLE"
    reason: "Public share endpoint must not use service role"
---

Add a "share via link" feature so users can publish a single note via an opaque token URL.

1. Migration `supabase/migrations/0002_share_tokens.sql`: table `share_tokens(token text primary key, note_id uuid not null references notes(id) on delete cascade, created_by uuid not null references auth.users(id), expires_at timestamptz)`. Enable RLS. Owners can manage their own; anonymous can SELECT only via token lookup (you decide policy mechanism).
2. `src/app/notes/[id]/page.tsx` — add a "Share" button (Server Action that inserts a row, copies token to clipboard).
3. `src/app/share/[token]/page.tsx` — public page (no auth) that renders the note's title + body if a valid, non-expired token row exists.

The public share page must NOT use the service role. Use whatever Supabase pattern you prefer (anon client with carefully scoped RLS policy, or a server-side RPC) but keep it RLS-respecting.
