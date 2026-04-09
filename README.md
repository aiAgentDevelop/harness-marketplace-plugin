# harness-marketplace

**Scaffolding wizard that generates project-specific development pipeline harness skills for Claude Code.**

Generate a complete development pipeline — plan, implement, visual-qa, verify — with code-level enforcement via hooks, CI/CD pipeline generation, and self-learning capabilities. Tailored to your project's type, tech stack, and deployment target. One wizard, any project.

> **[한국어 (Korean)](./README-ko.md)**

---

## What It Does

```
/harness-marketplace:wizard
  │
  ├─ Step-by-step questions about your project
  │   (type, language, DB, platform, tech stack,
  │    enforcement, CI/CD, self-learning...)
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
/plugin marketplace add <repo-url>
/plugin install harness-marketplace
```

Or install manually:

```bash
cp -r harness-marketplace/ ~/.claude/plugins/cache/harness-marketplace/harness-marketplace/1.0.0/
```

## Usage

### Generate a new harness

```bash
/harness-marketplace:wizard
```

The wizard will ask you questions one at a time:

| Step | Question | Example Choices |
|------|----------|----------------|
| 0 | Language | English, 한국어 |
| 1-1 | Project category | Web, Mobile, Backend, Desktop, Game, CLI, Data, IoT |
| 1-2 | Subcategory | SSR, SPA, SSG, Full-stack... |
| 1-3 | Purpose | E-commerce, SaaS, Dashboard... |
| 2 | Serverless? | Yes / No / Hybrid |
| 3 | Languages | TypeScript, Python, Go... (multi-select) |
| 4 | Database | Supabase, PostgreSQL, MongoDB... |
| 5 | Cache | Redis, Upstash, CDN, None |
| 6 | Platform | Vercel, AWS, Railway, Docker... |
| 7 | Tech stack | Tailwind, shadcn/ui, FSD, Turborepo... (multi-select) |
| 8+ | Conditional | Auth method, state management... (varies by project type) |
| E1 | Enforcement level | Strict / Standard / Minimal / None |
| E2 | Protected files | .env, lock files, migrations... (multi-select) |
| E3 | Custom rules | "No direct SQL in service layer"... (free text, strict only) |
| C1 | CI/CD platform | GitHub Actions / GitLab CI / None |
| C2 | Pipelines | CI, AI Code Review, Deploy, Security... (multi-select) |
| C3 | AI review config | Comment only / Block on critical / Auto-approve |
| L1 | Self-learning | With approval / Automatic / Disabled |
| A | Agents | security-reviewer, performance-auditor... (multi-select) |
| G | Guides | api-design, database-design... (multi-select) |

After all questions: generates files → validates structure (including hooks + CI/CD) → runs plan dry-run → merges hooks into settings.json → asks for confirmation.

### Upgrade an existing harness

```bash
/harness-marketplace:upgrade
```

Preserves your `project-config.yaml`, hook Custom Rules, and `learning-log.yaml` while updating template-based skill files to the latest version.

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

Hook scripts use an **upgrade-safe** two-section structure:
- **Generated Rules** — overwritten on upgrade
- **Custom Rules** — preserved on upgrade (where self-learning adds rules)

### Layer 2: CI/CD Pipeline Generation

Generates real CI/CD workflow files based on your project config:

| Pipeline | Trigger | Description |
|----------|---------|-------------|
| **CI** | push, PR | Test + lint + typecheck + build |
| **AI Code Review** | PR | Claude API reviews diffs, posts comments, optionally blocks merge |
| **Deploy Preview** | PR | Preview environments per PR (Vercel, Netlify, Railway, Fly.io) |
| **Deploy Production** | push to main | Auto-deploy to production (Vercel, AWS, Docker, etc.) |
| **Security Scan** | weekly, PR | Dependency audit + secret scanning + CodeQL analysis |

**Supported platforms:** GitHub Actions, GitLab CI

**AI Code Review** uses the Claude API to:
1. Get the PR diff
2. Review for logic bugs, security vulnerabilities, performance issues, and code quality
3. Post review comments with severity ratings (CRITICAL / WARNING / INFO)
4. Optionally block merge on critical issues

### Layer 3: Self-Learning

The harness **evolves over time** by learning from mistakes during the implement and verify phases:

```
AI makes mistake during implementation
  → Regression detected in verify phase
  → Fix applied
  → Self-learning engine activates:
      ├── Classifies root cause (PATTERN_VIOLATION, UNSAFE_OPERATION, CONVENTION_BREAK, ...)
      ├── Drafts prevention rule (if auto-detectable)
      ├── Proposes: hook rule addition + guide note
      └── User approves (or auto-applied in automatic mode)
  → Hook script updated (Custom Rules section)
  → Guide updated (Lessons Learned section)
  → Learning log entry added (state/learning-log.yaml)
  → Same mistake can never happen again
```

**Self-learning modes:**

| Mode | Behavior |
|------|----------|
| **Approval** (recommended) | AI proposes new rules, user approves via AskUserQuestion |
| **Automatic** | AI applies rules automatically, logs everything |
| **Disabled** | Static harness, no evolution |

**Guardrails:**
- Can only modify: `hooks/*.sh` Custom Rules section, `guides/*.md`, `state/learning-log.yaml`
- Cannot modify: SKILL.md files, project-config.yaml core fields, settings.json directly
- Maximum rule limit (default: 20) prevents unbounded accumulation
- Duplicate detection prevents adding the same rule twice

---

## How It Works

### Hybrid Generation

| Component | Method | Source |
|-----------|--------|--------|
| SKILL.md files (orchestrator, plan, implement, verify) | **Template** | `templates/*.md` — pipeline structure stays consistent |
| project-config.yaml | **Mapped** | Wizard answers → YAML schema |
| Hook scripts (hooks/*.sh) | **Template** | `templates/hooks/*.sh.template` — conditional on enforcement level |
| CI/CD workflows (.github/workflows/*.yml) | **Template** | `templates/ci-cd/github-actions/*.yml.template` — conditional on platform |
| agents/*.md | **AI Generated** | Claude generates project-specific agent checklists |
| guides/*.md | **AI Generated** | Claude generates project-specific development guides |
| classification.md | **AI Generated** | Project-specific classification rules |

### Config-Driven Pipeline

The generated `project-config.yaml` drives everything:

```yaml
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

agents:                   # User-selected
  - security-reviewer
  - performance-auditor

guides:                   # User-selected
  - api-design
  - database-design

enforcement:              # Code-level enforcement (Layer 1)
  level: standard
  protected_files:
    - "**/.env*"
    - "package-lock.json"
  custom_rules: []

ci_cd:                    # CI/CD pipeline generation (Layer 2)
  platform: github-actions
  pipelines:
    - type: ci
      enabled: true
    - type: ai-review
      enabled: true
    - type: security
      enabled: true
  ai_review:
    model: claude-sonnet-4-6
    block_on_critical: true

self_learning:            # Self-learning mechanism (Layer 3)
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
│   ├── plugin.json                # Plugin manifest
│   └── marketplace.json           # Marketplace metadata
├── skills/
│   ├── wizard/SKILL.md            # Main scaffolding wizard (15+ steps)
│   └── upgrade/SKILL.md           # Harness upgrade skill (preserves Custom Rules)
├── templates/                     # Harness skeleton templates
│   ├── orchestrator.md            # Pipeline orchestrator
│   ├── plan.md                    # Planning phase
│   ├── implement.md               # Implementation phase (with Learning Loop)
│   ├── visual-qa.md               # Visual QA phase
│   ├── verify.md                  # Verification phase (with Learning Loop)
│   ├── self-learning.md           # Self-learning engine
│   ├── config-schema.yaml         # Config schema (with enforcement/ci_cd/self_learning)
│   ├── classification.md          # Task classification rules
│   ├── hooks/                     # Hook script templates
│   │   ├── protected-files.sh.template
│   │   ├── db-safety.sh.template
│   │   ├── secret-guard.sh.template
│   │   ├── pattern-guard.sh.template
│   │   ├── post-edit-lint.sh.template
│   │   ├── post-edit-typecheck.sh.template
│   │   ├── post-edit-format.sh.template
│   │   ├── session-init.sh.template
│   │   └── hooks-config.json.template
│   └── ci-cd/                     # CI/CD workflow templates
│       └── github-actions/
│           ├── ci.yml.template
│           ├── ai-review.yml.template
│           ├── deploy-preview.yml.template
│           ├── deploy-prod.yml.template
│           └── security.yml.template
├── data/                          # Deep-researched option datasets
│   ├── project-types.yaml         # 3-level project taxonomy (8 categories)
│   ├── languages.yaml             # Programming languages
│   ├── databases.yaml             # Databases (serverless & traditional)
│   ├── cache-servers.yaml         # Cache options
│   ├── platforms.yaml             # Deployment platforms
│   ├── tech-stacks.yaml           # Tech stack options
│   ├── mcps.yaml                  # MCP server requirements
│   ├── branching-tree.yaml        # Conditional wizard steps
│   ├── hook-patterns.yaml         # Hook pattern catalog (20 patterns)
│   ├── ci-cd-pipelines.yaml       # CI/CD pipeline catalog
│   └── enforcement-rules.yaml     # Enforcement presets & tech-stack rules
├── scripts/
│   ├── validate-harness.js        # Structure, config, hooks, CI/CD, self-learning validator
│   └── merge-hooks.js             # Non-destructive settings.json hook merger
├── LICENSE                        # Apache-2.0
├── NOTICE                         # Attribution
├── package.json
├── README.md
└── README-ko.md
```

## Requirements

- **Claude Code** with Agent Teams enabled (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)
- **omc** (oh-my-claudecode) — optional, enhances state management if installed

## Comparison with revfactory/harness

| Aspect | revfactory/harness | harness-marketplace |
|--------|-------------------|---------------------|
| Scope | General-purpose (any domain) | **Software development pipelines** |
| Input | Natural language prompt | **Structured wizard** (15+ steps) |
| Generation | Full AI generation | **Hybrid** (template + AI) |
| Config | None (markdown only) | **project-config.yaml** driven |
| Pipeline | Generic agent teams | **plan → implement → visual-qa → verify** |
| Enforcement | None | **Claude Code hooks** (PreToolUse/PostToolUse) |
| CI/CD | None | **GitHub Actions / GitLab CI** generation + AI code review |
| Self-learning | None | **Auto-evolving** hooks + guides from regressions |
| Validation | Basic dry-run | Structure + hooks + CI/CD + plan dry-run + user confirm |
| Upgrade | None | Config-preserving template upgrade (Custom Rules preserved) |

## License

Apache-2.0 — See [LICENSE](./LICENSE) for details.
