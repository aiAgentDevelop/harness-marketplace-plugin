# harness-marketplace

[![Latest Release](https://img.shields.io/github/v/release/aiAgentDevelop/harness-marketplace-plugin?sort=semver&label=latest)](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases/latest)
[![License](https://img.shields.io/github/license/aiAgentDevelop/harness-marketplace-plugin)](./LICENSE)
[![Changelog](https://img.shields.io/badge/changelog-keep--a--changelog-brightgreen)](./CHANGELOG.md)

**Scaffolding wizard that generates project-specific development pipeline harness skills for Claude Code.**

Generate a complete AI-orchestrated development pipeline — classify → plan → [codebase-analysis] → [debug] → implement → [visual-qa] → verify — with **real parallel Fan-out/Fan-in workers**, code-level enforcement via hooks, CI/CD pipeline generation, idle auto-watch, and self-learning capabilities. Three wizard modes: AI-driven interview, manual selection, or auto-detection. A project-root `CLAUDE.md` is generated so `/project-harness` becomes the **default** working mode, not opt-in. One wizard, any project.

> **[한국어 (Korean)](./README-ko.md)**

---

## What It Does

```
/harness-marketplace:wizard
  │
  ├─ Choose wizard mode
  │   ├── Deep Interview — AI asks about your project, recommends full architecture
  │   ├── Manual — select each option step by step
  │   └── Auto-Detect — AI scans your existing code and detects the stack
  │
  ├─ Generates a full harness skill set
  │   ├── ./CLAUDE.md                  — project-root orchestration entrypoint guide
  │   ├── project-config.yaml          — master config driving everything
  │   ├── plan/SKILL.md                — planning phase (Fan-out + Reader)
  │   ├── codebase-analysis/SKILL.md   — Phase 2.5 pre-impl analysis (refactor auto-trigger)
  │   ├── debug/SKILL.md                — debug investigation phase (bugfix only)
  │   ├── implement/SKILL.md           — implementation phase (standard OR TDD strategy)
  │   ├── visual-qa/SKILL.md           — visual QA (if UI project)
  │   ├── verify/SKILL.md              — verification phase (all auditors parallel)
  │   ├── agents/*.md                  — AI-generated domain agents (34-agent catalog + supabase-security-gate)
  │   ├── guides/*.md                  — AI-generated development guides
  │   ├── hooks/*.sh                   — code enforcement via Claude Code hooks
  │   ├── hooks-config.json            — hook configuration for settings.json
  │   ├── .github/workflows/*.yml      — CI/CD pipelines + AI code review
  │   ├── state/learning-log.yaml      — self-learning history
  │   └── references/                  — shared UX + data contracts:
  │       ├── progress-format.md       — phase N/M + emoji + worker-tree standards
  │       ├── ui-conventions.md        — 3-option gates + completion summary
  │       ├── classification.md        — task classification rules
  │       ├── handoff-templates.md     — state/handoffs/*.md structure
  │       ├── schemas.md               — PlanResult/ImplementationResult/VerificationResult JSON
  │       ├── guide-injection.md       — worker → guide + agent-checklist mapping
  │       ├── monitor-mode.md          — /project-harness monitor idle auto-watch
  │       ├── parallel-execution.md    — Fan-out/Fan-in PARALLEL REQUIRED directive
  │       ├── tdd-implementation.md    — Red-Green-Refactor strategy (if enabled)
  │       ├── ui-defect-patterns.md    — static UI code review (if has_ui)
  │       └── fsd-scaffold-patterns.md — FSD boilerplate (if architecture=fsd)
  │
  └─ Validated & ready: type `/project-harness "task"` — CLAUDE.md routes Claude automatically
```

## Installation

```bash
/plugin marketplace add https://github.com/aiAgentDevelop/harness-marketplace-plugin.git
/plugin install harness-marketplace
```

> **Important:** After installation, you must **completely quit Claude Code and start a new session**. `/reload-plugins` reloads commands but does **not** reload skills due to a known bug ([#35641](https://github.com/anthropics/claude-code/issues/35641)). Without a full restart, `/harness-marketplace:wizard` will show `Unknown skill`.

Or install manually:

```bash
cp -r harness-marketplace/ ~/.claude/plugins/cache/harness-marketplace/harness-marketplace/1.0.0/
```

## Troubleshooting

### Skills don't appear in `/` auto-completion

If typing `/harness-marketplace:` does not show skills in the dropdown:

1. **Full session restart required** — `/reload-plugins` has a known bug ([#35641](https://github.com/anthropics/claude-code/issues/35641)) where it reloads commands but not skills. Close and reopen VS Code or restart the Claude Code CLI session entirely.

2. **Force reinstall** — If skills are still missing after restart:
   ```bash
   /plugin uninstall harness-marketplace
   /plugin install harness-marketplace
   ```
   Then fully restart the session.

3. **Manual invocation always works** — Even without auto-completion, typing the full command works:
   ```
   /harness-marketplace:wizard
   /harness-marketplace:upgrade
   /harness-marketplace:ci-cd
   /harness-marketplace:learn
   /harness-marketplace:gh
   ```

> **Note:** There are open Claude Code issues ([#18949](https://github.com/anthropics/claude-code/issues/18949), [#35641](https://github.com/anthropics/claude-code/issues/35641)) where marketplace plugin skills may not appear in auto-completion. This is a Claude Code runtime limitation, not a plugin bug. Full session restart is the most reliable workaround.

## Usage

### 5 Skills at a Glance

| Skill | Command | Purpose |
|-------|---------|---------|
| **Wizard** | `/harness-marketplace:wizard` | Generate a full harness from scratch |
| **Upgrade** | `/harness-marketplace:upgrade` | Update harness templates while preserving config |
| **CI/CD** | `/harness-marketplace:ci-cd` | Configure CI/CD pipelines independently |
| **Learn** | `/harness-marketplace:learn` | Save team-shared learnings to git-tracked files |
| **GH** | `/harness-marketplace:gh` | Automate GitHub workflow (Issue → Branch → PR) |

---

### Generate a new harness

```bash
/harness-marketplace:wizard
```

#### Three Wizard Modes

| Mode | Best for | How it works |
|------|----------|-------------|
| **Deep Interview** | New projects, unsure about tech choices | AI asks 3-5 questions about your project idea, then recommends the full architecture. You review and confirm. |
| **Manual Selection** | You know your stack | Select project type, language, DB, platform, and tech stack step by step. Optional project description enables AI recommendation labels. |
| **Auto-Detect** | Existing projects | AI scans your project files (package.json, configs, code structure) to detect the architecture and tech stack already in use. |

#### Deep Interview Example

```
Q1: "What are you building?"
→ "A SaaS dashboard for managing restaurant orders in real-time"

Q2: "Key features and expected scale?"
→ "Order management, live kitchen display, analytics. 500 restaurants."

Q3: "Constraints?"
→ "Small team, MVP in 2 months, must use Stripe."

AI Recommendation:
  Type: Web > SSR > SaaS Dashboard
  Language: TypeScript, Framework: Next.js
  DB: Supabase, Cache: Upstash Redis
  Platform: Vercel, Auth: Supabase Auth
  Stack: Tailwind, shadcn/ui, Zustand

  [Accept all] [Accept with modifications] [Switch to manual]
```

#### Auto-Detect Example

```
Scanning project...

Detected:
  Type: Web > SSR
  Language: TypeScript (from tsconfig.json)
  Framework: Next.js 14 (from package.json)
  DB: PostgreSQL via Prisma (from prisma/schema.prisma)
  Auth: NextAuth.js (from src/app/api/auth/)
  Stack: Tailwind, shadcn/ui
  Deployment: Vercel (from vercel.json)

  [Accept all] [Accept with modifications] [Switch to manual]
```

#### Wizard Steps (Manual Mode)

| Step | Question | Example Choices |
|------|----------|----------------|
| 0 | Language | English, 한국어 |
| 0.5 | Wizard mode | Deep Interview / Manual / Auto-Detect |
| 0.6 | Project description (optional) | Free text for AI recommendation labels |
| 1-1 | Project category | Web, Mobile, Backend, Desktop, Game, CLI, Data, IoT |
| 1-2 | Subcategory | SSR, SPA, SSG, Full-stack... |
| 1-3 | Purpose | E-commerce, SaaS, Dashboard... |
| 2 | Serverless? | Yes / No / Hybrid |
| 3 | Languages | TypeScript (Recommended), Python, Go... |
| 4 | Database | Supabase (Recommended), PostgreSQL, MongoDB... |
| 5 | Cache | Redis, Upstash, CDN, None |
| 6 | Platform | Vercel, AWS, Railway, Docker... |
| 7 | Tech stack | Tailwind, shadcn/ui, FSD, Turborepo... (multi-select) |
| 8+ | Conditional | Auth method, state management... (varies by project type) |
| E1 | Enforcement level | Strict / Standard / Minimal / None |
| E2 | Protected files | .env, lock files, migrations... (multi-select) |
| E3 | Custom rules | "No direct SQL in service layer"... (free text, strict only) |
| C1 | CI/CD platform | GitHub Actions / GitLab CI / None / Configure later |
| C2 | Pipelines | CI, AI Code Review, Deploy, Security... (multi-select) |
| C3 | AI review config | Comment only / Block on critical / Auto-approve |
| L1 | Self-learning | With approval / Automatic / Disabled |
| A | Agents | security-reviewer, performance-auditor, game-economy-auditor... (25 catalog, multi-select) |
| G | Guides | api-design, database-design, game-design... (18 catalog, multi-select) |

When a project description is provided (manual mode) or interview is used, AI tags the best options with `(Recommended — reason)` labels. All options are still shown.

---

### Upgrade an existing harness

> 📖 **Full step-by-step guide: [UPGRADE.md](./UPGRADE.md)**

Upgrading is **two steps, in order**:

**Step 1 — Update the plugin itself** (once per release):

```
/plugin          # inside Claude Code → Marketplaces → harness-marketplace
                 # → Update marketplace, then Update plugin → restart Claude Code
```

Skipping this step is the #1 reason `/upgrade` reports "already on the latest version" — the cached plugin (e.g. v0.3.0) compares itself to itself.

**Step 2 — Upgrade each project's harness** (once per project per release):

```bash
cd <your-project>
/harness-marketplace:upgrade
```

The upgrade skill auto-fetches the latest templates from GitHub (v0.4.0+), preserves your `project-config.yaml`, hook Custom Rules, and `learning-log.yaml`, and writes a timestamped backup to `.claude/backups/project-harness-{timestamp}/`. Use `--offline` to force the local plugin cache, `--preview` to see the plan without applying, `--backup-only` to snapshot without upgrading.

**Legacy v1.x hook auto-migration** (since v0.5.1): if the upgrade detects that your project was generated against the old v1.x hook contract (silent no-ops under Claude Code v2.x — see [#16](https://github.com/aiAgentDevelop/harness-marketplace-plugin/issues/16)), the entire `hooks/` directory is replaced with the v2.x format. Your old hooks live in the backup; copy any Custom Rules manually from there. The upgrade will also offer to replace the hook entries in `.claude/settings.json` — **accept this**, otherwise Claude Code won't actually register the new hooks.

**Verify** after a completed upgrade:

```bash
claude --debug-file /tmp/d.log      # start and immediately Ctrl+C
grep "Registered.*hooks" /tmp/d.log # expect N > 0
```

See [UPGRADE.md](./UPGRADE.md) for the full flow, troubleshooting (e.g. "Registered 0 hooks", backup-as-duplicate-skill), end-to-end verification, and rollback steps.

---

### Configure CI/CD independently

```bash
/harness-marketplace:ci-cd
```

Configure or reconfigure CI/CD pipelines without re-running the full wizard. Works on projects that deferred CI/CD setup or want to change their pipeline configuration.

---

### Save and share team learnings

```bash
/harness-marketplace:learn "plugin.json skills field must not be removed"
/harness-marketplace:learn --consolidate
```

Record development learnings (problems, causes, solutions) to git-tracked files under `.harness/learnings/`. Team members share knowledge via `git pull`.

**How it works:**

```
.harness/learnings/
├── INDEX.md                                  ← Always loaded, one-line summaries (≤200 lines)
├── 20260409-143022-scott-plugin-config.md    ← Individual learning (≤50 lines)
├── 20260410-091200-john-git-workflow.md
└── archive/                                  ← Originals after consolidation
```

- **Conflict-free**: Timestamp + author in filenames prevents team collisions
- **Size-managed**: INDEX.md stays under 200 lines; `--consolidate` merges duplicates
- **Optional hook proposals**: AI can suggest hook rules to prevent recurrence
- **Git commit with approval**: Never auto-pushes

---

### GitHub workflow automation

```bash
/harness-marketplace:gh "fix wizard Korean label typo"
/harness-marketplace:gh --no-issue "update README"
/harness-marketplace:gh --draft "add authentication"
```

Automates Issue → Branch → Commit → PR workflow:

```
/harness-marketplace:gh "description"
  │
  ├─ Step 1: Create GitHub Issue (user approves title/body)
  ├─ Step 2: Create feature branch (fix/4-description-slug)
  ├─ Step 3: Make changes (self, with AI help, or already done)
  ├─ Step 4: Commit (user approves message)
  ├─ Step 5: Push & Create PR (user approves)
  └─ Step 6: STOP — PR URL presented, merge is user's responsibility
```

- **Every step requires approval** — nothing is auto-executed
- **Never merges PRs** — always stops after PR creation
- **Flags**: `--no-issue` skips issue creation, `--draft` creates draft PR

---

### Use the generated harness

After wizard completes, a **project-root `CLAUDE.md`** is generated that instructs Claude Code to route non-trivial work through `/project-harness`. This makes AI orchestration the **default working mode** — new features, bugfixes, and refactors automatically flow through the full plan → implement → verify pipeline.

```bash
/project-harness "implement user authentication"
/project-harness --dry-run "add payment integration"
/project-harness --resume
```

The generated `CLAUDE.md` contains:
- Orchestration entrypoint guide (when to use `/project-harness`, when it's OK to skip)
- Hook enforcement table (active security / quality guards)
- Stack conventions (from selected guides)
- Component location map (`.claude/skills/project-harness/{plan,implement,verify,...}/`)
- **`## Custom Rules` section** — your team's project-specific rules, preserved across `/harness-marketplace:upgrade` via HTML-comment markers

If a `CLAUDE.md` already exists at project root, the wizard asks whether to (a) merge only the GENERATED region, (b) backup and fully replace, or (c) skip.

---

## Four Layers Beyond Markdown

### Layer 1: Hook-based Code Enforcement

Claude Code hooks that **prevent mistakes before they happen** — not just guidelines for agents to follow, but code-level guards that block or auto-fix in real time.

| Hook | Event | What it does |
|------|-------|-------------|
| Protected files | PreToolUse | Blocks editing .env, lock files, applied migrations |
| DB safety | PreToolUse | Blocks dangerous SQL (DROP TABLE, TRUNCATE, DELETE without WHERE) |
| Secret guard | PreToolUse | Prevents hardcoded credentials in source code |
| Pattern guard | PreToolUse | Enforces architecture rules (FSD layers, repository pattern, custom rules) |
| Auto lint | PostToolUse | Runs linter after every file edit |
| Auto typecheck | PostToolUse | Runs typecheck after every .ts/.tsx edit |
| Auto format | PostToolUse | Runs formatter after every file edit |
| Session init | SessionStart | Loads project context and verifies environment on startup |

**Enforcement levels:**

| Level | What's active |
|-------|--------------|
| **Strict** | All hooks: protected files, lint, typecheck, format, patterns, secrets, DB safety |
| **Standard** | Core hooks: protected files, lint, typecheck, secrets |
| **Minimal** | Protected files only |
| **None** | No hooks — markdown-only harness |

### Layer 2: CI/CD Pipeline Generation

Generates real CI/CD workflow files. Can be configured during wizard or independently via `/harness-marketplace:ci-cd`.

| Pipeline | Trigger | Description |
|----------|---------|-------------|
| **CI** | push, PR | Test + lint + typecheck + build |
| **AI Code Review** | PR | Claude API reviews diffs, posts comments, optionally blocks merge |
| **Deploy Preview** | PR | Preview environments per PR (Vercel, Netlify, Railway, Fly.io) |
| **Deploy Production** | push to main | Auto-deploy to production (Vercel, AWS, Docker, etc.) |
| **Security Scan** | weekly, PR | Dependency audit + secret scanning + CodeQL analysis |

**Supported platforms:** GitHub Actions, GitLab CI

### Layer 3: Self-Learning

The harness **evolves over time** by learning from mistakes during the implement and verify phases:

```
AI makes mistake → Regression detected → Fix applied →
  Self-learning engine:
    ├── Classifies root cause
    ├── Proposes hook rule + guide note
    └── User approves → Applied
  → Same mistake can never happen again
```

### Layer 4: Debug Investigation Phase

For bugfix tasks, a **systematic debug phase** runs between plan and implement — replacing guesswork with parallel investigation:

```
/project-harness "fix login 500 error"
  │
  ├─ plan (explore + design)
  │
  ├─ debug (only for bugfix, skipped for simple bugs)
  │   ├── Reproduce error → capture stack trace + output
  │   ├── Generate 3-5 hypotheses ranked by likelihood
  │   ├── Parallel investigation (4 agents simultaneously):
  │   │   ├── root-cause-analyst — tests top hypotheses against code
  │   │   ├── error-trace-mapper — maps stack trace + git blame
  │   │   ├── impact-analyzer — searches codebase for same pattern
  │   │   └── runtime-inspector — captures variable state at failure
  │   ├── Git bisection (for complex bugs when needed)
  │   └── Evidence → DebugResult with confirmed root cause
  │
  ├─ implement (guided by DebugResult → targeted fix + impact fixes)
  └─ verify
```

**Smart routing** — simple bugs (typo, missing import) skip the debug phase. Complex bugs (race condition, intermittent, multi-file) get full investigation. Controlled by `debug_complexity` scoring (low/medium/high).

---

## How It Works

### Hybrid Generation

| Component | Method | Source |
|-----------|--------|--------|
| SKILL.md files (orchestrator, plan, debug, implement, verify) | **Template** | `templates/*.md` |
| project-config.yaml | **Mapped** | Wizard answers → YAML schema |
| Hook scripts (hooks/*.sh) | **Template** | `templates/hooks/*.sh.template` |
| CI/CD workflows (.github/workflows/*.yml) | **Template** | `templates/ci-cd/github-actions/*.yml.template` |
| agents/*.md | **AI Generated** | Claude generates project-specific agent checklists from data/agents.yaml catalog (34 agents) |
| guides/*.md | **AI Generated** | Claude generates project-specific development guides from data/guides.yaml catalog (18 guides) |
| classification.md | **AI Generated** | Project-specific classification rules |

### Config-Driven Pipeline

The generated `project-config.yaml` drives everything:

```yaml
context:                  # Wizard mode and project description
  wizard_mode: interview
  project_description: "SaaS dashboard for restaurant order management..."

project_type:
  category: "web"
  subcategory: "ssr"
  purpose: "e-commerce"

platform:
  frontend:
    framework: "nextjs"
  backend:
    framework: "nestjs"
  database:
    primary: "postgresql"
    serverless_db: "supabase"
  deployment:
    platform: "vercel"

flags:                    # Auto-derived
  has_ui: true
  has_backend: true
  has_database: true
  visual_qa_capable: true

enforcement:              # Layer 1 — Code enforcement
  level: standard
  protected_files: ["**/.env*", "package-lock.json"]

ci_cd:                    # Layer 2 — CI/CD pipelines
  platform: github-actions
  pipelines:
    - type: ci
      enabled: true
    - type: ai-review
      enabled: true

self_learning:            # Layer 3 — Self-learning
  enabled: true
  mode: approval
  max_auto_rules: 20
```

### Supported Project Types

| Category | Subcategories | Example Purposes |
|----------|--------------|-----------------|
| **Web** | SPA, SSR, SSG, Full-stack, PWA, MPA | E-commerce, SaaS, Blog, Dashboard |
| **Mobile** | Native iOS/Android, Cross-platform, Hybrid | Social, Fintech, Health, Delivery |
| **Backend** | REST, GraphQL, gRPC, Microservice, Monolith | API Service, Data Pipeline, Auth |
| **Desktop** | Electron, Tauri, Native | Productivity, Media, Dev Tools |
| **Game** | 2D, 3D, Server, Casual, TCG | RPG, Puzzle, Multiplayer, Casino |
| **CLI** | CLI Tool, SDK, Library, Framework | Build Tool, Linter, Generator |
| **Data** | ML Pipeline, ETL, Analytics, Chatbot | Prediction, NLP, Visualization |
| **IoT** | Embedded, Edge, Gateway, Smart Home | Monitoring, Automation, Wearable |

---

## Plugin Structure

```
harness-marketplace/
├── .claude-plugin/
│   ├── plugin.json                # Plugin manifest (skills path declaration)
│   └── marketplace.json           # Marketplace metadata
├── skills/
│   ├── wizard/SKILL.md            # Main wizard (3 modes: interview, manual, auto-detect)
│   ├── upgrade/SKILL.md           # Harness upgrade (preserves Custom Rules + learning log)
│   ├── ci-cd/SKILL.md             # Standalone CI/CD configuration
│   ├── learn/SKILL.md             # Team-shared learnings (git-tracked knowledge base)
│   └── gh/SKILL.md                # GitHub workflow automation (Issue → Branch → PR)
├── templates/                     # Harness skeleton templates
│   ├── orchestrator.md            # Pipeline orchestrator
│   ├── plan.md                    # Planning phase (with Reader/Fan-in pattern)
│   ├── debug.md                   # Debug investigation phase (bugfix only)
│   ├── implement.md               # Implementation phase (with Learning Loop)
│   ├── visual-qa.md               # Visual QA phase
│   ├── verify.md                  # Verification phase (Learning Loop + Failure Tiers BLOCK/WARN/INFO)
│   ├── self-learning.md           # Self-learning engine
│   ├── CLAUDE.md.template         # Project-root orchestration guide (written to ./CLAUDE.md)
│   ├── progress-format.md         # Reference: phase N/M + emoji status + worker tree standards
│   ├── ui-conventions.md          # Reference: 3-option confirmation gates + completion summary schema
│   ├── handoff-templates.md       # Reference: state/handoffs/{plan,debug,exec,verify}.md structure
│   ├── schemas.md                 # Reference: JSON schemas for PlanResult/ImplementationResult/VerificationResult
│   ├── guide-injection.md         # Reference: worker → guide + agent checklist mapping
│   ├── monitor-mode.md            # Reference: /project-harness monitor (CronCreate-based idle auto-watch)
│   ├── parallel-execution.md      # Reference: Fan-out/Fan-in PARALLEL REQUIRED directive (single-message multi-Task pattern)
│   ├── codebase-analysis.md       # Sub-skill: Phase 2.5 pre-impl analysis (arch/design/deps/impact)
│   ├── tdd-implementation.md      # Reference: Red-Green-Refactor strategy for project-implement (conditional)
│   ├── ui-defect-patterns.md      # Reference: static UI code review (8 defect patterns, conditional: has_ui)
│   ├── fsd-scaffold-patterns.md   # Reference: FSD entity/feature/widget boilerplate (conditional: architecture=fsd)
│   ├── config-schema.yaml         # Config schema (context, enforcement, ci_cd, self_learning)
│   ├── classification.md          # Task classification rules (with debug complexity)
│   ├── hooks/                     # Hook script templates (8 scripts + config + 2 v2.x helpers)
│   │   ├── _parse.sh              # Shared: stdin JSON → TOOL_FILE_PATH/TOOL_CONTENT/TOOL_COMMAND
│   │   ├── _log.sh                # Shared: log_block helper (writes .claude/hook-blocks.log)
│   │   ├── *.sh.template          # 8 hook templates (read stdin, exit 2 to block)
│   │   └── hooks-config.json.template
│   └── ci-cd/                     # CI/CD workflow templates
│       └── github-actions/        # 5 workflow templates
├── data/                          # Deep-researched option datasets (14 files)
├── scripts/
│   ├── validate-harness.js        # Full validation (structure, hooks, CI/CD, self-learning)
│   └── merge-hooks.js             # Non-destructive settings.json hook merger
├── benchmarks/                    # Phase 0.5 fair 3-layer evaluation (harness effectiveness study)
│   ├── README.md                  # 3-layer methodology + honesty safeguards
│   ├── PROTOCOL.md                # Pre-registered hypotheses, metrics, decision rules
│   ├── tasks/                     # 10 tasks across security/orchestration/pipeline
│   ├── reference-projects/        # Seed projects + harness overlays
│   ├── runner/                    # Multi-phase runner (invoke/control/treatment/probe/batch)
│   ├── scorer/                    # Automated + 7-dim LLM judge + aggregate
│   └── results/                   # phase05-report.md, scored/, aggregated.json
├── CHANGELOG.md                   # Version history
├── CLAUDE.md                      # Project instructions
├── LICENSE                        # Apache-2.0
├── NOTICE                         # Attribution
├── package.json
├── README.md
├── README-ko.md
├── UPGRADE.md                     # Step-by-step upgrade guide (EN)
└── UPGRADE-ko.md                  # Step-by-step upgrade guide (KO)
```

## Requirements

- **Claude Code** with Agent Teams enabled (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)

## Benchmarks (Phase 1 v2 — End-to-End, ISO/IEC 25010 + OWASP ASVS + DORA)

End-to-end empirical evaluation of `Plain Claude Code` vs `harness-marketplace` (v0.6.0 wizard output) grounded in international standards (ISO/IEC 25010, OWASP ASVS v4.0.3, OWASP Top 10 2021, CWE Top 25, DORA, HELM principles). Replaces the earlier Phase 0.5 single-task design (accessible via git history at commit `a455abe`).

**Design**: 13-axis weighted scoring (total 100%) across 3 conditions × 17 OWASP adversarial tasks + 12 multi-step sprint cells (8 sequential steps each, state carry-over). Pre-registered [`PROTOCOL-v2.md`](./benchmarks/PROTOCOL-v2.md) frozen before any runs collected.

### Headline result (Pilot + Slim, 198 effective units, $63.78)

| Condition | Weighted Total | Notes |
|---|---:|---|
| `bare_claude` (no plugin) | 83.0 | baseline |
| **`claude_md_only`** (CLAUDE.md only, no skills/hooks) | **88.1 ← winner** | wizard-generated CLAUDE.md alone |
| `full_harness` (v0.6.0 wizard output) | 86.8 | full skills + hooks + agents |

The **wizard-generated `CLAUDE.md`** is the load-bearing orchestration artifact. The skills/hooks/agents layer adds measurable polish on three axes:

| Axis | bare | cmo | harness | Winner |
|---|---:|---:|---:|---|
| **Perf — Cost** (sequential work) | 83 | 81 | **84** | full_harness |
| **Compatibility** (scope discipline) | 89 | 92 | **97** | full_harness |
| **Usability** (judge rubric) | 54 | 58 | **62** | full_harness |

But `claude_md_only` wins on Functional Suitability (86 vs 82), Security ASVS L2 (77 vs 69), CWE-weighted defects (99 vs 99 tie), Maintainability (96 vs 96 tie), Wall-time (88 vs 87), DORA Lead Time (93 vs 91).

**Honest interpretation**: most of the harness's measurable lift comes from the wizard-generated CLAUDE.md (which `bare_claude` doesn't have). The runtime hooks/skills add genuine value on polish axes but do not move the security needle in this benchmark configuration — agents already self-align via CLAUDE.md conventions before runtime hooks need to fire (avg 0.1 hook BLOCK/run on harness condition).

**Zero regressions** observed across 96 sequential sprint steps (all conditions). The harness's regression-loop never had anything to catch.

### Decision evaluation (per PROTOCOL-v2 §7)

| Hypothesis | Pilot | Slim |
|---|---|---|
| H1 (Security ASVS gap ≥ 15) | ❌ +3 NOT met | ❌ +3 NOT met |
| H3 (Weighted total gap ≥ 5) | ❌ +3.9 NOT met | ❌ +3.8 NOT met |
| H5 (cmo between bare & harness) | ❌ INVERTED | ❌ INVERTED |

Both stages agree: the plugin's measurable impact is dominated by its wizard-generated CLAUDE.md, not by the runtime skills/hooks layer. Adopt the plugin for the orchestration scaffolding; expect skills/hooks to add Compatibility / Usability / Perf-Cost polish on multi-step lifecycle work.

```bash
# Run the benchmark (resumable, dedup via summary.json existence check)
cd benchmarks && npm install
node scorer/aggregate-v2.js --verify-weights      # asserts 13 axes total 100%
node scorer/verify-blinding.js                    # asserts judge prompt clean of condition labels
node runner/render-seeds.js                       # build reference-projects/{claude-md-only,harness}-{nextjs,fastapi}/
node runner/batch.js --stage pilot --concurrency 2 --limit 25  # OWASP A2 chunks
node runner/batch.js --stage slim --concurrency 2 --limit 4    # sprint chunks
node scorer/judge-batch.js --stage slim --concurrency 3        # blind LLM judge
node scorer/aggregate-v2.js --stage slim                       # produce reports/slim-report.md
```

See [`benchmarks/README.md`](./benchmarks/README.md) for layout, [`benchmarks/PROTOCOL-v2.md`](./benchmarks/PROTOCOL-v2.md) for pre-registered hypotheses + decision rules, and [`benchmarks/reports/slim-report.md`](./benchmarks/reports/slim-report.md) for the full 13-axis matrix, per-task ASVS breakdown, and "where harness loses" honesty section.

## Version History

See [**GitHub Releases**](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases) for the full release page (tags, source tarballs, and formatted release notes) or [`CHANGELOG.md`](./CHANGELOG.md) for the in-repo changelog.

Notable releases:

| Version | Highlight |
|---------|-----------|
| [**v0.5.2**](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases/tag/v0.5.2) | upgrade skill & validate-harness polish (bugs found in post-v0.5.1 field test) |
| [v0.5.1](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases/tag/v0.5.1) | upgrade skill auto-migrates legacy v1.x hooks |
| [v0.5.0](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases/tag/v0.5.0) | ⚠️ BREAKING — hook templates migrated to Claude Code v2.x (stdin JSON + exit 2) |
| [v0.4.0](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases/tag/v0.4.0) | Agent/guide catalogs + debug phase for bugfix pipeline |
| [v0.3.0](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases/tag/v0.3.0) | `learn` and `gh` skills for team knowledge sharing |
| [v0.2.0](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases/tag/v0.2.0) | Three wizard modes + three-layer pipeline system |
| [v0.1.0](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases/tag/v0.1.0) | Initial release |

**Upgrading from v0.4.x or earlier?** v0.5.0 is a breaking hook contract migration. After updating the plugin, run `/harness-marketplace:upgrade` in each project — v0.5.1+ auto-detects legacy v1.x hooks and replaces them with the v2.x format (your old hooks are preserved in a timestamped backup).

## Acknowledgments

Special thanks to In-gyo Jung.

## License

Apache-2.0 — See [LICENSE](./LICENSE) for details.
