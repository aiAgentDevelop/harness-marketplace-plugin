# harness-marketplace

**Scaffolding wizard that generates project-specific development pipeline harness skills for Claude Code.**

Generate a complete development pipeline — plan, implement, visual-qa, verify — tailored to your project's type, tech stack, and deployment target. One wizard, any project.

> **[한국어 (Korean)](./README-ko.md)**

---

## What It Does

```
/harness-marketplace:wizard
  │
  ├─ Step-by-step questions about your project
  │   (type, language, DB, platform, tech stack...)
  │
  ├─ Generates a full harness skill set
  │   ├── project-config.yaml
  │   ├── plan/SKILL.md
  │   ├── implement/SKILL.md
  │   ├── visual-qa/SKILL.md  (if UI project)
  │   ├── verify/SKILL.md
  │   ├── agents/*.md          (AI-generated, user-selected)
  │   ├── guides/*.md          (AI-generated, user-selected)
  │   └── references/
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
| 8+ | Conditional | Auth method, state management, CI/CD... (varies by project type) |
| A | Agents | security-reviewer, performance-auditor... (multi-select) |
| G | Guides | api-design, database-design... (multi-select) |

After all questions: generates files → validates structure → runs plan dry-run → asks for confirmation.

### Upgrade an existing harness

```bash
/harness-marketplace:upgrade
```

Preserves your `project-config.yaml` while updating template-based skill files to the latest version.

### Use the generated harness

```bash
/project-harness "implement user authentication"
/project-harness --dry-run "add payment integration"
/project-harness --resume
```

## How It Works

### Hybrid Generation

| Component | Method | Source |
|-----------|--------|--------|
| SKILL.md files (orchestrator, plan, implement, verify) | **Template** | `templates/*.md` — pipeline structure stays consistent |
| project-config.yaml | **Mapped** | Wizard answers → YAML schema |
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

## Plugin Structure

```
harness-marketplace/
├── .claude-plugin/
│   ├── plugin.json              # Plugin manifest
│   └── marketplace.json         # Marketplace metadata
├── skills/
│   ├── wizard/SKILL.md          # Main scaffolding wizard
│   └── upgrade/SKILL.md         # Harness upgrade skill
├── templates/                   # Harness skeleton templates (7 files)
│   ├── orchestrator.md
│   ├── plan.md
│   ├── implement.md
│   ├── visual-qa.md
│   ├── verify.md
│   ├── config-schema.yaml
│   └── classification.md
├── data/                        # Deep-researched option datasets (8 files)
│   ├── project-types.yaml       # 3-level project taxonomy
│   ├── languages.yaml           # Programming languages
│   ├── databases.yaml           # Databases (serverless & traditional)
│   ├── cache-servers.yaml       # Cache options
│   ├── platforms.yaml           # Deployment platforms
│   ├── tech-stacks.yaml         # Tech stack options
│   ├── mcps.yaml                # MCP server requirements
│   └── branching-tree.yaml      # Conditional wizard steps
├── scripts/
│   └── validate-harness.js      # Structure & schema validator
├── package.json
└── README.md
```

## Requirements

- **Claude Code** with Agent Teams enabled (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)
- **omc** (oh-my-claudecode) — optional, enhances state management if installed

## Comparison with revfactory/harness

| Aspect | revfactory/harness | harness-marketplace |
|--------|-------------------|---------------------|
| Scope | General-purpose (any domain) | **Software development pipelines** |
| Input | Natural language prompt | **Structured wizard** (10+ steps) |
| Generation | Full AI generation | **Hybrid** (template + AI) |
| Config | None (markdown only) | **project-config.yaml** driven |
| Pipeline | Generic agent teams | **plan → implement → visual-qa → verify** |
| Validation | Basic dry-run | Structure check + plan dry-run + user confirm |
| Upgrade | None | Config-preserving template upgrade |

## License

MIT

