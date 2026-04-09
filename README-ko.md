# harness-marketplace

**프로젝트 맞춤형 개발 파이프라인 harness 스킬을 생성하는 스캐폴딩 위자드 — Claude Code 플러그인**

프로젝트 유형, 기술 스택, 배포 환경에 맞는 완전한 개발 파이프라인(plan → implement → visual-qa → verify)을 생성합니다. Hook 기반 코드 강제, CI/CD 파이프라인 생성, 자기 학습 기능을 포함합니다. 하나의 위자드로 모든 프로젝트를 지원합니다.

> **[English](./README.md)**

---

## 기능 요약

```
/harness-marketplace:wizard
  │
  ├─ 프로젝트에 대한 단계별 질문
  │   (유형, 언어, DB, 플랫폼, 기술스택,
  │    코드 강제, CI/CD, 자기학습...)
  │
  ├─ 완전한 harness 스킬 세트 생성
  │   ├── project-config.yaml       — 모든 것을 결정하는 마스터 설정
  │   ├── plan/SKILL.md             — 계획 단계
  │   ├── implement/SKILL.md        — 구현 단계
  │   ├── visual-qa/SKILL.md        — 시각적 QA (UI 프로젝트인 경우)
  │   ├── verify/SKILL.md           — 검증 단계
  │   ├── agents/*.md               — AI 생성 도메인 에이전트
  │   ├── guides/*.md               — AI 생성 개발 가이드
  │   ├── hooks/*.sh                — Claude Code hook 기반 코드 강제
  │   ├── hooks-config.json         — settings.json용 hook 설정
  │   ├── .github/workflows/*.yml   — CI/CD 파이프라인 + AI 코드리뷰
  │   ├── state/learning-log.yaml   — 자기 학습 이력
  │   └── references/               — 분류 규칙, 스키마, 옵션
  │
  └─ 검증 완료 후 /project-harness 로 즉시 사용 가능
```

## 설치

```bash
/plugin marketplace add <repo-url>
/plugin install harness-marketplace
```

또는 수동 설치:

```bash
cp -r harness-marketplace/ ~/.claude/plugins/cache/harness-marketplace/harness-marketplace/1.0.0/
```

## 사용법

### 새 harness 생성

```bash
/harness-marketplace:wizard
```

위자드가 한 단계씩 질문합니다:

| 단계 | 질문 | 예시 선택지 |
|------|------|-----------|
| 0 | 언어 선택 | English, 한국어 |
| 1-1 | 프로젝트 대분류 | 웹, 모바일, 백엔드, 데스크탑, 게임, CLI, 데이터, IoT |
| 1-2 | 세부 유형 | SSR, SPA, SSG, Full-stack... |
| 1-3 | 용도 | 이커머스, SaaS, 대시보드... |
| 2 | 서버리스 여부 | 예 / 아니오 / 하이브리드 |
| 3 | 프로그래밍 언어 | TypeScript, Python, Go... (복수 선택) |
| 4 | 데이터베이스 | Supabase, PostgreSQL, MongoDB... |
| 5 | 캐시 서버 | Redis, Upstash, CDN, 없음 |
| 6 | 배포 플랫폼 | Vercel, AWS, Railway, Docker... |
| 7 | 기술 스택 | Tailwind, shadcn/ui, FSD, Turborepo... (복수 선택) |
| 8+ | 조건부 질문 | 인증 방식, 상태관리... (프로젝트 유형에 따라 다름) |
| E1 | 코드 강제 수준 | Strict / Standard / Minimal / None |
| E2 | 보호 파일 | .env, lock 파일, 마이그레이션... (복수 선택) |
| E3 | 커스텀 규칙 | "서비스 레이어에서 직접 SQL 금지"... (자유 텍스트, strict만) |
| C1 | CI/CD 플랫폼 | GitHub Actions / GitLab CI / None |
| C2 | 파이프라인 | CI, AI 코드리뷰, 배포, 보안... (복수 선택) |
| C3 | AI 리뷰 설정 | 코멘트만 / Critical 시 차단 / 자동 Approve |
| L1 | 자기 학습 | 승인 후 학습 / 자동 학습 / 비활성화 |
| A | 에이전트 선택 | security-reviewer, performance-auditor... (복수 선택) |
| G | 가이드 선택 | api-design, database-design... (복수 선택) |

모든 질문 완료 후: 파일 생성 → 구조 검증 (hook + CI/CD 포함) → plan 드라이런 → hook을 settings.json에 머지 → 사용자 확인.

### 기존 harness 업그레이드

```bash
/harness-marketplace:upgrade
```

`project-config.yaml`, hook의 Custom Rules 섹션, `learning-log.yaml`을 보존하면서 템플릿 기반 파일만 최신 버전으로 업데이트합니다.

### 생성된 harness 사용

```bash
/project-harness "사용자 인증 구현"
/project-harness --dry-run "결제 연동 추가"
/project-harness --resume
```

---

## 마크다운을 넘어서 — 3개의 새로운 레이어

### Layer 1: Hook 기반 코드 강제

에이전트가 가이드라인을 "읽고 따르는" 것이 아니라, Claude Code hook이 코드 레벨에서 **실시간으로 차단하거나 자동 수정**합니다.

| Hook | 이벤트 | 역할 |
|------|--------|------|
| 보호 파일 | PreToolUse | .env, lock 파일, 적용된 마이그레이션 수정 차단 |
| DB 안전 | PreToolUse | 위험한 SQL 차단 (DROP TABLE, TRUNCATE, WHERE 없는 DELETE) |
| 시크릿 감지 | PreToolUse | 소스 코드에 비밀번호/API키 하드코딩 방지 |
| 패턴 강제 | PreToolUse | 아키텍처 규칙 강제 (FSD 레이어, 리포지토리 패턴, 커스텀 규칙) |
| 자동 린트 | PostToolUse | 파일 수정 후 자동 린터 실행 |
| 자동 타입체크 | PostToolUse | .ts/.tsx 파일 수정 후 자동 타입체크 |
| 자동 포맷 | PostToolUse | 파일 수정 후 자동 포맷터 실행 |
| 세션 초기화 | SessionStart | 시작 시 프로젝트 컨텍스트 로드 및 환경 검증 |

**강제 수준:**

| 수준 | 활성화되는 hook |
|------|---------------|
| **Strict** | 전체: 보호 파일, 린트, 타입체크, 포맷, 패턴, 시크릿, DB 안전 |
| **Standard** | 핵심: 보호 파일, 린트, 타입체크, 시크릿 |
| **Minimal** | 보호 파일만 |
| **None** | Hook 없음 — 마크다운 전용 harness (v0.1.0 호환) |

Hook 스크립트는 **업그레이드 안전한** 2섹션 구조를 사용합니다:
- **Generated Rules** — 업그레이드 시 재생성
- **Custom Rules** — 업그레이드 시 보존 (자기 학습이 규칙을 추가하는 곳)

### Layer 2: CI/CD 파이프라인 생성

프로젝트 설정에 맞는 실제 CI/CD 워크플로우 파일을 생성합니다:

| 파이프라인 | 트리거 | 설명 |
|-----------|--------|------|
| **CI** | push, PR | 테스트 + 린트 + 타입체크 + 빌드 |
| **AI 코드리뷰** | PR | Claude API가 diff 리뷰, 코멘트 게시, 선택적 머지 차단 |
| **프리뷰 배포** | PR | PR별 프리뷰 환경 배포 (Vercel, Netlify, Railway, Fly.io) |
| **프로덕션 배포** | main push | 프로덕션 자동 배포 (Vercel, AWS, Docker 등) |
| **보안 스캔** | 주간, PR | 의존성 감사 + 시크릿 스캔 + CodeQL 분석 |

**지원 플랫폼:** GitHub Actions, GitLab CI

**AI 코드리뷰**는 Claude API를 사용하여:
1. PR diff를 가져옴
2. 로직 버그, 보안 취약점, 성능 이슈, 코드 품질을 리뷰
3. 심각도별 리뷰 코멘트 게시 (CRITICAL / WARNING / INFO)
4. 선택적으로 Critical 이슈 발견 시 머지 차단

### Layer 3: 자기 학습

하네스가 implement/verify 단계에서 발생한 실수로부터 학습하여 **시간이 지날수록 똑똑해집니다**:

```
AI가 구현 중 실수
  → verify 단계에서 회귀(regression) 감지
  → 수정 적용
  → 자기 학습 엔진 가동:
      ├── 근본 원인 분류 (PATTERN_VIOLATION, UNSAFE_OPERATION, CONVENTION_BREAK, ...)
      ├── 자동 감지 가능 여부 판단 → 방지 규칙 초안
      ├── 제안: hook 규칙 추가 + 가이드 노트
      └── 사용자 승인 (또는 automatic 모드에서 자동 적용)
  → Hook 스크립트 업데이트 (Custom Rules 섹션)
  → 가이드 업데이트 (Lessons Learned 섹션)
  → 학습 로그 기록 (state/learning-log.yaml)
  → 같은 실수가 다시는 발생하지 않음
```

**자기 학습 모드:**

| 모드 | 동작 |
|------|------|
| **승인** (권장) | AI가 새 규칙 제안, 사용자가 AskUserQuestion으로 승인 |
| **자동** | AI가 자동 적용, 전부 로그 기록 |
| **비활성화** | 정적 하네스, 진화 없음 |

**가드레일:**
- 수정 가능한 파일: `hooks/*.sh`의 Custom Rules 섹션, `guides/*.md`, `state/learning-log.yaml`만
- 수정 불가: SKILL.md 파일, project-config.yaml 핵심 필드, settings.json 직접 수정
- 최대 규칙 수 제한 (기본 20개)으로 무한 축적 방지
- 중복 감지로 같은 규칙 이중 추가 방지

---

## 동작 원리

### 하이브리드 생성 방식

| 구성요소 | 방식 | 출처 |
|---------|------|------|
| SKILL.md 파일 (orchestrator, plan, implement, verify) | **템플릿** | `templates/*.md` — 파이프라인 구조 일관성 유지 |
| project-config.yaml | **매핑** | 위자드 답변 → YAML 스키마 |
| Hook 스크립트 (hooks/*.sh) | **템플릿** | `templates/hooks/*.sh.template` — 강제 수준에 따라 조건부 |
| CI/CD 워크플로우 (.github/workflows/*.yml) | **템플릿** | `templates/ci-cd/github-actions/*.yml.template` — 플랫폼에 따라 조건부 |
| agents/*.md | **AI 생성** | Claude가 프로젝트 특화 에이전트 체크리스트 생성 |
| guides/*.md | **AI 생성** | Claude가 프로젝트 특화 개발 가이드 생성 |
| classification.md | **AI 생성** | 프로젝트 특화 분류 규칙 |

### Config 기반 파이프라인

생성된 `project-config.yaml`이 모든 것을 결정합니다:

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

flags:                    # 자동 파생
  has_ui: true
  has_backend: true
  has_database: true
  visual_qa_capable: true

agents:                   # 사용자 선택
  - security-reviewer
  - performance-auditor

guides:                   # 사용자 선택
  - api-design
  - database-design

enforcement:              # 코드 레벨 강제 (Layer 1)
  level: standard
  protected_files:
    - "**/.env*"
    - "package-lock.json"
  custom_rules: []

ci_cd:                    # CI/CD 파이프라인 생성 (Layer 2)
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

self_learning:            # 자기 학습 (Layer 3)
  enabled: true
  mode: approval
  max_auto_rules: 20
```

### 지원하는 프로젝트 유형

| 대분류 | 세부 유형 | 예시 용도 |
|--------|----------|----------|
| **웹** | SPA, SSR, SSG, Full-stack, PWA, MPA | 이커머스, SaaS, 블로그, 대시보드 |
| **모바일** | Native iOS/Android, 크로스플랫폼, 하이브리드 | 소셜, 핀테크, 헬스, 배달 |
| **백엔드** | REST, GraphQL, gRPC, 마이크로서비스, 모놀리스 | API 서비스, 데이터 파이프라인, 인증 |
| **데스크탑** | Electron, Tauri, Native | 생산성, 미디어, 개발 도구 |
| **게임** | 2D, 3D, 서버, 캐주얼, TCG | RPG, 퍼즐, 멀티플레이어, 카지노 |
| **CLI** | CLI 도구, SDK, 라이브러리, 프레임워크 | 빌드 도구, 린터, 제너레이터 |
| **데이터** | ML 파이프라인, ETL, 분석, 챗봇 | 예측, NLP, 시각화 |
| **IoT** | 임베디드, 엣지, 게이트웨이, 스마트홈 | 모니터링, 자동화, 웨어러블 |

---

## 플러그인 구조

```
harness-marketplace/
├── .claude-plugin/
│   ├── plugin.json                # 플러그인 매니페스트
│   └── marketplace.json           # 마켓플레이스 메타데이터
├── skills/
│   ├── wizard/SKILL.md            # 메인 스캐폴딩 위자드 (15+ 단계)
│   └── upgrade/SKILL.md           # Harness 업그레이드 스킬 (Custom Rules 보존)
├── templates/                     # Harness 골격 템플릿
│   ├── orchestrator.md            # 파이프라인 오케스트레이터
│   ├── plan.md                    # 계획 단계
│   ├── implement.md               # 구현 단계 (Learning Loop 포함)
│   ├── visual-qa.md               # 시각적 QA 단계
│   ├── verify.md                  # 검증 단계 (Learning Loop 포함)
│   ├── self-learning.md           # 자기 학습 엔진
│   ├── config-schema.yaml         # 설정 스키마 (enforcement/ci_cd/self_learning 포함)
│   ├── classification.md          # 작업 분류 규칙
│   ├── hooks/                     # Hook 스크립트 템플릿
│   │   ├── protected-files.sh.template
│   │   ├── db-safety.sh.template
│   │   ├── secret-guard.sh.template
│   │   ├── pattern-guard.sh.template
│   │   ├── post-edit-lint.sh.template
│   │   ├── post-edit-typecheck.sh.template
│   │   ├── post-edit-format.sh.template
│   │   ├── session-init.sh.template
│   │   └── hooks-config.json.template
│   └── ci-cd/                     # CI/CD 워크플로우 템플릿
│       └── github-actions/
│           ├── ci.yml.template
│           ├── ai-review.yml.template
│           ├── deploy-preview.yml.template
│           ├── deploy-prod.yml.template
│           └── security.yml.template
├── data/                          # 딥리서치 옵션 데이터셋
│   ├── project-types.yaml         # 3단계 프로젝트 분류 체계 (8개 대분류)
│   ├── languages.yaml             # 프로그래밍 언어
│   ├── databases.yaml             # 데이터베이스 (서버리스 & 전통)
│   ├── cache-servers.yaml         # 캐시 옵션
│   ├── platforms.yaml             # 배포 플랫폼
│   ├── tech-stacks.yaml           # 기술 스택 옵션
│   ├── mcps.yaml                  # MCP 서버 요구사항
│   ├── branching-tree.yaml        # 조건분기 위자드 단계
│   ├── hook-patterns.yaml         # Hook 패턴 카탈로그 (20개 패턴)
│   ├── ci-cd-pipelines.yaml       # CI/CD 파이프라인 카탈로그
│   └── enforcement-rules.yaml     # 강제 프리셋 & 기술스택별 규칙
├── scripts/
│   ├── validate-harness.js        # 구조, 설정, hook, CI/CD, 자기학습 검증기
│   └── merge-hooks.js             # settings.json 비파괴적 hook 머지
├── LICENSE                        # Apache-2.0
├── NOTICE                         # 귀속 표시
├── package.json
├── README.md
└── README-ko.md
```

## 요구사항

- **Claude Code** Agent Teams 활성화 (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)
- **omc** (oh-my-claudecode) — 선택사항, 설치 시 상태 관리 향상

## revfactory/harness 와의 비교

| 관점 | revfactory/harness | harness-marketplace |
|------|-------------------|---------------------|
| 범위 | 범용 (모든 도메인) | **소프트웨어 개발 파이프라인 특화** |
| 입력 | 자연어 프롬프트 | **구조화된 위자드** (15+ 단계) |
| 생성 | 전체 AI 생성 | **하이브리드** (템플릿 + AI) |
| 설정 | 없음 (마크다운만) | **project-config.yaml** 기반 |
| 파이프라인 | 범용 에이전트 팀 | **plan → implement → visual-qa → verify** |
| 코드 강제 | 없음 | **Claude Code hooks** (PreToolUse/PostToolUse) |
| CI/CD | 없음 | **GitHub Actions / GitLab CI** 생성 + AI 코드리뷰 |
| 자기 학습 | 없음 | **자동 진화** — 회귀에서 hook + 가이드 업데이트 |
| 검증 | 기본 드라이런 | 구조 + hook + CI/CD + plan 드라이런 + 사용자 확인 |
| 업그레이드 | 없음 | config 보존 템플릿 업그레이드 (Custom Rules 보존) |

## 라이선스

Apache-2.0 — 자세한 내용은 [LICENSE](./LICENSE)를 참조하세요.
