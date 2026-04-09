# harness-marketplace

**프로젝트 맞춤형 개발 파이프라인 harness 스킬을 생성하는 스캐폴딩 위자드 — Claude Code 플러그인**

프로젝트 유형, 기술 스택, 배포 환경에 맞는 완전한 개발 파이프라인(plan → implement → visual-qa → verify)을 생성합니다. Hook 기반 코드 강제, CI/CD 파이프라인 생성, 자기 학습 기능을 포함합니다. 3가지 위자드 모드: AI 딥 인터뷰, 직접 선택, 기존 코드 자동 감지. 하나의 위자드로 모든 프로젝트를 지원합니다.

> **[English](./README.md)**

---

## 기능 요약

```
/harness-marketplace:wizard
  │
  ├─ 위자드 모드 선택
  │   ├── Deep Interview — AI가 프로젝트에 대해 질문 후 전체 아키텍처 추천
  │   ├── Manual — 기술 스택을 하나씩 직접 선택
  │   └── Auto-Detect — 현재 프로젝트 코드를 분석하여 스택 자동 감지
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
/plugin marketplace add https://github.com/DONGWAN-LEE/harness-marketplace-plugin.git
/plugin install harness-marketplace
/reload-plugins
```

> **참고:** 설치 후 반드시 `/reload-plugins`를 실행해야 현재 세션에 스킬이 로드됩니다. 이 단계를 건너뛰면 `/harness-marketplace:wizard` 실행 시 `Unknown skill` 오류가 발생합니다.

또는 수동 설치:

```bash
cp -r harness-marketplace/ ~/.claude/plugins/cache/harness-marketplace/harness-marketplace/1.0.0/
```

## 문제 해결

### `/` 자동완성에 스킬이 표시되지 않을 때

`/harness-marketplace:` 입력 시 스킬이 드롭다운에 나타나지 않는 경우:

1. **세션 완전 재시작 필요** — `/reload-plugins`에는 알려진 버그([#35641](https://github.com/anthropics/claude-code/issues/35641))가 있어 commands만 reload하고 skills는 reload하지 않습니다. VS Code를 완전히 종료 후 재시작하거나 CLI 세션을 새로 시작하세요.

2. **강제 재설치** — 재시작 후에도 스킬이 없으면:
   ```bash
   /plugin uninstall harness-marketplace
   /plugin install harness-marketplace
   ```
   그 후 세션을 완전히 재시작하세요.

3. **수동 입력은 항상 동작** — 자동완성이 안 되더라도 전체 명령어를 직접 입력하면 동작합니다:
   ```
   /harness-marketplace:wizard
   /harness-marketplace:upgrade
   /harness-marketplace:ci-cd
   /harness-marketplace:learn
   /harness-marketplace:gh
   ```

> **참고:** Claude Code의 미해결 이슈([#18949](https://github.com/anthropics/claude-code/issues/18949), [#35641](https://github.com/anthropics/claude-code/issues/35641))로 인해 마켓플레이스 플러그인 스킬이 자동완성에 표시되지 않을 수 있습니다. 이는 플러그인 버그가 아닌 Claude Code 런타임 제한사항입니다. 세션 완전 재시작이 가장 확실한 우회 방법입니다.

## 사용법

### 5가지 스킬 한눈에 보기

| 스킬 | 명령어 | 용도 |
|------|--------|------|
| **Wizard** | `/harness-marketplace:wizard` | 새 harness 생성 |
| **Upgrade** | `/harness-marketplace:upgrade` | 설정 보존하며 템플릿 업데이트 |
| **CI/CD** | `/harness-marketplace:ci-cd` | CI/CD 파이프라인 독립 설정 |
| **Learn** | `/harness-marketplace:learn` | 팀 학습을 git-tracked 파일로 저장 |
| **GH** | `/harness-marketplace:gh` | GitHub 워크플로우 자동화 (Issue → Branch → PR) |

---

### 새 harness 생성

```bash
/harness-marketplace:wizard
```

#### 3가지 위자드 모드

| 모드 | 적합한 경우 | 동작 방식 |
|------|-----------|----------|
| **딥 인터뷰** | 새 프로젝트, 기술 선택이 불확실할 때 | AI가 3-5개 질문으로 프로젝트 기획을 파악 후 전체 아키텍처를 추천. 검토 후 확인. |
| **수동 선택** | 이미 기술 스택을 알고 있을 때 | 프로젝트 유형, 언어, DB, 플랫폼, 기술 스택을 하나씩 직접 선택. 선택적 프로젝트 설명으로 AI 추천 라벨 활성화. |
| **자동 감지** | 기존 프로젝트에 harness 추가할 때 | AI가 프로젝트 파일(package.json, 설정 파일, 코드 구조)을 스캔하여 사용 중인 아키텍처와 기술 스택을 자동 감지. |

#### 딥 인터뷰 예시

```
Q1: "무엇을 만드시나요?"
→ "레스토랑 주문을 실시간으로 관리하는 SaaS 대시보드"

Q2: "핵심 기능과 예상 규모는?"
→ "주문 관리, 실시간 주방 디스플레이, 분석. 500개 레스토랑."

Q3: "제약사항은?"
→ "소규모 팀, 2개월 안에 MVP, Stripe 필수."

AI 추천:
  유형: Web > SSR > SaaS Dashboard
  언어: TypeScript, 프레임워크: Next.js
  DB: Supabase, 캐시: Upstash Redis
  플랫폼: Vercel, 인증: Supabase Auth
  스택: Tailwind, shadcn/ui, Zustand

  [전체 수락] [수정 후 수락] [수동 모드로 전환]
```

#### 자동 감지 예시

```
프로젝트 스캔 중...

감지 결과:
  유형: Web > SSR
  언어: TypeScript (tsconfig.json에서)
  프레임워크: Next.js 14 (package.json에서)
  DB: PostgreSQL via Prisma (prisma/schema.prisma에서)
  인증: NextAuth.js (src/app/api/auth/에서)
  스택: Tailwind, shadcn/ui
  배포: Vercel (vercel.json에서)

  [전체 수락] [수정 후 수락] [수동 모드로 전환]
```

#### 위자드 단계 (Manual 모드)

| 단계 | 질문 | 예시 선택지 |
|------|------|-----------|
| 0 | 언어 선택 | English, 한국어 |
| 0.5 | 위자드 모드 | Deep Interview / Manual / Auto-Detect |
| 0.6 | 프로젝트 설명 (선택) | 자유 텍스트로 AI 추천 라벨 활성화 |
| 1-1 | 프로젝트 대분류 | 웹, 모바일, 백엔드, 데스크탑, 게임, CLI, 데이터, IoT |
| 1-2 | 세부 유형 | SSR, SPA, SSG, Full-stack... |
| 1-3 | 용도 | 이커머스, SaaS, 대시보드... |
| 2 | 서버리스 여부 | 예 / 아니오 / 하이브리드 |
| 3 | 프로그래밍 언어 | TypeScript (추천), Python, Go... |
| 4 | 데이터베이스 | Supabase (추천), PostgreSQL, MongoDB... |
| 5 | 캐시 서버 | Redis, Upstash, CDN, 없음 |
| 6 | 배포 플랫폼 | Vercel, AWS, Railway, Docker... |
| 7 | 기술 스택 | Tailwind, shadcn/ui, FSD, Turborepo... (복수 선택) |
| 8+ | 조건부 질문 | 인증 방식, 상태관리... (프로젝트 유형에 따라 다름) |
| E1 | 코드 강제 수준 | Strict / Standard / Minimal / None |
| E2 | 보호 파일 | .env, lock 파일, 마이그레이션... (복수 선택) |
| E3 | 커스텀 규칙 | "서비스 레이어에서 직접 SQL 금지"... (자유 텍스트, strict만) |
| C1 | CI/CD 플랫폼 | GitHub Actions / GitLab CI / None / 나중에 설정 |
| C2 | 파이프라인 | CI, AI 코드리뷰, 배포, 보안... (복수 선택) |
| C3 | AI 리뷰 설정 | 코멘트만 / Critical 시 차단 / 자동 Approve |
| L1 | 자기 학습 | 승인 후 학습 / 자동 학습 / 비활성화 |
| A | 에이전트 선택 | security-reviewer, performance-auditor... (복수 선택) |
| G | 가이드 선택 | api-design, database-design... (복수 선택) |

프로젝트 설명이 제공되면 (Manual 모드) 또는 인터뷰가 사용되면, AI가 각 단계에서 최적의 옵션에 `(Recommended — 이유)` 라벨을 표시합니다. 모든 옵션은 항상 표시됩니다.

---

### 기존 harness 업그레이드

```bash
/harness-marketplace:upgrade
```

`project-config.yaml`, hook의 Custom Rules, `learning-log.yaml`을 보존하면서 템플릿 기반 파일만 최신 버전으로 업데이트합니다.

---

### CI/CD 독립 설정

```bash
/harness-marketplace:ci-cd
```

전체 위자드를 다시 실행하지 않고 CI/CD 파이프라인만 설정하거나 재설정합니다. 위자드에서 "나중에 설정"으로 미룬 프로젝트에서도 사용 가능합니다.

---

### 팀 학습 저장 및 공유

```bash
/harness-marketplace:learn "plugin.json skills 필드 제거하면 안 됨"
/harness-marketplace:learn --consolidate
```

개발 과정에서의 학습(문제, 원인, 해결책)을 `.harness/learnings/`에 git-tracked 파일로 저장합니다. 팀원들은 `git pull`로 지식을 공유합니다.

**동작 방식:**

```
.harness/learnings/
├── INDEX.md                                  ← 항상 로드됨, 한 줄 요약 (≤200줄)
├── 20260409-143022-scott-plugin-config.md    ← 개별 학습 (≤50줄)
├── 20260410-091200-john-git-workflow.md
└── archive/                                  ← 통합 후 원본 보관
```

- **충돌 방지**: 타임스탬프 + 작성자 파일명으로 팀 간 충돌 원천 차단
- **크기 관리**: INDEX.md 200줄 이하 유지, `--consolidate`로 중복 통합
- **선택적 hook 제안**: AI가 재발 방지 hook 규칙을 제안
- **승인 후 커밋**: 자동 push 없음

---

### GitHub 워크플로우 자동화

```bash
/harness-marketplace:gh "위자드 한국어 레이블 오타 수정"
/harness-marketplace:gh --no-issue "README 업데이트"
/harness-marketplace:gh --draft "인증 기능 추가"
```

Issue → Branch → Commit → PR 워크플로우를 자동 수행합니다:

```
/harness-marketplace:gh "설명"
  │
  ├─ Step 1: GitHub Issue 생성 (사용자가 제목/본문 승인)
  ├─ Step 2: Feature branch 생성 (fix/4-설명-slug)
  ├─ Step 3: 코드 변경 (직접, AI 도움, 또는 이미 완료)
  ├─ Step 4: 커밋 (사용자가 메시지 승인)
  ├─ Step 5: Push & PR 생성 (사용자가 승인)
  └─ Step 6: 정지 — PR URL 전달, 머지는 사용자의 책임
```

- **매 단계 승인 필수** — 자동 실행 없음
- **PR 머지 절대 안 함** — PR 생성 후 항상 정지
- **플래그**: `--no-issue`는 이슈 생략, `--draft`는 draft PR 생성

---

### 생성된 harness 사용

```bash
/project-harness "사용자 인증 구현"
/project-harness --dry-run "결제 연동 추가"
/project-harness --resume
```

---

## 마크다운을 넘어서 — 3개의 레이어

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
| **None** | Hook 없음 — 마크다운 전용 harness |

### Layer 2: CI/CD 파이프라인 생성

실제 CI/CD 워크플로우 파일을 생성합니다. 위자드 중 또는 `/harness-marketplace:ci-cd`로 독립 설정 가능.

| 파이프라인 | 트리거 | 설명 |
|-----------|--------|------|
| **CI** | push, PR | 테스트 + 린트 + 타입체크 + 빌드 |
| **AI 코드리뷰** | PR | Claude API가 diff 리뷰, 코멘트 게시, 선택적 머지 차단 |
| **프리뷰 배포** | PR | PR별 프리뷰 환경 배포 (Vercel, Netlify, Railway, Fly.io) |
| **프로덕션 배포** | main push | 프로덕션 자동 배포 (Vercel, AWS, Docker 등) |
| **보안 스캔** | 주간, PR | 의존성 감사 + 시크릿 스캔 + CodeQL 분석 |

**지원 플랫폼:** GitHub Actions, GitLab CI

### Layer 3: 자기 학습

하네스가 implement/verify 단계에서 발생한 실수로부터 학습하여 **시간이 지날수록 똑똑해집니다**:

```
AI가 실수 → 회귀 감지 → 수정 적용 →
  자기 학습 엔진:
    ├── 근본 원인 분류
    ├── hook 규칙 + 가이드 노트 제안
    └── 사용자 승인 → 적용
  → 같은 실수가 다시는 발생하지 않음
```

---

## 동작 원리

### 하이브리드 생성 방식

| 구성요소 | 방식 | 출처 |
|---------|------|------|
| SKILL.md 파일 (orchestrator, plan, implement, verify) | **템플릿** | `templates/*.md` |
| project-config.yaml | **매핑** | 위자드 답변 → YAML 스키마 |
| Hook 스크립트 (hooks/*.sh) | **템플릿** | `templates/hooks/*.sh.template` |
| CI/CD 워크플로우 (.github/workflows/*.yml) | **템플릿** | `templates/ci-cd/github-actions/*.yml.template` |
| agents/*.md | **AI 생성** | Claude가 프로젝트 특화 에이전트 체크리스트 생성 |
| guides/*.md | **AI 생성** | Claude가 프로젝트 특화 개발 가이드 생성 |
| classification.md | **AI 생성** | 프로젝트 특화 분류 규칙 |

### Config 기반 파이프라인

생성된 `project-config.yaml`이 모든 것을 결정합니다:

```yaml
context:                  # 위자드 모드 및 프로젝트 설명
  wizard_mode: interview
  project_description: "레스토랑 주문 관리 SaaS 대시보드..."

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

enforcement:              # Layer 1 — 코드 강제
  level: standard
  protected_files: ["**/.env*", "package-lock.json"]

ci_cd:                    # Layer 2 — CI/CD 파이프라인
  platform: github-actions
  pipelines:
    - type: ci
      enabled: true
    - type: ai-review
      enabled: true

self_learning:            # Layer 3 — 자기 학습
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
│   ├── plugin.json                # 플러그인 매니페스트 (skills 경로 선언)
│   └── marketplace.json           # 마켓플레이스 메타데이터
├── skills/
│   ├── wizard/SKILL.md            # 메인 위자드 (3모드: 인터뷰, 수동, 자동감지)
│   ├── upgrade/SKILL.md           # Harness 업그레이드 (Custom Rules + 학습 로그 보존)
│   ├── ci-cd/SKILL.md             # 독립 CI/CD 설정
│   ├── learn/SKILL.md             # 팀 공유 학습 (git-tracked 지식 베이스)
│   └── gh/SKILL.md                # GitHub 워크플로우 자동화 (Issue → Branch → PR)
├── templates/                     # Harness 골격 템플릿
│   ├── orchestrator.md            # 파이프라인 오케스트레이터
│   ├── plan.md                    # 계획 단계
│   ├── implement.md               # 구현 단계 (Learning Loop 포함)
│   ├── visual-qa.md               # 시각적 QA 단계
│   ├── verify.md                  # 검증 단계 (Learning Loop 포함)
│   ├── self-learning.md           # 자기 학습 엔진
│   ├── config-schema.yaml         # 설정 스키마 (context, enforcement, ci_cd, self_learning)
│   ├── classification.md          # 작업 분류 규칙
│   ├── hooks/                     # Hook 스크립트 템플릿 (8개 스크립트 + 설정)
│   └── ci-cd/                     # CI/CD 워크플로우 템플릿
│       └── github-actions/        # 5개 워크플로우 템플릿
├── data/                          # 딥리서치 옵션 데이터셋 (11개 파일)
├── scripts/
│   ├── validate-harness.js        # 전체 검증 (구조, hook, CI/CD, 자기학습)
│   └── merge-hooks.js             # settings.json 비파괴적 hook 머지
├── CHANGELOG.md                   # 버전 변경 이력
├── CLAUDE.md                      # 프로젝트 지침서
├── LICENSE                        # Apache-2.0
├── NOTICE                         # 귀속 표시
├── package.json
├── README.md
└── README-ko.md
```

## 요구사항

- **Claude Code** Agent Teams 활성화 (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)

## Acknowledgments

Special thanks to In-gyo Jung.

## 라이선스

Apache-2.0 — 자세한 내용은 [LICENSE](./LICENSE)를 참조하세요.
