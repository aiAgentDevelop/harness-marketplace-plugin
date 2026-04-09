---
name: wizard
description: Interactive scaffolding wizard that generates project-specific harness skills via step-by-step questions
argument-hint: "[--quick] [--lang ko|en] [project-path]"
---

<Purpose>
Scaffolding wizard that generates a complete project-harness skill set tailored to the user's project type, tech stack, and development needs. Asks structured questions step-by-step, then generates config + pipeline skills + agents + guides into the project's `.claude/skills/project-harness/` directory.

The generated harness provides a full development pipeline: plan → implement → visual-qa → verify, customized for the specific project.
</Purpose>

<Use_When>
- User starts a new project and needs a development pipeline
- User says "setup harness", "scaffold harness", "create project harness", "wizard"
- User wants to generate project-specific development workflow skills
- User runs `/harness-marketplace:wizard`
</Use_When>

<Do_Not_Use_When>
- Project already has a harness — use `/harness-marketplace:upgrade` instead
- User wants to modify an existing harness — edit files directly or re-run wizard
- User just wants to run an existing harness — use `/project-harness` directly
</Do_Not_Use_When>

<Execution_Policy>
- Ask ONE question per step using AskUserQuestion
- Each option MUST include a detailed description
- AI filters/ranks options based on previous answers
- Never skip steps — every step builds on previous answers
- Validate combinations and warn about incompatibilities
- Support early exit with warning about incomplete config
</Execution_Policy>

<Data_Sources>
All option data is loaded from the plugin's `data/` directory:
- `data/project-types.yaml` — 3-level project type taxonomy
- `data/languages.yaml` — programming languages + metadata
- `data/databases.yaml` — DB options (serverless/non-serverless)
- `data/cache-servers.yaml` — cache server options
- `data/platforms.yaml` — deployment platform options
- `data/tech-stacks.yaml` — tech stack options by domain
- `data/mcps.yaml` — MCP server requirements per flag
- `data/branching-tree.yaml` — conditional wizard steps per project type
- `data/hook-patterns.yaml` — hook pattern catalog for enforcement
- `data/ci-cd-pipelines.yaml` — CI/CD pipeline catalog
- `data/enforcement-rules.yaml` — enforcement presets and tech-stack rules

The plugin root is available via `${CLAUDE_PLUGIN_ROOT}` or can be found at `~/.claude/plugins/cache/*/harness-marketplace/*/`.
</Data_Sources>

<Steps>

## Phase 0: Pre-checks

### Step 0.1: Detect Existing Harness
```
Check if .claude/skills/project-harness/ exists in current project directory.
If exists:
  → AskUserQuestion: "기존 project-harness가 발견되었습니다."
    Options:
    - "덮어쓰기" — Remove existing and generate new
    - "백업 후 재생성" — Backup to .claude/skills/project-harness.backup-{timestamp}/ then generate new
    - "취소" — Abort wizard
```

### Step 0.2: Check Agent Teams
```
Verify Claude Code Agent Teams is available by checking if TeamCreate tool exists.
If not available:
  → Warn user: "Agent Teams가 필요합니다. CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 설정 후 재시작하세요."
  → Abort
```

### Step 0.3: Detect omc
```
Try to call state_get_status MCP tool.
If available → set enhanced_mode = true (will use omc state/notepad in templates)
If not available → set enhanced_mode = false (will use file-based state in templates)
Log: "omc detected: {enhanced_mode}" or "omc not found: using file-based state"
```

## Phase 1: Common Steps (All Projects)

### Step 0: Language Selection
```
AskUserQuestion:
  question: "Select the language for this wizard and generated files."
  header: "Language"
  options:
    - label: "English"
      description: "All wizard prompts and generated skill/agent/guide files will be in English"
    - label: "한국어"
      description: "모든 위자드 프롬프트와 생성되는 스킬/에이전트/가이드 파일이 한국어로 작성됩니다"

Store as: wizard_language
All subsequent questions and generated content use this language.
```

### Step 1-1: Project Category (대분류)
```
Load data/project-types.yaml → extract top-level categories.

AskUserQuestion:
  question: "What type of project are you building?"
  header: "Category"
  options: (from data, max 4 shown + "Other" auto-added)
    - label: "Web"
      description: "Web applications — SPA, SSR, SSG, PWA, full-stack. Browser-based user interfaces with modern frameworks."
    - label: "Mobile"
      description: "Mobile applications — native iOS/Android, cross-platform (Flutter, React Native), hybrid apps."
    - label: "Backend / API"
      description: "Server-side services — REST API, GraphQL, gRPC, microservices, monolith backends."
    - label: "Desktop"
      description: "Desktop applications — Electron, Tauri, native Windows/macOS apps."
  (Additional categories shown in next page or via "Other": game, cli, data, iot)

Store as: project_type.category
```

### Step 1-2: Project Subcategory (세부유형)
```
Filter data/project-types.yaml by selected category → get subcategories.
AI ranks by popularity/relevance.

AskUserQuestion:
  question: "What specific type of {category} project?"
  header: "Subtype"
  options: (filtered by category, max 4)
    Example for "web":
    - label: "SSR (Server-Side Rendering)"
      description: "Pages rendered on the server for SEO and performance. Frameworks: Next.js, Nuxt, SvelteKit."
    - label: "SPA (Single Page Application)"
      description: "Client-side rendering with dynamic interactions. Frameworks: React, Vue, Angular, Svelte."
    - label: "Full-stack"
      description: "Combined frontend + backend in one project. Monorepo or integrated framework."
    - label: "SSG (Static Site Generation)"
      description: "Pre-built static pages for blogs, docs, marketing. Frameworks: Astro, Gatsby, Hugo."

Store as: project_type.subcategory
```

### Step 1-3: Project Purpose (용도)
```
Filter data/project-types.yaml by category + subcategory → get purposes.
AI adds relevant descriptions.

AskUserQuestion:
  question: "What is the primary purpose of this {subcategory} project?"
  header: "Purpose"
  options: (filtered, max 4)
    Example for "web > SSR":
    - label: "E-commerce"
      description: "Online store with product catalog, cart, checkout, payment integration."
    - label: "SaaS Platform"
      description: "Software-as-a-Service with user accounts, subscription billing, dashboards."
    - label: "Content / Blog"
      description: "Content-driven site with CMS, articles, media management."
    - label: "Dashboard / Admin"
      description: "Internal tool or admin panel with data visualization, CRUD operations."

Store as: project_type.purpose
```

### Step 2: Serverless
```
AskUserQuestion:
  question: "Will this project use serverless architecture?"
  header: "Serverless"
  options:
    - label: "Yes — Serverless"
      description: "No server management. Uses serverless functions (Lambda, Cloud Functions), serverless DB (Supabase, Neon), and edge deployment. Lower ops overhead, pay-per-use."
    - label: "No — Server-based"
      description: "Traditional server deployment. Full control over infrastructure, persistent processes, WebSocket support. Docker/Kubernetes/VPS."
    - label: "Hybrid"
      description: "Mix of serverless and server-based. Example: serverless API + persistent WebSocket server, or serverless frontend + traditional backend."

Store as: serverless (true/false/"hybrid")
```

### Step 3: Programming Languages (multiSelect)
```
Load data/languages.yaml.
AI filters by project_type and ranks by suitability.

AskUserQuestion:
  question: "Which programming languages will you use? (select all that apply)"
  header: "Languages"
  multiSelect: true
  options: (AI-filtered top 4 for this project type)
    Example for "web > SSR":
    - label: "TypeScript"
      description: "Strongly-typed JavaScript superset. Industry standard for modern web development. Excellent tooling and IDE support."
    - label: "JavaScript"
      description: "Dynamic scripting language. Universal web language. Faster prototyping, less type safety."
    - label: "Python"
      description: "Versatile language for backend/data. Django, FastAPI frameworks. Great for ML integration."
    - label: "Go"
      description: "Fast compiled language. Excellent for high-performance APIs and microservices. Simple concurrency model."

Store as: platform.backend.language, platform.frontend.language (mapped from selection)
```

### Step 4: Database
```
Load data/databases.yaml.
Filter by serverless flag. AI ranks by project type + language compatibility.

AskUserQuestion:
  question: "Which database will you use?"
  header: "Database"
  options: (filtered by serverless, max 4)
    Example for serverless=true:
    - label: "Supabase (PostgreSQL)"
      description: "Open-source Firebase alternative. PostgreSQL with realtime, auth, storage, edge functions. Generous free tier."
    - label: "PlanetScale (MySQL)"
      description: "Serverless MySQL platform. Branching, non-blocking schema changes. Great for scaling."
    - label: "Neon (PostgreSQL)"
      description: "Serverless PostgreSQL with branching and auto-scaling. Pay-per-use compute."
    - label: "Firebase Firestore"
      description: "Google's NoSQL document database. Realtime sync, offline support. Best for mobile/web apps with simple data models."

Store as: platform.database.primary, platform.database.serverless_db
```

### Step 5: Cache Server
```
Load data/cache-servers.yaml.
AI filters by serverless/platform compatibility.

AskUserQuestion:
  question: "Do you need a cache server?"
  header: "Cache"
  options:
    - label: "Redis"
      description: "In-memory data store. Session management, rate limiting, pub/sub, queue. Most popular cache choice."
    - label: "Upstash Redis (Serverless)"
      description: "Serverless Redis with REST API. Pay-per-request. Perfect for serverless architectures."
    - label: "CDN Only"
      description: "Use CDN (Cloudflare, Vercel Edge) for static asset and API response caching. No separate cache server."
    - label: "No Cache"
      description: "No dedicated cache layer. Suitable for simple apps or early-stage MVPs."

Store as: platform.cache.enabled, platform.cache.type
```

### Step 6: Deployment Platform
```
Load data/platforms.yaml.
AI filters by project_type + serverless + language compatibility.

AskUserQuestion:
  question: "Where will you deploy this project?"
  header: "Platform"
  options: (AI-filtered top 4)
    Example for web + serverless:
    - label: "Vercel"
      description: "Best-in-class for Next.js/React. Edge functions, preview deployments, analytics. Generous free tier."
    - label: "Netlify"
      description: "JAMstack pioneer. Serverless functions, forms, identity. Great for static + serverless sites."
    - label: "AWS (Lambda + CloudFront)"
      description: "Full AWS ecosystem. Lambda functions, CloudFront CDN, DynamoDB. Maximum flexibility, steeper learning curve."
    - label: "Cloudflare Workers"
      description: "Edge-first platform. V8 isolates for ultra-fast cold starts. Workers, KV, D1, R2 storage."

Store as: platform.deployment.platform, platform.deployment.type
```

### Step 7: Tech Stack (multiSelect)
```
Load data/tech-stacks.yaml.
AI filters by project_type + language + framework compatibility.
Group by domain for clarity.

AskUserQuestion:
  question: "Which tech stack options do you want? (select all that apply)"
  header: "Tech Stack"
  multiSelect: true
  options: (AI-curated top 4 most relevant)
    Example for web + TypeScript + Next.js:
    - label: "Tailwind CSS"
      description: "Utility-first CSS framework. Rapid styling with consistent design tokens. Works perfectly with Next.js."
    - label: "shadcn/ui"
      description: "Beautiful, accessible UI components built on Radix + Tailwind. Copy-paste into your project, fully customizable."
    - label: "FSD (Feature-Sliced Design)"
      description: "Architectural methodology for frontend. Organized layers: shared → entities → features → widgets → pages."
    - label: "Turborepo (Monorepo)"
      description: "High-performance monorepo build system. Incremental builds, remote caching. By Vercel."

Store as: tech_stack.* (mapped to appropriate fields)
```

## Phase 2: Conditional Branching Steps

```
Load data/branching-tree.yaml → filter by project_type.category.
Execute each conditional step as AskUserQuestion.

The branching tree defines additional questions per project category.
Each step has: id, question, options, multiSelect, depends_on.

Example flow for "web":
  Step 8: Auth method → OAuth / JWT / Session / None
  Step 9: State management → Zustand / Redux / Recoil / None
  Step 10: CSS approach → Tailwind / CSS Modules / Styled Components / None

Example flow for "mobile":
  Step 8: Cross-platform framework → Flutter / React Native / MAUI
  Step 9: Push notification → FCM / APNs / None
  Step 10: App store target → iOS / Android / Both

Store results in: additional.* and tech_stack.*
```

## Phase 2.5: Enforcement, CI/CD & Self-Learning

### Step E1: Enforcement Level
```
Load data/enforcement-rules.yaml → get recommended level for project_type.category.

AskUserQuestion:
  question: "What level of code enforcement do you want?"
  header: "Enforcement"
  options:
    - label: "Strict"
      description: "All hooks enabled: protected files, auto lint/typecheck/format after every edit, architecture pattern guards, secret detection, dangerous SQL blocking. Maximum safety."
    - label: "Standard" [Recommended]
      description: "Core hooks: protected files (.env, lock files), auto lint and typecheck after edits, secret detection. Balanced safety without overhead."
    - label: "Minimal"
      description: "Protected files only: blocks AI from editing .env, lock files, and migration files. No auto-lint or pattern guards."
    - label: "None"
      description: "No hooks. Markdown-only harness (agents follow guidelines but nothing is enforced at code level). Same as v0.1.0 behavior."

Store as: enforcement.level
```

### Step E2: Protected Files (if enforcement.level != "none")
```
AI generates recommended protected file patterns based on project type and tech stack.

AskUserQuestion:
  question: "Which files should be protected from AI modification?"
  header: "Protected Files"
  multiSelect: true
  options: (AI-filtered based on project config)
    - label: ".env files"
      description: "All environment variable files (.env, .env.local, .env.production). Contains secrets."
    - label: "Lock files"
      description: "Package manager lock files (package-lock.json, yarn.lock, pnpm-lock.yaml). Must only be modified by package managers."
    {{CONDITION:prisma}}
    - label: "Prisma migrations"
      description: "Applied migration files in prisma/migrations/. Create new migrations instead of editing applied ones."
    {{/CONDITION:prisma}}
    {{CONDITION:supabase}}
    - label: "Supabase migrations"
      description: "Applied migration files in supabase/migrations/. Never modify applied migrations."
    {{/CONDITION:supabase}}
    - label: "CI/CD config files"
      description: "GitHub Actions workflows, GitLab CI config. Prevent accidental CI pipeline changes."
    - label: "Custom paths..."
      description: "Enter custom glob patterns to protect (e.g., 'config/production.yaml')"

Store as: enforcement.protected_files[]
If "Custom paths..." selected → follow up with free text input for custom patterns.
```

### Step E3: Custom Enforcement Rules (if enforcement.level == "strict")
```
AskUserQuestion:
  question: "Do you have custom enforcement rules?"
  header: "Custom Rules"
  options:
    - label: "No custom rules"
      description: "Use default enforcement rules for your tech stack."
    - label: "Add custom rules"
      description: "Describe rules in natural language. AI will convert them to hook scripts."
      → Follow-up: free text input
      → AI parses rules and creates custom_rules[] entries
      → Examples: "No direct SQL in service files", "All API routes must have auth middleware"

Store as: enforcement.custom_rules[]
```

### Step C1: CI/CD Platform
```
AskUserQuestion:
  question: "Which CI/CD platform do you use?"
  header: "CI/CD"
  options:
    - label: "GitHub Actions" [Recommended for GitHub repos]
      description: "Integrated CI/CD in GitHub. Workflow files in .github/workflows/. Free for public repos."
    - label: "GitLab CI"
      description: "Built-in CI/CD for GitLab. Single .gitlab-ci.yml config file."
    - label: "None"
      description: "No CI/CD pipeline generation. You can add it manually later."

Store as: ci_cd.platform (also updates additional.ci_cd for backward compat)
```

### Step C2: Pipeline Selection (if ci_cd.platform != "none")
```
Load data/ci-cd-pipelines.yaml → filter by ci_cd.platform.

AskUserQuestion:
  question: "Which CI/CD pipelines should be generated?"
  header: "Pipelines"
  multiSelect: true
  options: (from data file, pre-checked for recommended)
    - label: "CI (Test + Lint + Build)"
      description: "Standard quality gate. Runs tests, lint, typecheck, and build on every push and PR. Essential for any project."
    - label: "AI Code Review"
      description: "Claude reviews every PR automatically. Posts comments with severity ratings. Requires ANTHROPIC_API_KEY secret."
    - label: "Deploy Preview"
      description: "Deploy a preview environment for each PR. Supports Vercel, Netlify, Railway, Fly.io."
    - label: "Deploy Production"
      description: "Auto-deploy to production on merge to main. Platform-specific configuration."
    - label: "Security Scan"
      description: "Weekly dependency audit, secret scanning, and CodeQL analysis."

Store as: ci_cd.pipelines[]
```

### Step C3: AI Review Config (if "AI Code Review" selected)
```
AskUserQuestion:
  question: "How should AI code review behave?"
  header: "AI Review"
  options:
    - label: "Comment only"
      description: "AI posts review comments on PRs. Does not block merge. Good for getting started."
    - label: "Block on critical"
      description: "AI blocks PR merge when critical issues (security, logic bugs) are found. Recommended for production projects."
    - label: "Auto-approve"
      description: "AI approves PRs when no critical issues found. Use with caution."

Store as: ci_cd.ai_review.block_on_critical and ci_cd.ai_review.auto_approve
```

### Step L1: Self-Learning
```
AskUserQuestion:
  question: "Enable self-learning? The harness evolves by adding enforcement rules when mistakes are detected."
  header: "Self-Learning"
  options:
    - label: "Yes, with approval" [Recommended]
      description: "When AI fixes a regression, it proposes a new hook rule + guide note to prevent recurrence. You approve before it's applied."
    - label: "Yes, automatic"
      description: "AI automatically adds enforcement rules when regressions are fixed. All changes are logged to learning-log.yaml."
    - label: "No"
      description: "Static harness. No automatic evolution. You can still manually edit hooks and guides."

Store as: self_learning.enabled, self_learning.mode
```

## Phase 3: AI Additional Questions

```
After all structured steps, AI analyzes the complete answer set and identifies gaps.

Generate up to 3 additional questions dynamically:
- CI/CD pipeline (if not covered)
- Testing strategy (if not covered)
- Monitoring/logging needs
- API documentation approach
- Any project-specific concerns

Each as AskUserQuestion with AI-generated options.

Store in: additional.*
```

## Phase 4: Agent & Guide Selection

### Step A: Compatibility Check
```
AI analyzes all wizard answers for incompatible combinations.
If found:
  → AskUserQuestion: "다음 조합이 일반적이지 않습니다: {description}. 대안을 추천합니다: {alternative}."
    Options: [추천 수락 / 현재 선택 유지]
```

### Step B: Agent Selection
```
AI generates recommended agent list based on all answers.
Consider: project type, security needs, performance concerns, UI presence, DB type, etc.

AskUserQuestion:
  question: "Which verification agents should be included in your harness? (select all)"
  header: "Agents"
  multiSelect: true
  options: (AI-generated, pre-checked for recommended)
    Example:
    - label: "security-reviewer"
      description: "Reviews code for security vulnerabilities: injection, XSS, auth bypass, secrets exposure. Essential for web/API projects."
    - label: "performance-auditor"
      description: "Analyzes code for performance issues: N+1 queries, memory leaks, bundle size, render performance."
    - label: "accessibility-checker"
      description: "Validates WCAG compliance: semantic HTML, ARIA labels, keyboard navigation, color contrast. For UI projects."
    - label: "db-auditor"
      description: "Reviews database queries, migrations, indexes. Checks for slow queries and data integrity issues."

Store as: agents[]
```

### Step C: Guide Selection
```
AI generates recommended guide list based on all answers.

AskUserQuestion:
  question: "Which development guides should be generated? (select all)"
  header: "Guides"
  multiSelect: true
  options: (AI-generated, pre-checked for recommended)
    Example:
    - label: "api-design"
      description: "REST/GraphQL API design guidelines: naming conventions, error handling, pagination, versioning."
    - label: "database-design"
      description: "Database schema design, migration safety, indexing strategy, query optimization rules."
    - label: "auth-security"
      description: "Authentication and authorization patterns: token handling, session management, RBAC/ABAC."
    - label: "testing-strategy"
      description: "Test organization, coverage targets, mocking guidelines, CI integration for the chosen test framework."

Store as: guides[]
```

## Phase 5: Generation

### Step 5.1: Build project-config.yaml
```
Map all wizard answers to the project-config.yaml schema:

1. Set metadata: version, generated_by, language
2. Set project_type: category, subcategory, purpose
3. Set platform: backend, frontend, database, cache, deployment, communication
4. Set serverless flag
5. Set tech_stack fields
6. Set additional fields from branching + AI questions
7. Derive classification flags:
   - has_ui: frontend.framework != "none"
   - has_backend: backend.framework != "none"
   - has_database: database.primary != "none"
   - has_cache: cache.enabled == true
   - has_auth: tech_stack.auth != "none"
   - has_realtime: communication includes "websocket" or "grpc"
   - visual_qa_capable: has_ui AND (frontend uses React/Vue/Svelte/Angular)
8. Set agents and guides from selection
9. Detect required MCPs from data/mcps.yaml based on flags
10. Set commands based on language/framework defaults
11. AI generates run_options based on project type
12. Set enforcement section from Phase 2.5 answers:
    - enforcement.level, enforcement.protected_files, enforcement.custom_rules
    - Load data/enforcement-rules.yaml → apply tech_stack_rules for selected stack
13. Set ci_cd section from Phase 2.5 answers:
    - ci_cd.platform, ci_cd.pipelines, ci_cd.ai_review
    - Derive ci_cd.node_version and ci_cd.package_manager from tech stack
14. Set self_learning section from Phase 2.5 answers:
    - self_learning.enabled, self_learning.mode, self_learning.max_auto_rules

Write to: .claude/skills/project-harness/project-config.yaml
```

### Step 5.2: Generate Template-based Files
```
Load templates from plugin's templates/ directory.
For each template file:

1. Read template content
2. Replace template variables:
   - {{PROJECT_NAME}} → project_type.purpose or "project-harness"
   - {{DESCRIPTION}} → generated description from project type
   - {{HAS_UI}} → flags.has_ui
   - {{HAS_BACKEND}} → flags.has_backend
   - (all other flag variables)
   - {{RUN_OPTIONS}} → generated run options list
3. Process conditional blocks:
   - {{CONDITION:has_ui}} ... {{/CONDITION:has_ui}} → include/exclude based on flag
4. Write processed content to target path

Files generated:
- .claude/skills/project-harness/SKILL.md ← templates/orchestrator.md
- .claude/skills/project-harness/plan/SKILL.md ← templates/plan.md
- .claude/skills/project-harness/implement/SKILL.md ← templates/implement.md
- .claude/skills/project-harness/verify/SKILL.md ← templates/verify.md
- .claude/skills/project-harness/references/schemas.md ← templates/schemas.md (if exists)

Conditional:
- .claude/skills/project-harness/visual-qa/SKILL.md ← templates/visual-qa.md (only if has_ui)
- .claude/skills/project-harness/visual-qa/scripts/visual-inspect.js ← templates/visual-inspect.js (only if has_ui)
```

### Step 5.3: AI-Generate Specialized Files
```
For each selected agent, spawn an AI generation task:

Prompt pattern for agents:
"Generate a Claude Code agent definition markdown file for a {agent_name} agent.
Project context: {project_type}, {tech_stack}, {platform}.
The agent should include:
- Frontmatter: name, description, model (sonnet for standard, opus for critical)
- Role description
- Required validation checklist (10-15 items specific to this project's tech stack)
- Constraints
- Output format
Reference the game-harness agent format: name, description, model, checklist items."

Write to: .claude/skills/project-harness/agents/{agent_name}.md

For each selected guide, spawn an AI generation task:

Prompt pattern for guides:
"Generate a development guide for {guide_name} tailored to: {project_type} using {tech_stack}.
Include:
- Purpose and scope
- Key rules and conventions (10-20 rules)
- Examples with code snippets
- Common mistakes to avoid
- Integration with the project's specific tech stack"

Write to: .claude/skills/project-harness/guides/{guide_name}.md

Generate classification.md:
- Use templates/classification.md as base
- Replace {{GENERATED}} markers with project-specific detection rules
Write to: .claude/skills/project-harness/references/classification.md

Generate options.md:
- Document each run option (--resume, --dry-run, etc.)
- Include usage examples
Write to: .claude/skills/project-harness/references/options.md
```

### Step 5.4: MCP Auto-install
```
Load data/mcps.yaml.
For each required MCP based on config flags:

1. Check if MCP is already installed (try calling one of its tools)
2. If not installed:
   → AskUserQuestion: "{mcp_name} MCP is required for {reason}. Install it?"
     Options: [Install / Skip]
3. If user confirms: execute install command
```

### Step 5.5: Create Supporting Directories
```
Create:
- .claude/skills/project-harness/state/
- .claude/skills/project-harness/state/.gitkeep
- .claude/skills/project-harness/hooks/ (if enforcement.level != "none")
```

### Step 5.6: Generate Hook Scripts (if enforcement.level != "none")
```
Load data/hook-patterns.yaml and data/enforcement-rules.yaml.
Determine active hooks from enforcement preset + tech_stack_rules.

For each active hook category, load the corresponding template from templates/hooks/:

1. protected-files.sh ← templates/hooks/protected-files.sh.template
   - Replace {{PROTECTED_FILES}} with enforcement.protected_files patterns
   - Always generated if enforcement.level != "none"

2. db-safety.sh ← templates/hooks/db-safety.sh.template
   - Only if has_database AND enforcement.level in ["strict", "standard"]

3. secret-guard.sh ← templates/hooks/secret-guard.sh.template
   - Generated if enforcement.level in ["strict", "standard"]

4. pattern-guard.sh ← templates/hooks/pattern-guard.sh.template
   - Only if enforcement.level == "strict"
   - Replace tech-stack-specific conditions (FSD, clean architecture, etc.)
   - Include enforcement.custom_rules if any

5. post-edit-lint.sh ← templates/hooks/post-edit-lint.sh.template
   - Only if enforcement.level in ["strict", "standard"]
   - Replace {{LINT_COMMAND}} from commands.lint_fix

6. post-edit-typecheck.sh ← templates/hooks/post-edit-typecheck.sh.template
   - Only if enforcement.level in ["strict", "standard"] AND commands.typecheck exists

7. post-edit-format.sh ← templates/hooks/post-edit-format.sh.template
   - Only if enforcement.level == "strict"
   - Replace {{FORMAT_COMMAND}} from framework defaults

8. session-init.sh ← templates/hooks/session-init.sh.template
   - Always generated if enforcement.level != "none"

For each generated script:
  - Replace template variables ({{VERSION}}, {{PROJECT_NAME}}, etc.)
  - Process conditional blocks
  - Write to: .claude/skills/project-harness/hooks/{script-name}.sh

Generate hooks-config.json:
  - Load templates/hooks/hooks-config.json.template
  - Include only hooks for generated scripts
  - Write to: .claude/skills/project-harness/hooks-config.json
```

### Step 5.7: Generate CI/CD Workflows (if ci_cd.platform != "none")
```
Load data/ci-cd-pipelines.yaml.

For each enabled pipeline in ci_cd.pipelines:
  1. Load template from templates/ci-cd/{platform}/{pipeline}.yml.template
  2. Replace template variables:
     - {{VERSION}}, {{PROJECT_NAME}}
     - {{NODE_VERSION}} ← ci_cd.node_version
     - {{PACKAGE_MANAGER}} ← ci_cd.package_manager
     - {{INSTALL_COMMAND}} ← commands.install
     - {{BUILD_COMMAND}} ← commands.build
     - {{LINT_COMMAND}} ← commands.lint
     - {{TYPECHECK_COMMAND}} ← commands.typecheck
     - {{TEST_COMMAND}} ← commands.test
     - {{TEST_E2E_COMMAND}} ← commands.test_e2e
     - {{AI_REVIEW_MODEL}} ← ci_cd.ai_review.model
     - Platform-specific: {{DOCKER_REGISTRY}}, {{AWS_REGION}}, {{FLY_APP_NAME}}, etc.
  3. Process conditional blocks for deployment platform
  4. Write to target path:
     - GitHub Actions: .github/workflows/{pipeline-id}.yml
     - GitLab CI: .gitlab-ci.yml (single file, all pipelines combined)
```

### Step 5.8: Configure Self-Learning (if self_learning.enabled)
```
1. Generate initial learning log:
   Write to: .claude/skills/project-harness/state/learning-log.yaml
   Content: "entries: []"

2. The self-learning engine is built into templates/implement.md and templates/verify.md
   (Learning Loop sections). No additional file generation needed —
   the engine activates based on self_learning.enabled in project-config.yaml.
```

### Step 5.9: Merge Hooks into settings.json (if enforcement.level != "none")
```
AskUserQuestion:
  question: "Merge generated hooks into .claude/settings.json?"
  header: "Hook Installation"
  options:
    - label: "Yes, merge now"
      description: "Runs merge-hooks.js to add enforcement hooks to your settings. Creates backup first."
    - label: "No, I'll merge manually"
      description: "Hooks are saved to hooks-config.json. You can merge later with: node scripts/merge-hooks.js"

If "Yes":
  → Run: node {plugin_root}/scripts/merge-hooks.js {project_path}
  → Report merge results
```

## Phase 6: Validation

### Step 6.1: Structure Validation
```
Run validation checks (equivalent to scripts/validate-harness.js):

1. Required files exist:
   - SKILL.md, project-config.yaml, plan/SKILL.md, implement/SKILL.md, verify/SKILL.md
   - references/classification.md, references/schemas.md
   - agents/*.md (at least one)
   - guides/*.md (at least one)

2. Config schema valid:
   - All required fields present
   - Flags are boolean
   - Category is valid
   - Agents listed in config have corresponding .md files
   - Guides listed in config have corresponding .md files

3. Skill content valid:
   - All SKILL.md files have frontmatter
   - No unresolved template variables ({{...}})
   - Minimum content length

4. Hook validation (if enforcement.level != "none"):
   - hooks/ directory exists
   - hooks-config.json exists and is valid JSON
   - Each referenced hook script exists and has valid shebang
   - Protected file patterns are valid globs

5. CI/CD validation (if ci_cd.platform != "none"):
   - Workflow files exist in .github/workflows/ (or .gitlab-ci.yml)
   - Each enabled pipeline has a corresponding workflow file
   - Workflow files are valid YAML

6. Self-learning validation (if self_learning.enabled):
   - state/learning-log.yaml exists
   - enforcement.level != "none" (self-learning requires hooks)
```

### Step 6.2: Plan Dry-run
```
Execute the generated project-harness's plan phase in dry-run mode:

1. Load project-config.yaml → verify parsing
2. Load classification.md → verify classification logic
3. Attempt to spawn explore agent → verify agent delegation works
4. If all steps pass without error → dry-run success

If dry-run fails:
  → Report error to user
  → AskUserQuestion: "드라이런 테스트가 실패했습니다."
    Options:
    - "자동 수정" — AI analyzes error and fixes
    - "수동 수정" — Show error details for user to fix
    - "전체 재생성" — Re-run Phase 5
    - "중단" — Abort, keep generated files as-is
```

## Phase 7: User Confirmation

```
Display generation summary:

━━━━ Project Harness Generated ━━━━

📋 Config Summary:
  Project: {category} > {subcategory} > {purpose}
  Language: {language}
  Serverless: {yes/no}
  Platform: {deployment.platform}
  Stack: {key tech stack items}

🔒 Enforcement: {level}
  Hooks: {count} active ({hook_names})
  Protected files: {count} patterns

🔄 CI/CD: {platform}
  Pipelines: {enabled_pipeline_names}

🧠 Self-Learning: {mode}

📁 Generated Files ({count} files):
  ├── SKILL.md — Main orchestrator
  ├── project-config.yaml — Project configuration
  ├── plan/SKILL.md — Planning phase
  ├── implement/SKILL.md — Implementation phase
  ├── visual-qa/SKILL.md — Visual QA (if has_ui)
  ├── verify/SKILL.md — Verification phase
  ├── agents/ ({count} agents)
  │   ├── security-reviewer.md
  │   └── ...
  ├── guides/ ({count} guides)
  │   ├── api-design.md
  │   └── ...
  ├── hooks/ ({count} hook scripts)        ← if enforcement != none
  │   ├── protected-files.sh
  │   ├── post-edit-lint.sh
  │   └── ...
  ├── references/
  │   ├── classification.md
  │   ├── schemas.md
  │   └── options.md
  └── .github/workflows/ ({count} pipelines) ← if ci_cd != none
      ├── ci.yml
      ├── ai-review.yml
      └── ...

✅ Validation: PASS
✅ Dry-run: PASS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AskUserQuestion:
  question: "Harness 생성이 완료되었습니다. 어떻게 하시겠습니까?"
  header: "Confirm"
  options:
    - label: "승인"
      description: "생성된 harness를 그대로 사용합니다. /project-harness 로 실행할 수 있습니다."
    - label: "수정 후 재생성"
      description: "수정하고 싶은 부분을 설명해주시면 전체를 재생성합니다."
    - label: "취소"
      description: "생성된 파일을 모두 삭제합니다."

If "승인":
  → Print: "✅ /project-harness 로 개발 파이프라인을 실행할 수 있습니다."
  → Done

If "수정 후 재생성":
  → Ask user for modification text
  → Return to Phase 5 with modifications applied
  → Re-validate and re-confirm

If "취소":
  → Remove .claude/skills/project-harness/ directory
  → Print: "취소되었습니다."
```

</Steps>

<Tool_Usage>
- `AskUserQuestion` — Every wizard step (one at a time, detailed descriptions)
- `Read` — Load data/*.yaml files, existing config, template files
- `Write` — Generate all output files (config, skills, agents, guides, hooks, CI/CD workflows)
- `Agent(subagent_type="oh-my-claudecode:executor")` — AI generation of agents/guides (parallel)
- `Agent(subagent_type="Explore")` — Dry-run exploration test
- `Bash` — MCP installation, directory creation, backup operations, merge-hooks.js execution
- `Glob` — Check for existing harness files
- `Grep` — Validate no unresolved template variables
</Tool_Usage>

<Examples>

<Good>
Step-by-step with detailed descriptions:
```
Step 1-1 | Category

What type of project are you building?

  ● Web
    Web applications — SPA, SSR, SSG, PWA, full-stack.
    Browser-based user interfaces with modern frameworks.

  ○ Mobile
    Mobile applications — native iOS/Android, cross-platform
    (Flutter, React Native), hybrid apps.

  ○ Backend / API
    Server-side services — REST API, GraphQL, gRPC,
    microservices, monolith backends.

  ○ Desktop
    Desktop applications — Electron, Tauri, native
    Windows/macOS apps.
```
Why good: One question, detailed descriptions, clear options.
</Good>

<Good>
AI filtering based on previous answers:
```
User selected: web > SSR > e-commerce, serverless=true

Step 4 (Database) shows:
  ● Supabase (PostgreSQL) [Recommended]
  ○ PlanetScale (MySQL)
  ○ Neon (PostgreSQL)
  ○ Firebase Firestore

(MongoDB, SQLite, Redis-primary are filtered out as less suitable
 for serverless e-commerce)
```
Why good: Options are contextually filtered and ranked.
</Good>

<Good>
Incompatibility warning:
```
User selected: CLI tool + Redis cache + Vercel deployment

AI: "CLI 도구에 Vercel 배포는 적합하지 않습니다. CLI 도구는 일반적으로
npm/brew로 배포됩니다."
  Recommendation: npm registry
  [추천 수락] [현재 선택 유지]
```
Why good: Detects incompatible combination, suggests alternative.
</Good>

<Bad>
Multiple questions at once:
```
"What language, framework, and database will you use?
Also, do you need caching?"
```
Why bad: Batches 4 questions — violates one-step-at-a-time rule.
</Bad>

<Bad>
Options without descriptions:
```
Database:
  ○ PostgreSQL
  ○ MySQL
  ○ MongoDB
  ○ SQLite
```
Why bad: No descriptions — user can't make informed choice.
</Bad>

</Examples>

<Final_Checklist>
- [ ] Phase 0: Pre-checks complete (existing harness, Agent Teams, omc detection)
- [ ] Phase 1: All 8 common steps asked with detailed descriptions
- [ ] Phase 2: Conditional branching steps executed for project category
- [ ] Phase 2.5: Enforcement level, protected files, CI/CD platform, pipelines, self-learning configured
- [ ] Phase 3: AI additional questions (0-3) asked if gaps detected
- [ ] Phase 4: Agents and guides selected via multiSelect checkboxes
- [ ] Phase 5: All files generated (config + skills + agents + guides + references)
- [ ] Phase 5: Hook scripts generated and hooks-config.json created (if enforcement != none)
- [ ] Phase 5: CI/CD workflow files generated (if ci_cd != none)
- [ ] Phase 5: Self-learning configured and learning-log.yaml initialized (if enabled)
- [ ] Phase 5: Hooks merged into settings.json (if user approved)
- [ ] Phase 5: MCP auto-install offered for required MCPs
- [ ] Phase 6: Structure validation passed (including hooks, CI/CD, self-learning checks)
- [ ] Phase 6: Plan dry-run passed
- [ ] Phase 7: User confirmation received (summary includes enforcement, CI/CD, self-learning status)
- [ ] No unresolved template variables in generated files
- [ ] All agents listed in config have corresponding .md files
- [ ] All guides listed in config have corresponding .md files
</Final_Checklist>
