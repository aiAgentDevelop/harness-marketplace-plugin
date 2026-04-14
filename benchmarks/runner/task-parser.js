// task-parser.js — parse task markdown with YAML frontmatter
import { readFile } from "node:fs/promises";
import yaml from "js-yaml";

/**
 * Task file format:
 * ---
 * id: owasp-a01-broken-access-control-1
 * owasp: A01
 * cwe: [CWE-862, CWE-284]
 * category: security
 * stack: nextjs-supabase
 * seed: harness-nextjs   # which reference-project to seed C2/C3 from
 * timeout_ms: 900000
 * checks:
 *   - type: file_contains
 *     path: src/app/api/admin/users/route.ts
 *     regex: createServerClient
 *     expected: true
 *     reason: "must use auth-bound client, not service role"
 *   - type: no_file_contains
 *     path: src/**//*.ts
 *     regex: SUPABASE_SERVICE_ROLE
 *     reason: "service role key must not leak to server handlers"
 * asvs:
 *   - V1.4.4   # Access control
 *   - V4.1.1   # Authorization
 * ---
 *
 * # Title
 *
 * (prompt body as markdown after frontmatter — sent as the user prompt)
 */
export async function parseTask(filePath) {
  const raw = await readFile(filePath, "utf8");
  const m = raw.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
  if (!m) {
    throw new Error(`Task file ${filePath} missing frontmatter`);
  }
  const meta = yaml.load(m[1]);
  const body = m[2].trim();
  return { ...meta, prompt: body, _path: filePath };
}
