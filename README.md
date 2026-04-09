# harness-marketplace

**Scaffolding wizard that generates project-specific development pipeline harness skills for Claude Code.**

Generate a complete development pipeline — plan, implement, visual-qa, verify — with code-level enforcement via hooks, CI/CD pipeline generation, and self-learning capabilities. Three wizard modes: AI-driven interview, manual selection, or auto-detection from existing code. One wizard, any project.

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
  │   ├── project-config.yaml       — master config driving everything
  │   ├── plan/SKILL.md             — planning phase
  │   ├── implement/SKILL.md        — implementation phase
  │   ├── visual-qa/SKILL.md        — visual QA (if UI project)
  │   ├── verify/SKILL.md           — verification phase
  │   ├── agents/*.md               — AI-generated domain agents
  │   ├── guides/*.md               — AI-generated development guides
  │   ├── hooks/*.sh                — code enforcement via Claude Code hooks
  │   ├── hooks-config.json         — hook configuration for settings.json
  │   ├── .github/workflows/*.yml   — CI/CD pipelines + AI code review
  │   ├── state/learning-log.yaml   — self-learning history
  │   └── references/               — classification, schemas, options
  │
  └─ Validated & ready to use via /project-harness
```

## Installation

```bash
/plugin marketplace add https://github.com/DONGWAN-LEE/harness-marketplace-plugin.git
/plugin install harness-marketplace
/reload-plugins
```

> **Note:** After installation, you must run `/reload-plugins` to load the new skills into the current session. Without this step, running `/harness-marketplace:wizard` will show `Unknown skill`.

Or install manually:

```bash
cp -r harness-marketplace/ ~/.claude/plugins/cache/harness-marketplace/harness-marketplace/1.0.0/
```

## Troubleshooting

### Skills don't appear in `/` auto-completion

If typing `/harness-marketplace:` does not show wizard, upgrade, and ci-cd in the dropdown:

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
   ```

> **Note:** There are open Claude Code issues ([#18949](https://github.com/anthropics/claude-code/issues/18949), [#35641](https://github.com/anthropics/claude-code/issues/35641)) where marketplace plugin skills may not appear in auto-completion. This is a Claude Code runtime limitation, not a plugin bug. Full session restart is the most reliable workaround.

## Usage

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

#### Manual Mode Steps

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
| A | Agents | security-reviewer, performance-auditor... (multi-select) |
| G | Guides | api-design, database-design... (multi-select) |

When a project description is provided (manual mode) or interview is used, AI tags the best options with `(Recommended — reason)` labels. All options are still shown.

### Upgrade an existing harness

```bash
/harness-marketplace:upgrade
```

Preserves your `project-config.yaml`, hook Custom Rules, and `learning-log.yaml` while updating template-based skill files to the latest version.

### Save and share team learnings

```bash
/harness-marketplace:learn "plugin.json skills field must not be removed"
/harness-marketplace:learn --consolidate
```

Record development learnings (problems, causes, solutions) to git-tracked files under `.harness/learnings/`. Team members share knowledge via `git pull`. Optionally proposes hook rules to prevent recurrence. Use `--consolidate` to merge duplicates when INDEX.md grows large.

### GitHub workflow automation

```bash
/harness-marketplace:gh "fix wizard Korean label typo"
/harness-marketplace:gh --no-issue "update README"
/harness-marketplace:gh --draft "add authentication"
```

Automates Issue → Branch → Commit → PR workflow with user approval at every step. PR merge is never performed automatically.

### Configure CI/CD independently

```bash
/harness-marketplace:ci-cd
```

Configure or reconfigure CI/CD pipelines without re-running the full wizard. Works on projects that deferred CI/CD setup or want to change their pipeline configuration.

### Use the generated harness

```bash
/project-harness "implement user authentication"
/project-harness --dry-run "add payment integration"
/project-harness --resume
```

---

## Three Layers Beyond Markdown

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
| **None** | No hooks — markdown-only harness (v0.1.0 compatible) |

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

---

## How It Works

### Hybrid Generation

| Component | Method | Source |
|-----------|--------|--------|
| SKILL.md files (orchestrator, plan, implement, verify) | **Template** | `templates/*.md` |
| project-config.yaml | **Mapped** | Wizard answers → YAML schema |
| Hook scripts (hooks/*.sh) | **Template** | `templates/hooks/*.sh.template` |
| CI/CD workflows (.github/workflows/*.yml) | **Template** | `templates/ci-cd/github-actions/*.yml.template` |
| agents/*.md | **AI Generated** | Claude generates project-specific agent checklists |
| guides/*.md | **AI Generated** | Claude generates project-specific development guides |
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
│   ├── plan.md                    # Planning phase
│   ├── implement.md               # Implementation phase (with Learning Loop)
│   ├── visual-qa.md               # Visual QA phase
│   ├── verify.md                  # Verification phase (with Learning Loop)
│   ├── self-learning.md           # Self-learning engine
│   ├── config-schema.yaml         # Config schema (context, enforcement, ci_cd, self_learning)
│   ├── classification.md          # Task classification rules
│   ├── hooks/                     # Hook script templates (8 scripts + config)
│   └── ci-cd/                     # CI/CD workflow templates
│       └── github-actions/        # 5 workflow templates
├── data/                          # Deep-researched option datasets (11 files)
├── scripts/
│   ├── validate-harness.js        # Full validation (structure, hooks, CI/CD, self-learning)
│   └── merge-hooks.js             # Non-destructive settings.json hook merger
├── CLAUDE.md                      # Project instructions
├── LICENSE                        # Apache-2.0
├── NOTICE                         # Attribution
├── package.json
├── README.md
└── README-ko.md
```

## Requirements

- **Claude Code** with Agent Teams enabled (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)

## License

Apache-2.0 — See [LICENSE](./LICENSE) for details.
