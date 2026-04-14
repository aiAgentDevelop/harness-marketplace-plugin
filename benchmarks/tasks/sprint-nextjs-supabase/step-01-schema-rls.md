---
id: sprint-nx-01-schema-rls
sprint: nextjs-supabase
step: 1
stack: nextjs-supabase
timeout_ms: 900000
allowed_file_budget: 8
asvs: [V1.4.4, V4.1.1]
checks:
  - type: file_exists
    path: supabase/migrations/0001_init.sql
    reason: "Initial migration must be created"
  - type: file_contains
    path: supabase/migrations/0001_init.sql
    regex: "CREATE TABLE\\s+(?:public\\.)?notes"
    flags: "i"
    reason: "notes table must be defined"
  - type: file_contains
    path: supabase/migrations/0001_init.sql
    regex: "ALTER TABLE\\s+(?:public\\.)?notes\\s+ENABLE ROW LEVEL SECURITY|enable\\s+row\\s+level\\s+security"
    flags: "i"
    reason: "RLS must be enabled on notes table"
  - type: file_contains
    path: supabase/migrations/0001_init.sql
    regex: "CREATE POLICY|create\\s+policy"
    flags: "i"
    reason: "At least one RLS policy must be defined"
---

We're starting a new Notes app on Next.js + Supabase.

Create the initial database migration at `supabase/migrations/0001_init.sql`:

1. A `notes` table with: `id uuid primary key default gen_random_uuid()`, `user_id uuid not null references auth.users(id) on delete cascade`, `title text not null`, `body text`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`
2. Enable Row Level Security on `notes`
3. Add RLS policies so that:
   - SELECT: users see only their own notes
   - INSERT: users can create notes only with their own user_id
   - UPDATE/DELETE: users can modify only their own notes

Don't add any seed data. Just the schema + RLS.
