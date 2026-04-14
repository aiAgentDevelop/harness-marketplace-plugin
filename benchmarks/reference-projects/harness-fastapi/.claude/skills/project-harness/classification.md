# Classification System

Shared classification rules used by the project-harness pipeline to detect task type and feature flags.
Referenced by: project-plan (Phase 0), project-implement (when --skip-plan), project-verify (standalone invocation).

All flag detection is driven by `project-config.yaml`. Technology-specific patterns below are
**replaced during generation** based on the project's actual platform and tech_stack values.

---

## Task Type Classification

When `--type` is explicitly specified, skip auto-classification.

| Type | Keywords / Patterns | Examples |
|------|---------------------|---------|
| **feature** | add, create, new, implement, build, introduce, make, generate | "Add user profile card" |
| **bugfix** | fix, bug, error, broken, crash, not working, failing, wrong, issue, repair | "Fix login 500 error" |
| **refactor** | refactor, split, extract, reorganize, cleanup, simplify, restructure, improve, decompose | "Split Dashboard component" |
| **config** | config, env, environment, dependency, package, setting, setup, install, upgrade | "Add ESLint rule" |

**Priority when multiple keywords match**: bugfix > feature > refactor > config

---

## Debug Complexity Assessment (bugfix only)

When `type == "bugfix"`, assess debug complexity to determine whether the debug phase runs.

| Complexity | Criteria | Debug Phase |
|------------|----------|-------------|
| **low** | Single keyword match (typo, missing import, syntax), <=1 file mentioned, error message is self-explanatory | Skip |
| **medium** | Multiple files involved, error requires tracing, stack trace mentioned, "not working" without clear cause | Full |
| **high** | Intermittent/flaky, concurrency/timing keywords, multi-service, "race condition", "deadlock", "sometimes" | Full |

### Detection Keywords

| Complexity | Keywords |
|------------|----------|
| low | typo, missing import, syntax error, undefined variable, wrong name, rename, spelling |
| medium | not working, failing test, wrong output, unexpected behavior, error in, broken, stack trace |
| high | intermittent, flaky, sometimes, race condition, deadlock, timeout, concurrency, multi-service, distributed |

### Escalation Rules

- If task mentions more than 3 files: minimum `medium`
- If task mentions "production" or "prod": minimum `medium`
- If task mentions "intermittent", "flaky", or "sometimes": always `high`
- If user provides a stack trace in the task description: parse depth → >5 levels = `high`, 2-5 = `medium`
- When `type != "bugfix"`: `debug_complexity = "none"` (debug phase never runs)

### Scoring Algorithm

```
score = 0

// Keyword analysis
if task mentions "intermittent|flaky|sometimes|random": score += 30
if task mentions "race condition|deadlock|concurrent": score += 30
if task mentions "multi-service|distributed|microservice": score += 20
if task mentions "production|prod|live": score += 10
if task mentions "typo|missing import|syntax": score -= 20
if task mentions "rename|spelling": score -= 20

// File scope analysis (from plan exploration if available)
files_involved = count of mentioned or affected files
if files_involved > 5: score += 20
elif files_involved > 2: score += 10

// Stack trace analysis (if provided in task description)
if stack_trace_depth > 7: score += 20
elif stack_trace_depth > 3: score += 10

// Determination
if score < 0: debug_complexity = "low"
elif score < 20: debug_complexity = "medium"
else: debug_complexity = "high"
```

---

## Flag Detection

Flags are derived from a combination of:
1. Keywords in the task description
2. File patterns in the changed/target files
3. Import patterns in modified files
4. Values already set in `project-config.yaml` flags section

### has_ui

Activates: ux-checker (implement), ux-reviewer + design-reviewer (verify), project-visual-qa phase.

| Source | Detection Criteria |
|--------|-------------------|
| Keywords | component, UI, page, screen, form, card, modal, dialog, layout, design, button, table, tab, view, widget, panel |
| File patterns | {{CONDITION:has_ui}} `*.tsx`, `*.jsx`, `*.vue`, `*.svelte` files in change set {{/CONDITION:has_ui}} |
| Config override | `flags.has_ui: true` in project-config.yaml |

### has_backend

Activates: security-checker (implement), backend-auditor (verify).

| Source | Detection Criteria |
|--------|-------------------|
| Keywords | API, endpoint, route, controller, service, middleware, server, handler, request, response |
| File patterns | {{GENERATED}} Patterns derived from `platform.backend.framework` value {{/GENERATED}} |
| Config override | `flags.has_backend: true` in project-config.yaml |

**Framework-specific file patterns (auto-generated during harness creation)**:

{{CONDITION:nestjs}}
- NestJS: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.guard.ts`, `*.interceptor.ts`, `src/server/**`
{{/CONDITION:nestjs}}

{{CONDITION:express}}
- Express/Fastify: `routes/**`, `controllers/**`, `middleware/**`, `*.router.ts`
{{/CONDITION:express}}

{{CONDITION:spring}}
- Spring: `*Controller.java`, `*Service.java`, `*Repository.java`, `src/main/**`
{{/CONDITION:spring}}

{{CONDITION:django}}
- Django/FastAPI: `views.py`, `urls.py`, `routers.py`, `**/api/**`
{{/CONDITION:django}}

### has_database

Activates: schema-explorer (plan), db-checker (implement), db-auditor (verify).

| Source | Detection Criteria |
|--------|-------------------|
| Keywords | database, schema, migration, query, table, index, model, entity, repository, ORM, SQL |
| File patterns | {{GENERATED}} Patterns derived from `platform.database.orm` value {{/GENERATED}} |
| Auto-activate | when has_backend=true AND migration files are in change set |
| Config override | `flags.has_database: true` in project-config.yaml |

**ORM-specific file patterns (auto-generated)**:

{{CONDITION:prisma}}
- Prisma: `prisma/schema.prisma`, `prisma/migrations/*.sql`
{{/CONDITION:prisma}}

{{CONDITION:typeorm}}
- TypeORM: `**/migrations/*.ts`, `**/entities/*.ts`
{{/CONDITION:typeorm}}

{{CONDITION:drizzle}}
- Drizzle: `drizzle/*.sql`, `**/schema.ts`
{{/CONDITION:drizzle}}

### has_cache

Activates: cache-related exploration and validation workers (when configured).

| Source | Detection Criteria |
|--------|-------------------|
| Keywords | cache, Redis, Memcached, TTL, eviction, invalidate, cached |
| File patterns | `**/cache/**`, `**/redis/**` |
| Config override | `flags.has_cache: true` in project-config.yaml |

### has_auth

Activates: auth-explorer (plan), auth-checker (implement), auth-auditor (verify).

| Source | Detection Criteria |
|--------|-------------------|
| Keywords | auth, authentication, authorization, login, logout, session, token, JWT, permission, role, access, guard, credential |
| File patterns | `**/auth/**`, `middleware.ts`, `**/guards/**`, `**/permissions/**` |
| Auto-activate | when has_backend=true AND auth-related keywords present |
| Config override | `flags.has_auth: true` in project-config.yaml |

### has_realtime

Activates: realtime-explorer (plan), realtime-checker (implement), realtime-auditor (verify).

| Source | Detection Criteria |
|--------|-------------------|
| Keywords | WebSocket, socket, realtime, real-time, SSE, event stream, live update, push, subscription |
| File patterns | `**/websocket/**`, `**/socket/**`, `**/sse/**`, `**/events/**` |
| Config override | `flags.has_realtime: true` in project-config.yaml |

### visual_qa_capable

Controls whether project-visual-qa phase is included in the pipeline.

| Source | Derivation Rule |
|--------|----------------|
| Auto-derived | `has_ui == true` AND `platform.frontend.framework` is browser-renderable |
| Browser-renderable | react, vue, angular, svelte, solid, nextjs, nuxt, remix, sveltekit |
| Not browser-renderable | native mobile (React Native), desktop native, CLI |
| Config override | `flags.visual_qa_capable: true/false` in project-config.yaml |

---

## Config-Agent Domain Flags

{{AGENTS_LIST}}

When an agent is selected in `project-config.yaml`, the harness checks whether the current
task touches the agent's domain. If so, the agent's workers are activated in plan/implement/verify.

Each agent entry in the marketplace catalog defines:
- `keywords`: task description patterns that trigger the agent
- `file_patterns`: file path patterns that indicate domain involvement
- `phases`: which pipeline phases the agent participates in (plan|implement|verify)

**Detection rule**: An agent is activated when ANY of the following are true:
1. Task description matches one or more of the agent's `keywords`
2. Changed/target files match one or more of the agent's `file_patterns`
3. `--full-audit` flag is set (force-activate all selected agents)

> If the agent's corresponding worker file does not exist in the project, the flag is silently skipped.

---

## Classification Output Format

```json
{
  "type": "feature|bugfix|refactor|config",
  "debug_complexity": "none|low|medium|high",
  "has_ui": true,
  "has_backend": true,
  "has_database": false,
  "has_cache": false,
  "has_auth": true,
  "has_realtime": false,
  "visual_qa_capable": true,
  "active_agents": ["security-auditor"]
}
```

**Progress output** (follows `progress-format.md` standard — pipe-separated key:value pairs, grouped into 3 lines):

```
🏷️ Classification complete / 분류 완료
   → type: feature | has_ui: true | has_backend: true | has_database: false
   → has_auth: true | has_realtime: false | visual_qa: enabled
   → debug: none | agents: security-auditor
```

**Output format rules** (enforced across all sub-skills):

1. First line: 🏷️ emoji + "Classification complete" header (language = wizard locale; bilingual acceptable in output)
2. Subsequent lines: indent with 3 spaces + `→` arrow
3. Each line groups related keys with `|` pipe separator and 1 space padding
4. Max 4-5 keys per line; wrap to new `→` line beyond that
5. Boolean flags: `key: true` / `key: false` (no `key=true` shorthand)
6. Skipped/inactive: `key: none` / `visual_qa: disabled`
7. Agents list: comma-separated after `agents:` prefix (if 0 agents, write `agents: none`)

---

## Override Rules

| Priority | Source | Notes |
|----------|--------|-------|
| 1 (highest) | `--type` flag | Skips type auto-detection entirely |
| 2 | `--full-audit` flag | Force-activates all conditional workers in verify |
| 3 | `--ui`, `--backend` flags | Manual flag activation |
| 4 | `project-config.yaml` flags section | Explicit project config |
| 5 | File pattern detection | From git diff or target file list |
| 6 (lowest) | Keyword detection | From task description |

---

## Customization During Generation

When the harness-marketplace plugin generates a project-harness skill set, this file is
customized with project-specific patterns. The following sections are replaced:

| Template Variable | Replaced With |
|-------------------|---------------|
| `{{CONDITION:nestjs}}` blocks | Included when `platform.backend.framework == nestjs` |
| `{{CONDITION:prisma}}` blocks | Included when `platform.database.orm == prisma` |
| `{{CONDITION:has_ui}}` blocks | Included when `flags.has_ui == true` |
| `{{AGENTS_LIST}}` | Generated table of selected agents and their domain patterns |
| `{{GENERATED}}` markers | Replaced with actual derived content |

The resulting file is a static, project-specific classification reference that documents
exactly which patterns trigger which workers for this project.
