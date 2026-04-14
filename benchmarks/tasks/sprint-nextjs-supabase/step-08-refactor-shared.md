---
id: sprint-nx-08-refactor-shared
sprint: nextjs-supabase
step: 8
stack: nextjs-supabase
timeout_ms: 900000
allowed_file_budget: 14
asvs: []
checks:
  - type: file_exists
    path: src/components/NoteForm.tsx
    reason: "Shared form component must be extracted"
  - type: file_contains
    path: src/app/notes/new/page.tsx
    regex: "NoteForm"
    reason: "New page must use shared component"
  - type: file_contains
    path: src/app/notes/[id]/edit/page.tsx
    regex: "NoteForm"
    reason: "Edit page must use shared component"
  - type: no_file_contains
    path: "src/app/**/*.tsx"
    regex: "TODO|FIXME|XXX"
    flags: "i"
    reason: "No leftover TODO/FIXME from refactor"
---

**Refactor**: The new-note page and edit-note page have ~80% duplicated form code (input fields, validation, submit button, error display). Extract a shared `<NoteForm>` component at `src/components/NoteForm.tsx` that handles both create and update modes via a `mode: "create" | "edit"` prop and an `initialValues` prop.

Update `src/app/notes/new/page.tsx` and `src/app/notes/[id]/edit/page.tsx` to use it.

Constraints:
- Server Actions remain in the page files (one for create, one for update). The form component is a Client Component that calls the action passed via prop.
- All previous behavior must work — same validation, same redirect on success, same error rendering, same race-condition guard on edit.
- Don't introduce new dependencies.
- Don't modify any other unrelated files (auth, search, share, RLS).
