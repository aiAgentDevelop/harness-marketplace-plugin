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

## Smart Recommendation Engine

When `recommendation_mode = true` (user provided a project description at Step 0.5):

1. **At every option-presenting step**, analyze `context.project_description` together with all previous answers
2. **For each option**, evaluate relevance by matching the description against data-file metadata:
   - `suitable_project_types`, `key_concerns`, `typical_languages` from data files
   - `popularity_rank`, `compatible_frameworks`, `key_benefits` from data files
   - Semantic match between the description and the option's purpose
3. **Tag the top 1-2 most relevant options** with a recommendation label:
   - Format: append `" (Recommended — {5-10 word reason})"` to the option label
   - Example: `"TypeScript (Recommended — best for real-time web apps with type safety)"`
   - Example: `"Redis (Recommended — ideal for real-time matchmaking and leaderboards)"`
4. **If no option clearly stands out**, do NOT add any recommendation tag
5. **Recommendations are labels ONLY** — they do NOT filter or hide options. All options are always shown.
6. The user can still pick any option regardless of recommendations
7. The existing AI filtering logic (removing irrelevant options based on previous answers) remains unchanged — recommendations are additive
8. Recommendation analysis happens fresh at each step (not once upfront), because previous answers change relevance

When `recommendation_mode = false` (user skipped Step 0.5), wizard works exactly as before with no recommendation labels.
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
- `data/agents.yaml` — verification agent catalog by domain (34 agents, 11 domains)
- `data/guides.yaml` — development guide catalog by domain (18 guides)
- `data/debug-strategies.yaml` — error-type debugging strategy catalog for debug phase

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
When wizard_language is "ko", use label_ko and description_ko fields if available instead of translating.
```

### Step 0.5: Wizard Mode Selection
```
AskUserQuestion:
  question: "How would you like to set up your harness?"
  header: "Wizard Mode"
  options:
    - label: "Deep Interview (AI Recommended)"
      label_ko: "딥 인터뷰 (AI 추천)"
      description: "AI interviews you about your project idea through 3-5 questions, then recommends the full architecture and tech stack. Best for new projects or when you're unsure about tech choices."
      description_ko: "AI가 프로젝트 아이디어에 대해 3~5개 질문을 하고, 전체 아키텍처와 기술 스택을 추천합니다. 새 프로젝트나 기술 선택이 불확실할 때 최적."
    - label: "Manual Selection"
      label_ko: "수동 선택"
      description: "You directly select project type, language, DB, platform, and tech stack step by step. Best when you already know your architecture."
      description_ko: "프로젝트 유형, 언어, DB, 플랫폼, 기술 스택을 단계별로 직접 선택합니다. 이미 아키텍처를 알고 있을 때 최적."
    - label: "Auto-Detect (Analyze Current Project)"
      label_ko: "자동 감지 (현재 프로젝트 분석)"
      description: "AI scans your current project's files (package.json, configs, code structure) to detect the architecture and tech stack already in use. Best for adding a harness to an existing project."
      description_ko: "AI가 현재 프로젝트의 파일(package.json, 설정 파일, 코드 구조)을 스캔하여 사용 중인 아키텍처와 기술 스택을 감지합니다. 기존 프로젝트에 harness를 추가할 때 최적."

Store as: wizard_mode ("interview" | "manual" | "auto-detect")
```

---

## Mode A: Deep Interview (if wizard_mode == "interview")

AI conducts a structured interview to understand the project concept, then generates
a complete architecture recommendation for user confirmation.

### Interview Step 1: Project Vision
```
AskUserQuestion:
  question: "What are you building? Describe the core idea, target users, and main problem it solves."
  header: "Project Vision"
  (Free text input)

Store as: interview.vision
```

### Interview Step 2: Key Features & Scale
```
Based on interview.vision, AI asks a targeted follow-up:

AskUserQuestion:
  question: "What are the 3-5 most important features? How many users do you expect (MVP/startup/enterprise scale)?"
  header: "Features & Scale"
  (Free text input)

Store as: interview.features_and_scale
```

### Interview Step 3: Constraints & Preferences
```
Based on previous answers, AI asks about constraints:

AskUserQuestion:
  question: "Any specific constraints or preferences? (budget, timeline, team size, existing tech you must use, deployment requirements)"
  header: "Constraints"
  options:
    - label: "Enter constraints"
      description: "Describe any technical or business constraints."
    - label: "No constraints — AI decides everything"
      description: "Let AI choose the best options with no restrictions."

Store as: interview.constraints
```

### Interview Step 4: AI Follow-up (conditional, 0-2 additional questions)
```
AI analyzes all interview answers and identifies any critical gaps.
If gaps found, ask up to 2 additional targeted questions.
Examples:
  - "Does this need real-time features (chat, live updates, multiplayer)?"
  - "Will this handle payments or sensitive user data?"
  - "Do you need multi-language/i18n support?"
  - "Is this a mobile app, web app, or both?"

Store as: interview.followup_answers
```

### Interview Step 5: Generate & Present Architecture Recommendation
```
AI analyzes ALL interview answers against data files:
  - data/project-types.yaml → determine category, subcategory, purpose
  - data/languages.yaml → select best languages
  - data/databases.yaml → select best database
  - data/cache-servers.yaml → determine if cache needed
  - data/platforms.yaml → select deployment platform
  - data/tech-stacks.yaml → select tech stack
  - data/branching-tree.yaml → determine conditional options (auth, state management, etc.)

Present the complete recommendation:

━━━━ AI Architecture Recommendation ━━━━

Based on your project description, here is the recommended setup:

📋 Project Type: {category} > {subcategory} > {purpose}
💻 Languages: {languages}
🗄️ Database: {database} ({reason})
⚡ Cache: {cache} ({reason})
🚀 Platform: {deployment} ({reason})
🛠️ Tech Stack: {tech_stack_items}
🔐 Auth: {auth_method} ({reason})
📊 State Management: {state_management} ({reason})

Reasoning: {2-3 sentences explaining why this architecture fits}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AskUserQuestion:
  question: "How does this architecture look?"
  header: "Review Recommendation"
  options:
    - label: "Accept all"
      description: "Use this recommendation as-is. Proceed to enforcement and CI/CD setup."
    - label: "Accept with modifications"
      description: "Start from this recommendation but let me change specific parts."
    - label: "Switch to manual mode"
      description: "Discard recommendation and choose everything manually step by step."

If "Accept all":
  → Map all recommendations to wizard answer variables
  → Set recommendation_mode = true, context.project_description = interview.vision
  → Skip to Phase 2 (Conditional Branching) — AI pre-fills branching answers from interview
  → Continue normally from Phase 2.5 (Enforcement)

If "Accept with modifications":
  → Map recommendations to wizard answer variables as defaults
  → Set recommendation_mode = true, context.project_description = interview.vision
  → Run Phase 1 steps (1-1 through 7) with recommendations PRE-SELECTED
  → User can override any step, recommended option shown as "(Recommended)"
  → Continue normally from Phase 2

If "Switch to manual mode":
  → Set wizard_mode = "manual", recommendation_mode = false
  → Fall through to Step 1-1 (normal manual flow)
```

---

## Mode B: Auto-Detect (if wizard_mode == "auto-detect")

AI scans the current project's files and code to detect the architecture
and tech stack already in use.

### Auto-Detect Step 1: Scan Project
```
Use Explore agent to scan the project directory:

1. Read package.json (or requirements.txt, go.mod, Cargo.toml, pom.xml, etc.)
   → Detect language, framework, dependencies
2. Read tsconfig.json, jsconfig.json, .babelrc, etc.
   → Detect TypeScript, build config
3. Read framework-specific configs:
   - next.config.js/ts → Next.js
   - nuxt.config.ts → Nuxt
   - vite.config.ts → Vite/React/Vue
   - angular.json → Angular
   - flutter pubspec.yaml → Flutter
   - Dockerfile, docker-compose.yml → Docker
4. Scan directory structure:
   - src/app/ → Next.js App Router
   - src/pages/ → Pages Router or Nuxt
   - prisma/ → Prisma ORM
   - supabase/ → Supabase
   - .github/workflows/ → GitHub Actions CI/CD
5. Read .env.example or .env.local for service integrations
6. Check for existing .claude/ directory and CLAUDE.md

Build detected_stack object from scan results.
```

### Auto-Detect Step 2: Present Detection Results
```
Display what was detected:

━━━━ Project Analysis Results ━━━━

📂 Project Root: {cwd}
📋 Detected Type: {category} > {subcategory}
💻 Languages: {detected_languages}
🧰 Framework: {framework} ({version})
🗄️ Database: {database} (from {detection_source})
⚡ Cache: {cache or "not detected"}
🚀 Deployment: {platform} (from {detection_source})
🛠️ Tech Stack:
  - {item1} (detected from {source})
  - {item2} (detected from {source})
  - ...
🔐 Auth: {auth or "not detected"}

Confidence: {high/medium/low}
Undetected: {list of fields that couldn't be auto-detected}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AskUserQuestion:
  question: "Does this look correct?"
  header: "Review Detection"
  options:
    - label: "Accept all"
      description: "Use detected configuration as-is. Fill in any undetected fields automatically."
    - label: "Accept with modifications"
      description: "Start from detection results but let me correct or add missing parts."
    - label: "Switch to manual mode"
      description: "Discard detection and choose everything manually."

If "Accept all":
  → Map detected_stack to wizard answer variables
  → AI fills undetected fields with best guesses based on detected stack
  → Set recommendation_mode = true
  → Skip to Phase 2.5 (Enforcement) — conditional branching also auto-filled
  → Continue normally

If "Accept with modifications":
  → Map detected_stack to wizard answer variables as defaults
  → Set recommendation_mode = true
  → Run Phase 1 steps with detected values PRE-SELECTED
  → User can override any step
  → Show undetected fields as regular questions (no pre-selection)
  → Continue normally from Phase 2

If "Switch to manual mode":
  → Set wizard_mode = "manual", recommendation_mode = false
  → Fall through to Step 1-1 (normal manual flow)
```

---

## Mode C: Manual Selection (if wizard_mode == "manual")

The standard step-by-step wizard. Optionally with recommendation labels
if user provides a project description.

### Step 0.6: Project Description (Optional, manual mode only)
```
AskUserQuestion:
  question: "Optionally describe your project for AI recommendations at each step."
  header: "Project Description (Optional)"
  options:
    - label: "Enter description"
      description: "AI will tag the most relevant options with (Recommended) labels at each step."
    - label: "Skip"
      description: "No recommendations. Full manual selection."

If "Enter description":
  → Free text input → Store as: context.project_description
  → Set: recommendation_mode = true

If "Skip":
  → Set: recommendation_mode = false
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

If recommendation_mode:
  Analyze context.project_description against each category's description, typical subcategories, and key_concerns.
  Append " (Recommended — {reason})" to the top 1-2 matching labels.

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

If recommendation_mode:
  Analyze context.project_description against each subcategory's key_concerns and typical_frameworks.
  Append " (Recommended — {reason})" to the top 1-2 matching labels.

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

If recommendation_mode:
  Analyze context.project_description against each purpose's key_concerns and description.
  Append " (Recommended — {reason})" to the top 1-2 matching labels.

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

If recommendation_mode:
  Analyze context.project_description for scale, real-time needs, cost sensitivity.
  Append " (Recommended — {reason})" to the best matching option.

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

If recommendation_mode:
  Analyze context.project_description against each language's suitable_project_types, frameworks, and key_benefits.
  Append " (Recommended — {reason})" to the top 1-2 matching labels.

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

If recommendation_mode:
  Analyze context.project_description against each database's features, use cases, and key_concerns.
  Append " (Recommended — {reason})" to the top 1-2 matching labels.

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

If recommendation_mode:
  Analyze context.project_description for real-time, session, rate-limiting needs.
  Append " (Recommended — {reason})" to the best matching option.

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

If recommendation_mode:
  Analyze context.project_description against each platform's strengths and deployment model.
  Append " (Recommended — {reason})" to the top 1-2 matching labels.

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

If recommendation_mode:
  Analyze context.project_description against each tech option's key_benefits and compatible_frameworks.
  Append " (Recommended — {reason})" to the top 1-2 matching labels.

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

If recommendation_mode:
  For each conditional step's options, analyze context.project_description against the option metadata.
  Append " (Recommended — {reason})" to the top 1-2 matching labels.

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
      description: "No CI/CD pipeline. Not needed or handled externally."
    - label: "Configure later"
      description: "Skip CI/CD setup now. Run /harness-marketplace:ci-cd anytime to configure it independently."

If "Configure later":
  → Set ci_cd.platform = "deferred"
  → Skip Steps C2 and C3 entirely

Store as: ci_cd.platform (also updates additional.ci_cd for backward compat)
```

### Step C2: Pipeline Selection (if ci_cd.platform not in ["none", "deferred"])
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

### Step E5: Implementation Strategy (pipeline.implement_strategy)

```
AskUserQuestion:
  question: "프로젝트 구현 전략은? (새 기능 개발 시 project-implement 파이프라인)"
  label_ko: "구현 전략"
  options:
    - label: "Standard (기본)"
      description: "scaffolder → implementer → integrator → test 순서. 대부분 프로젝트에 적합."
    - label: "TDD (Red-Green-Refactor)"
      description: "test-writer (실패 테스트) → implementer (최소 구현) → refactorer. 결제·인증·도메인 로직처럼 회귀 방지가 중요한 프로젝트에 권장."
    - label: "BDD (예약)"
      description: "향후 지원 예정. 현재는 standard 와 동일 + 안내 메시지."

Store as: pipeline.implement_strategy (values: "standard" | "tdd" | "bdd")
```

### Step E6: Codebase Analysis (pipeline.codebase_analysis.auto_on_refactor)

```
AskUserQuestion:
  question: "refactor 유형 작업 시 자동으로 codebase-analysis (Phase 2.5) 를 실행할까요?"
  label_ko: "refactor 자동 분석"
  options:
    - label: "Yes (권장)"
      description: "type=refactor 작업은 Plan 후 자동으로 영향 범위(impact) 분석을 실행. 대형 리팩토링에서 예상치 못한 의존성 체인 노출."
    - label: "No"
      description: "필요 시 /project-harness --analysis-first 로 수동 실행. 소형 프로젝트 / 속도 우선인 경우."

Store as: pipeline.codebase_analysis.auto_on_refactor (bool)
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
Load data/agents.yaml.

Step 1 — Hard filter:
  Remove agents where suitable_project_types does NOT include project_type.category.

Step 2 — Soft rank:
  AI ranks remaining agents by:
  - Matching key_concerns against the project's subcategory/purpose concerns
  - Matching recommended_when flags against derived classification flags (has_ui, has_backend, has_database, has_auth, has_realtime)
  - Tech stack compatibility

Step 3 — Show ALL filtered agents grouped by domain (typically 12-18 options).

AskUserQuestion:
  question: "Which verification agents should be included in your harness? (select all)"
  header: "Agents"
  multiSelect: true
  options: (all agents from data/agents.yaml that pass the hard filter, grouped by domain)
    Format per option:
    - label: "{name}"
      description: "{description}"
    Pre-check agents whose recommended_when flags match the project's derived flags.

If recommendation_mode:
  Analyze context.project_description + all prior answers against each agent's
  key_concerns, recommended_when, and suitable_project_types.
  Append " (Recommended — {reason})" to the top 3-5 matching agent labels.
  Example: "Security Reviewer (Recommended — essential for API projects with auth)"

Store as: agents[]
```

### Step C: Guide Selection
```
Load data/guides.yaml.

Step 1 — Hard filter:
  Remove guides where suitable_project_types does NOT include project_type.category.

Step 2 — Soft rank:
  AI ranks remaining guides by:
  - Matching key_topics against the project's subcategory/purpose concerns
  - Matching recommended_when flags against derived classification flags
  - Tech stack relevance

Step 3 — Show ALL filtered guides grouped by domain (typically 8-12 options).

AskUserQuestion:
  question: "Which development guides should be generated? (select all)"
  header: "Guides"
  multiSelect: true
  options: (all guides from data/guides.yaml that pass the hard filter, grouped by domain)
    Format per option:
    - label: "{name}"
      description: "{description}"
    Pre-check guides whose recommended_when flags match the project's derived flags.

If recommendation_mode:
  Analyze context.project_description + all prior answers against each guide's
  key_topics, recommended_when, and suitable_project_types.
  Append " (Recommended — {reason})" to the top 2-3 matching guide labels.
  Example: "Database Design Guide (Recommended — essential for Supabase schema management)"

Store as: guides[]
```

### Step D: Observability Stack Selection (REQUIRED — no skip)

```
Load data/observability-platforms.yaml.

Rationale:
  A service that ships without error tracking, product analytics, and a
  health signal is effectively blind in production. The wizard treats
  observability selection as a required gate rather than an optional
  add-on. Users who truly don't want observability can pick the
  "minimal" preset (Sentry free tier only) but cannot proceed with none.

Step 1 — Hard filter:
  Remove platforms where suitable_project_types does NOT include project_type.category.
  Remove platforms whose pricing_tier == "paid_only" when the user has
  indicated a solo/small team-size preset (reduce sticker shock).

Step 2 — Group by primary_category:
  error_tracking, apm, product_analytics, logs_metrics, vendor_neutral, native.

Step 3 — Soft rank within each group:
  AI ranks each platform by:
  - compatible_frameworks intersection with the chosen frontend/backend framework
  - recommended_when flag match against derived classification flags
  - deployment_platform match (e.g., vercel-analytics is recommended_when
    deployment_platform_vercel is true)
  - integration_template_path presence (platforms with a PoC template are
    preferred over those requiring manual integration)

Step 4 — Present three sub-questions (AskUserQuestion each):

  Q-D.1: "Which error-tracking platform should we wire up?"
    header: "Error Tracking"
    multiSelect: false  (exactly one required)
    options: all platforms from error_tracking + native (if applicable)
      Pre-select Sentry when it passes the hard filter (has an integration
      template and covers the widest framework set).

  Q-D.2: "Which product analytics platform(s) should we wire up? (optional but recommended)"
    header: "Product Analytics"
    multiSelect: true  (zero or more allowed)
    options: all platforms from product_analytics + native
      Pre-select PostHog when has_ui is true (integration template exists).

  Q-D.3: "Do you want an additional APM/logs platform for backend observability?"
    header: "Backend APM (optional)"
    multiSelect: false  (zero or one)
    options: [None] + all platforms from apm + logs_metrics + vendor_neutral
      Pre-select None for solo/small team-size presets.
      Pre-select OpenTelemetry for teams who want vendor-neutral instrumentation.

  Only show Q-D.3 when has_backend == true.

If recommendation_mode:
  Append " (Recommended — {reason})" to each pre-selected option with a
  short rationale drawn from key_benefits and the matched recommended_when flags.
  Example: "Sentry (Recommended — first-class Next.js SDK, free tier covers 5K errors/month)"
  Example: "PostHog (Recommended — bundles analytics+session replay+feature flags, 1M events/month free)"

Validation:
  - Q-D.1 answer MUST NOT be empty. If user tries to skip, re-prompt with:
    "An error-tracking platform is required. Pick Sentry (free tier) as a
    minimum so production errors are captured. You can always change this later."
  - If Q-D.3 is skipped or answered "None", emit a warning that distributed
    tracing won't be available and document this decision in project-config.

Store as:
  observability:
    error_tracking: { platform_id, integration_template_path }
    product_analytics: [{ platform_id, integration_template_path }, ...]
    apm: { platform_id | null, integration_template_path | null }
```

## Phase 5: Generation

### Step 5.1: Build project-config.yaml
```
Map all wizard answers to the project-config.yaml schema:

1. Set context: wizard_mode, project_description (from interview vision, manual input, or auto-detect summary)
2. Set metadata: version, generated_by, language
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
15. Set pipeline section from Phase 2.5 Step E5/E6 answers:
    - pipeline.implement_strategy: "standard" | "tdd" | "bdd" (default "standard")
    - pipeline.codebase_analysis.auto_on_refactor: bool (default true)
    - pipeline.codebase_analysis.default_type_for_phase_2_5: "impact" (default)
    - pipeline.codebase_analysis.archive_history: false (default)
    - pipeline.codebase_analysis.parallel_explorer_count: 3 (default)
    - pipeline.codebase_analysis.timeout_per_explorer_ms: 180000 (default)
16. Set observability section from Phase 4 Step D answers:
    - observability.error_tracking:
        platform_id: {Q-D.1 answer}
        integration_template_path: (looked up from data/observability-platforms.yaml)
        env_vars: (copied from platform entry)
    - observability.product_analytics: (list from Q-D.2 answer; [] if none)
        each: { platform_id, integration_template_path, env_vars }
    - observability.apm:
        platform_id: {Q-D.3 answer} | null
        integration_template_path: ... | null
        env_vars: [] | [...]
    Also add implicit 'observability-auditor' to agents[] if not already selected,
    and 'observability-fundamentals' to guides[] if not already selected.

Write to: .claude/skills/project-harness/project-config.yaml
```

### Step 5.1c: Emit observability integration files
```
Purpose: translate the observability platform selections into actual
boilerplate files inside the generated project.

For each platform referenced under observability.* with a non-null
integration_template_path:

  1. Read templates/integrations/README.md to resolve the Wizard→template
     mapping table (which specific .template files apply given the combination
     of platform_id + frontend.framework + backend.framework).
  2. For each applicable .template file:
     a. Compute the destination path inside the project following the
        conventions in templates/integrations/README.md (e.g.,
        sentry/nextjs-init.ts.template → ./instrumentation.ts).
     b. Substitute tokens:
        - {{PROJECT_NAME}} → project_type.purpose fallback to dir name
        - {{VERSION}} → plugin version
        - {{TRACES_SAMPLE_RATE}} → enforcement.level-based default
            strict   → 1.0
            standard → 0.2
            minimal  → 0.1
        - {{PROFILES_SAMPLE_RATE}} → same mapping as TRACES_SAMPLE_RATE but halved
        - other tokens per template header comments
     c. Resolve {{CONDITION:flag}} blocks against classification flags.
     d. Write to the destination path.
  3. If the destination already exists:
     - Diff new content against existing.
     - Prompt user: "Overwrite / Keep existing / Skip this platform"
     - On "Keep existing" → emit a warning and record in generation_log.
  4. If platform has integration_template_path: null:
     - Emit a stub file at `.claude/skills/project-harness/integrations/{platform_id}-TODO.md`
       with a link to the official docs and a reminder to wire it up manually.
     - Record in generation_log.observability.manual_platforms[].

Update the generated .env.example (or create one) with the union of all
required env_vars across selected platforms, each with a short comment
naming the platform that requires it.
```

### Step 5.1b: Write project-root CLAUDE.md (orchestration entrypoint guide)
```
Purpose: after wizard completes, Claude Code sessions in this project must read an
authoritative CLAUDE.md at the project root telling user+Claude that non-trivial
work should flow through `/project-harness`. Without this, the full orchestration
scaffolding installed below stays dormant because nothing nudges toward it.

1. Check if ./CLAUDE.md exists at **project root** (NOT inside .claude/):

2. If exists:
   → AskUserQuestion: "프로젝트 루트에 기존 CLAUDE.md 가 있습니다. 어떻게 처리할까요?"
     label_ko: "CLAUDE.md 처리 방식"
     options:
       (a) label: "GENERATED 섹션만 업데이트 (Custom Rules 보존)"
           description_ko: "<!-- ═══ GENERATED ═══ --> 마커가 있으면 GENERATED 구간만 새 템플릿으로 교체. 마커 아래 Custom Rules 는 그대로 보존."
           → marker-based merge:
             - Locate "<!-- ═══ GENERATED BY harness-marketplace" header
             - Locate "<!-- ═══ END GENERATED CONTENT" footer
             - If both markers found: replace only the region between (inclusive of header/footer)
             - If no markers: fall back to option (b) with a warning
       (b) label: "전체 교체 (기존 파일 백업 후 재생성)"
           description_ko: "기존 ./CLAUDE.md 를 ./CLAUDE.md.backup-{ISO-timestamp} 로 백업하고 템플릿으로 완전 재생성."
           → mv ./CLAUDE.md ./CLAUDE.md.backup-{timestamp}
           → render and write fresh
       (c) label: "건너뛰기 (CLAUDE.md 변경 없음)"
           description_ko: "기존 파일을 그대로 유지. 대신 wizard 완료 메시지에서 /project-harness entrypoint 안내만 표시."
           → skip file write; set generation_log.claude_md_status = "skipped"

3. If does NOT exist: proceed directly to rendering (no question).

4. Read templates/CLAUDE.md.template

5. Substitute placeholders from project-config.yaml + detected_stack + wizard state:
   - {{PROJECT_NAME}} → project_type.purpose (or projectDirName fallback)
   - {{VERSION}} → plugin version from plugin's package.json
   - {{STACK_SUMMARY}} → 1-2 line summary concatenating platform.frontend.framework +
     platform.backend.framework + platform.database.primary (skip null fields)
   - {{VERIFY_AGENT_COUNT}} → count of entries in agents.selected (will be filled at Step 5.3;
     if Step 5.3 not yet run, use len(agents.recommended) as approximation)
   - {{ENFORCEMENT_LEVEL}} → enforcement.level ("strict" / "standard" / "minimal")
   - {{HOOKS_TABLE}} → render active hooks as markdown table rows. Example for standard level:
     | `protected-files` | PreToolUse(Edit/Write) | `.env*`, lock files, migrations 편집 차단 |
     | `secret-guard` | PreToolUse(Write) | 하드코딩된 secret/API key/token 차단 |
     | `pattern-guard` | PreToolUse(Edit/Write) | 아키텍처 규칙 위반 차단 |
     | `db-safety` | PreToolUse(Bash) | DROP/TRUNCATE/DELETE-without-WHERE 차단 |
     Conditional rows (only if enabled):
     | `post-edit-lint` | PostToolUse(Edit/Write) | 편집 후 lint 자동 실행 | (if has_lint)
     | `post-edit-typecheck` | PostToolUse(Edit/Write) | 편집 후 타입체크 | (if has_typecheck)
   - {{STACK_CONVENTIONS}} → aggregated from selected guides. For each selected guide,
     extract its 1-3 line "key conventions" summary. If no guides selected yet, emit:
     "_스택 컨벤션은 선택된 가이드 (`.claude/skills/project-harness/guides/*.md`) 에서 확인하세요._"
   - {{CONDITION:has_ui}} block → include/exclude based on flags.has_ui
   - {{CONDITION:bugfix_debug}} block → include if project_type supports bugfix AND
     debug_complexity != "low"

6. Write result to ./CLAUDE.md (project root)

7. Log to generation_log.claude_md_status = "created" | "merged" | "replaced" | "skipped"
   and record path in state/wizard-log.yaml for downstream validation.
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
- .claude/skills/project-harness/project-interview/SKILL.md ← templates/interview.md
- .claude/skills/project-harness/plan/SKILL.md ← templates/plan.md
- .claude/skills/project-harness/implement/SKILL.md ← templates/implement.md
- .claude/skills/project-harness/verify/SKILL.md ← templates/verify.md

References (shared UX + data contracts — consumed by all sub-skills):
- .claude/skills/project-harness/references/progress-format.md ← templates/progress-format.md
- .claude/skills/project-harness/references/ui-conventions.md ← templates/ui-conventions.md
- .claude/skills/project-harness/references/classification.md ← templates/classification.md
- .claude/skills/project-harness/references/handoff-templates.md ← templates/handoff-templates.md
- .claude/skills/project-harness/references/schemas.md ← templates/schemas.md
- .claude/skills/project-harness/references/guide-injection.md ← templates/guide-injection.md
- .claude/skills/project-harness/references/monitor-mode.md ← templates/monitor-mode.md
- .claude/skills/project-harness/references/parallel-execution.md ← templates/parallel-execution.md

Conditional:
- .claude/skills/project-harness/visual-qa/SKILL.md ← templates/visual-qa.md (only if has_ui)
- .claude/skills/project-harness/visual-qa/scripts/visual-inspect.js ← templates/visual-inspect.js (only if has_ui)
- .claude/skills/project-harness/debug/SKILL.md ← templates/debug.md (only if project_type supports bugfix AND debug_complexity != "low")
- .claude/skills/project-harness/prd/  (empty directory for interview mode PRD output)
- .claude/skills/project-harness/codebase-analysis/SKILL.md ← templates/codebase-analysis.md (optional — always copy; skill invoked conditionally by Phase 2.5)
- .claude/skills/project-harness/references/tdd-implementation.md ← templates/tdd-implementation.md (only if pipeline.implement_strategy != "standard")
- .claude/skills/project-harness/references/ui-defect-patterns.md ← templates/ui-defect-patterns.md (only if flags.has_ui == true)
- .claude/skills/project-harness/references/fsd-scaffold-patterns.md ← templates/fsd-scaffold-patterns.md (only if tech_stack.architecture == "fsd")
```

### Step 5.3: AI-Generate Specialized Files
```
For each selected agent, load its full entry from data/agents.yaml and spawn an AI generation task:

Prompt pattern for agents:
"Generate a Claude Code agent definition markdown file for a {agent_name} agent.
Project context: {project_type}, {tech_stack}, {platform}.
Agent catalog metadata:
  - Domain: {domain}
  - Description: {description}
  - Key concerns to validate: {key_concerns}
The agent should include:
- Frontmatter: name, description, model ({model from catalog, default sonnet})
- Role description based on the agent's domain and catalog description
- Required validation checklist (10-15 items specific to this project's tech stack,
  covering the key_concerns from the catalog)
- Constraints
- Output format
Reference the game-harness agent format: name, description, model, checklist items."

Write to: .claude/skills/project-harness/agents/{agent_name}.md

For each selected guide, load its full entry from data/guides.yaml and spawn an AI generation task:

Prompt pattern for guides:
"Generate a development guide for {guide_name} tailored to: {project_type} using {tech_stack}.
Guide catalog metadata:
  - Domain: {domain}
  - Description: {description}
  - Key topics to cover: {key_topics}
Include:
- Purpose and scope
- Key rules and conventions (10-20 rules, covering the key_topics from the catalog)
- Examples with code snippets using the project's actual tech stack
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

Hook contract (Claude Code v2.x):
  - Hooks read tool_input as JSON from stdin (NOT from $1 argv or $CLAUDE_TOOL_INPUT_* env vars)
  - PreToolUse blocking exit code is 2 (NOT 1 — exit 1 is treated as a non-blocking error)
  - Each generated hook sources two shared helpers via `source "$(dirname "$0")/_parse.sh"`
    and `source "$(dirname "$0")/_log.sh"` (PostToolUse hooks source _parse.sh only;
    SessionStart sources _log.sh only)

First, copy the v2.x helpers as-is (no placeholder substitution):
  - templates/hooks/_parse.sh → .claude/skills/project-harness/hooks/_parse.sh
  - templates/hooks/_log.sh   → .claude/skills/project-harness/hooks/_log.sh
  These files have no {{...}} placeholders and must NOT be templated.

Then for each active hook category, load the corresponding template from templates/hooks/:

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

### Step 5.7: Generate CI/CD Workflows (if ci_cd.platform not in ["none", "deferred"])
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
   - references/classification.md
   - references/schemas.md
   - references/progress-format.md
   - references/ui-conventions.md
   - references/handoff-templates.md
   - references/guide-injection.md
   - references/monitor-mode.md
   - references/parallel-execution.md
   - codebase-analysis/SKILL.md (always copied — Phase 2.5 invokes it conditionally)
   - agents/*.md (at least one)
   - guides/*.md (at least one)

Conditional references (only when activation flag set):
   - references/tdd-implementation.md (required iff pipeline.implement_strategy != "standard")
   - references/ui-defect-patterns.md (required iff flags.has_ui == true)
   - references/fsd-scaffold-patterns.md (required iff tech_stack.architecture == "fsd")
   - agents/supabase-security-gate.md (required iff agents.selected includes supabase-security-gate)
   - guides/supabase-security.md (required iff guides.selected includes supabase-security)

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

7. Project-root CLAUDE.md validation (unless claude_md_status == "skipped"):
   - ./CLAUDE.md exists at project root
   - Contains "<!-- ═══ GENERATED BY harness-marketplace" header marker
   - Contains "<!-- ═══ END GENERATED CONTENT" footer marker
   - No unresolved template variables ({{...}}) inside the GENERATED region
   - Mentions "/project-harness" at least once (orchestration entrypoint guidance present)
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
  Wizard Mode: {interview / manual / auto-detect}
  Description: "{first 80 chars}..."    (if description was provided)
  Language: {language}
  Serverless: {yes/no}
  Platform: {deployment.platform}
  Stack: {key tech stack items}

🔒 Enforcement: {level}
  Hooks: {count} active ({hook_names})
  Protected files: {count} patterns

🔄 CI/CD: {platform}                   (or "Deferred — run /harness-marketplace:ci-cd")
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
  │   ├── _parse.sh                        ← v2.x stdin JSON parser (helper)
  │   ├── _log.sh                          ← block event logger (helper)
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
- `Agent(subagent_type="general-purpose")` — AI generation of agents/guides (parallel)
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

<Good>
Smart recommendation with project description:
```
User described: "Real-time multiplayer card game with matchmaking,
chat, and in-game purchases for mobile"

Step 1-1 | Category

What type of project are you building?

  ● Game (Recommended — matches "card game", "multiplayer")
    Interactive entertainment software from indie to AAA.

  ○ Mobile
    Mobile applications — native, cross-platform, hybrid.

  ○ Backend / API
    Server-side services — REST API, GraphQL, gRPC.

  ○ Web
    Web applications — SPA, SSR, SSG, PWA.
```
Why good: Description-based recommendation with clear reason. All options still shown.
</Good>

<Good>
Deep Interview mode — full architecture recommendation:
```
Interview Q1: "I want to build a SaaS dashboard for 
managing restaurant orders in real-time"
Interview Q2: "Core features: order management, live kitchen 
display, analytics, multi-tenant. Expected 500 restaurants."
Interview Q3: "Small team, need to ship MVP in 2 months. 
Must use Stripe for payments."

AI Recommendation:
  Type: Web > SSR > SaaS Dashboard
  Language: TypeScript
  Framework: Next.js (App Router)
  DB: Supabase (PostgreSQL + Realtime)
  Cache: Upstash Redis
  Platform: Vercel
  Auth: Supabase Auth (JWT)
  Stack: Tailwind, shadcn/ui, Zustand

  [Accept all] [Accept with modifications] [Switch to manual]
```
Why good: AI infers full stack from interview. User reviews and confirms.
</Good>

<Good>
Auto-Detect mode — scan existing project:
```
Scanning project...

Detected:
  Type: Web > SSR
  Language: TypeScript (from tsconfig.json)
  Framework: Next.js 14 (from package.json)
  DB: PostgreSQL via Prisma (from prisma/schema.prisma)
  Auth: NextAuth.js (from src/app/api/auth/)
  Stack: Tailwind (tailwind.config.ts), shadcn/ui (components.json)
  Deployment: Vercel (from vercel.json)
  Undetected: Cache, Purpose

  [Accept all] [Accept with modifications] [Switch to manual]
```
Why good: Automatically fills config from existing code. Minimal user input.
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
- [ ] Phase 0: Pre-checks complete (existing harness, Agent Teams)
- [ ] Phase 1: All 8 common steps asked with detailed descriptions
- [ ] Phase 2: Conditional branching steps executed for project category
- [ ] Step 0.5: Wizard mode selected (Deep Interview / Manual / Auto-Detect)
- [ ] If Interview mode: 3-5 questions asked, full architecture recommended, user confirmed
- [ ] If Auto-Detect mode: project scanned, detection results presented, user confirmed
- [ ] If Manual mode: optional description asked, recommendation labels on subsequent steps
- [ ] Recommendations are label-only (no filtering based on description)
- [ ] Phase 2.5: Enforcement level, protected files, CI/CD platform (or deferred), pipelines, self-learning configured
- [ ] Phase 3: AI additional questions (0-3) asked if gaps detected
- [ ] Phase 4: Agents and guides selected via multiSelect checkboxes
- [ ] Phase 5: All files generated (config + skills + agents + guides + references)
- [ ] Step 5.1b: Project-root CLAUDE.md created/merged/skipped (user's choice on collision, default create)
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
