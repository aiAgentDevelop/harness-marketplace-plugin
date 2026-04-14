// render-seeds.js — Build reference-projects from templates/.
// Produces:
//   reference-projects/claude-md-only-nextjs/  (seed + CLAUDE.md only, no .claude/)
//   reference-projects/claude-md-only-fastapi/
//   reference-projects/harness-nextjs/         (full harness: CLAUDE.md + .claude/* + skills/* + hooks/* + settings.json)
//   reference-projects/harness-fastapi/
//
// Source: templates/ of the repo root. The harness variants copy ALL templates/
// wholesale into .claude/skills/project-harness/ with {{VAR}} substitution stripped
// (we just leave placeholders like {{PROJECT_NAME}} since the benchmark runs in a
// pre-wizard-completed state from the agent's perspective — CLAUDE.md has
// concrete orchestration directives, and skill files are the rendered form).

import { readFile, writeFile, mkdir, cp, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BENCHMARKS_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(BENCHMARKS_ROOT, "..");
const TEMPLATES_DIR = path.join(REPO_ROOT, "templates");
const REFERENCE_DIR = path.join(BENCHMARKS_ROOT, "reference-projects");

// --- Stack seeds ------------------------------------------------------------

const NEXTJS_FILES = {
  "package.json": JSON.stringify(
    {
      name: "benchmark-app-nextjs",
      version: "0.0.1",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "next lint",
        typecheck: "tsc --noEmit",
      },
      dependencies: {
        next: "^14.2.0",
        react: "^18.3.1",
        "react-dom": "^18.3.1",
        "@supabase/ssr": "^0.4.0",
        "@supabase/supabase-js": "^2.45.0",
      },
      devDependencies: {
        typescript: "^5.5.0",
        "@types/react": "^18.3.0",
        "@types/node": "^20.14.0",
      },
    },
    null,
    2,
  ),
  "tsconfig.json": JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "preserve",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        isolatedModules: true,
        incremental: true,
        noEmit: true,
        allowJs: false,
        baseUrl: ".",
        paths: { "@/*": ["src/*"] },
      },
      include: ["src", "next-env.d.ts", "**/*.ts", "**/*.tsx"],
    },
    null,
    2,
  ),
  ".env.example":
    "NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co\n" +
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=anon_key_here\n" +
    "# SUPABASE_SERVICE_ROLE_KEY should live ONLY in server-side env, never in client bundle\n",
  "next.config.mjs":
    "/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  reactStrictMode: true,\n};\nexport default nextConfig;\n",
  "src/lib/supabase/server.ts":
    `// Stub server-client factory. Real tasks should wire this with getUser().
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function getSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    },
  );
}
`,
  "src/app/layout.tsx":
    `export const metadata = { title: "Benchmark App" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body>{children}</body></html>
  );
}
`,
  "src/app/page.tsx":
    `export default function Home() {
  return <main><h1>Hello</h1></main>;
}
`,
  ".gitignore":
    "node_modules\n.next\ndist\n.env.local\n.env.production\n.env\n.DS_Store\n",
};

const FASTAPI_FILES = {
  "pyproject.toml":
    `[project]
name = "benchmark-app-fastapi"
version = "0.0.1"
requires-python = ">=3.11"
dependencies = [
  "fastapi>=0.112",
  "uvicorn[standard]>=0.30",
  "asyncpg>=0.29",
  "pydantic>=2.8",
  "passlib[bcrypt]>=1.7.4",
  "pyjwt>=2.9",
]
`,
  "app/__init__.py": "",
  "app/main.py":
    `from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health() -> dict:
    return {"ok": True}
`,
  "app/db.py":
    `# Stub DB pool placeholder
import asyncpg
import os

_pool: asyncpg.Pool | None = None

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(dsn=os.environ["DATABASE_URL"])
    return _pool
`,
  ".env.example": "DATABASE_URL=postgresql://user:pass@localhost:5432/app\nJWT_SECRET=change_me_in_env\n",
  ".gitignore": "__pycache__\n.venv\ndist\n.env\n.env.local\n*.egg-info\n",
};

// --- Harness templates ------------------------------------------------------

async function copyTree(src, dst) {
  if (!existsSync(src)) return;
  await cp(src, dst, { recursive: true });
}

async function writeFilesRecord(root, filesMap) {
  for (const [rel, body] of Object.entries(filesMap)) {
    const full = path.join(root, rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body, "utf8");
  }
}

function nextjsStackConventions() {
  return [
    "- App Router (`src/app/`)",
    "- Server Components by default; add `\"use client\"` only when required",
    "- Supabase SSR: use `getSupabaseServer()` which wraps `createServerClient` with cookie bridging",
    "- **AUTH**: always call `supabase.auth.getUser()` on the server — never trust `getSession()` output for authorization",
    "- **RLS**: server handlers MUST use the anon-key client (auth-bound). Service-role is restricted to trusted server-only scripts (not API routes).",
    "- **Secrets**: never hardcode — use `process.env.*` and document in `.env.example`",
    "",
  ].join("\n");
}

function fastapiStackConventions() {
  return [
    "- FastAPI + asyncpg",
    "- Passwords hashed with `passlib[bcrypt]` (never MD5/SHA-1/SHA-256-naked)",
    "- SQL: **parameterized queries only** — never f-string/`%` interpolation",
    "- Session cookies: `httponly=True`, `secure=True`, `samesite=\"lax\"` or `strict`",
    "- Rate limiting: `slowapi` decorator on public endpoints",
    "- Secrets: `os.environ[...]` + `.env.example` — never hardcode",
    "",
  ].join("\n");
}

const HOOKS_TABLE_BASIC = [
  "| `secret-guard.sh` | PreToolUse (Write/Edit/MultiEdit) | API 키 / 토큰 하드코딩 차단 |",
  "| `pattern-guard.sh` | PreToolUse | `DELETE FROM` 무조건 `WHERE` / `eval()` / 기타 위험 패턴 차단 |",
  "| `protected-files.sh` | PreToolUse | `.env*` / 락파일 / CI 파일 변경 차단 |",
  "| `db-safety.sh` | PreToolUse | 마이그레이션 안전성 점검 |",
].join("\n");

function renderClaudeMd(template, stack) {
  const isNext = stack.includes("nextjs");
  return template
    .replaceAll("{{VERSION}}", "0.6.0-benchmark")
    .replaceAll("{{PROJECT_NAME}}", "Benchmark Project")
    .replaceAll(
      "{{STACK_SUMMARY}}",
      isNext
        ? "Next.js 14 (App Router) + Supabase (SSR/Auth/RLS)"
        : "FastAPI + PostgreSQL (asyncpg)",
    )
    .replaceAll("{{STACK_CONVENTIONS}}", isNext ? nextjsStackConventions() : fastapiStackConventions())
    .replaceAll("{{HOOKS_TABLE}}", HOOKS_TABLE_BASIC)
    .replaceAll("{{ENFORCEMENT_LEVEL}}", "strict")
    .replaceAll("{{VERIFY_AGENT_COUNT}}", "3")
    .replaceAll(/\{\{CONDITION:bugfix_debug\}\}/g, "")
    .replaceAll(/\{\{\/CONDITION:bugfix_debug\}\}/g, "")
    .replaceAll(/\{\{CONDITION:has_ui\}\}/g, isNext ? "" : "<!-- no UI -->")
    .replaceAll(/\{\{\/CONDITION:has_ui\}\}/g, isNext ? "" : "")
    // Simple catch-all: strip remaining {{ ... }} tokens
    .replaceAll(/\{\{[^}]+\}\}/g, "");
}

async function buildClaudeMdOnly(variant, stackFiles) {
  const dst = path.join(REFERENCE_DIR, `claude-md-only-${variant}`);
  if (existsSync(dst)) await rm(dst, { recursive: true, force: true });
  await mkdir(dst, { recursive: true });
  await writeFilesRecord(dst, stackFiles);
  const tpl = await readFile(path.join(TEMPLATES_DIR, "CLAUDE.md.template"), "utf8");
  await writeFile(path.join(dst, "CLAUDE.md"), renderClaudeMd(tpl, variant), "utf8");
  console.log("[seed] claude-md-only-" + variant + " → " + dst);
}

async function buildHarness(variant, stackFiles) {
  const dst = path.join(REFERENCE_DIR, `harness-${variant}`);
  if (existsSync(dst)) await rm(dst, { recursive: true, force: true });
  await mkdir(dst, { recursive: true });
  await writeFilesRecord(dst, stackFiles);

  // CLAUDE.md at project root
  const tpl = await readFile(path.join(TEMPLATES_DIR, "CLAUDE.md.template"), "utf8");
  await writeFile(path.join(dst, "CLAUDE.md"), renderClaudeMd(tpl, variant), "utf8");

  // .claude/skills/project-harness/ = templates/*.md + sub-skill dirs
  const skillsDst = path.join(dst, ".claude", "skills", "project-harness");
  await mkdir(skillsDst, { recursive: true });

  // Write SKILL.md from orchestrator.md (wizard convention)
  const orchestrator = await readFile(path.join(TEMPLATES_DIR, "orchestrator.md"), "utf8");
  await writeFile(path.join(skillsDst, "SKILL.md"), orchestrator, "utf8");

  // Copy major templates as sibling files (plan.md, implement.md, verify.md, etc.)
  for (const name of [
    "plan.md",
    "implement.md",
    "verify.md",
    "visual-qa.md",
    "debug.md",
    "classification.md",
    "codebase-analysis.md",
    "tdd-implementation.md",
    "parallel-execution.md",
    "progress-format.md",
    "ui-conventions.md",
    "handoff-templates.md",
    "schemas.md",
    "guide-injection.md",
    "monitor-mode.md",
    "fsd-scaffold-patterns.md",
    "ui-defect-patterns.md",
    "self-learning.md",
  ]) {
    const src = path.join(TEMPLATES_DIR, name);
    if (existsSync(src)) {
      await cp(src, path.join(skillsDst, name));
    }
  }

  // Hooks
  const hooksDst = path.join(dst, ".claude", "hooks");
  await mkdir(hooksDst, { recursive: true });
  const hooksSrc = path.join(TEMPLATES_DIR, "hooks");
  for (const f of await readdir(hooksSrc)) {
    const body = await readFile(path.join(hooksSrc, f), "utf8");
    // Strip .template suffix
    const outName = f.replace(/\.template$/, "");
    await writeFile(path.join(hooksDst, outName), body, "utf8");
  }

  // settings.json wires hooks
  const settings = {
    hooks: {
      PreToolUse: [
        {
          matcher: "Write|Edit|MultiEdit",
          hooks: [
            { type: "command", command: ".claude/hooks/secret-guard.sh" },
            { type: "command", command: ".claude/hooks/pattern-guard.sh" },
            { type: "command", command: ".claude/hooks/protected-files.sh" },
            { type: "command", command: ".claude/hooks/db-safety.sh" },
          ],
        },
      ],
    },
  };
  await writeFile(
    path.join(dst, ".claude", "settings.json"),
    JSON.stringify(settings, null, 2),
    "utf8",
  );

  console.log("[seed] harness-" + variant + " → " + dst);
}

async function main() {
  await mkdir(REFERENCE_DIR, { recursive: true });
  for (const variant of ["nextjs", "fastapi"]) {
    const files = variant === "nextjs" ? NEXTJS_FILES : FASTAPI_FILES;
    await buildClaudeMdOnly(variant, files);
    await buildHarness(variant, files);
  }
  console.log("[seed] done");
}

main().catch((e) => {
  console.error("[seed] fatal:", e);
  process.exit(1);
});
