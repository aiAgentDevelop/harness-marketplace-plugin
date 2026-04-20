# harness-marketplace

[![Latest Release](https://img.shields.io/github/v/release/aiAgentDevelop/harness-marketplace-plugin?sort=semver&label=latest)](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases/latest)
[![License](https://img.shields.io/github/license/aiAgentDevelop/harness-marketplace-plugin)](./LICENSE)
[![Changelog](https://img.shields.io/badge/changelog-keep--a--changelog-brightgreen)](./CHANGELOG.md)

**15분 만에 팀이 의존할 수 있는 프로덕션급 AI 개발 파이프라인을 생성하는 Claude Code 스캐폴딩 위자드.**

한 번의 위자드 실행으로 interview → classify → plan → implement → verify → launch-check 까지 전부 생성됩니다. 실제 병렬 워커, 코드 레벨 훅, CI/CD 파이프라인, 관측성 배선까지 포함되고, 프로젝트 루트에 자동 생성되는 `CLAUDE.md` 가 `/project-harness` 를 팀의 기본 개발 명령으로 만듭니다. **"프롬프트 템플릿 하나 더 유지하는 것"이 아니라 서비스를 만드는 소규모팀** 을 위한 도구입니다.

> **[English](./README.md)**

---

## 이 플러그인이 존재하는 이유

Claude Code 로 토이 프로젝트 이상을 해본 팀이라면 다음 중 두 개 이상을 겪어봤을 겁니다:

- **"Sentry 는 나중에 연결하지 뭐."** 그 "나중"은 안 옵니다. 프로덕션 첫 5xx 가 미스터리로 남습니다.
- **"우리 CLAUDE.md 는 한 문단짜리."** 매 세션이 context zero 에서 시작합니다.
- **"AI 가 우리 컨벤션을 또 잊었다."** 코드 레벨 가드가 없고 "알아서 잘 하길" 기대만 있으니까요.
- **"plan / implement / verify 파이프라인을 누가 쓰지?"** 반나절 낼 사람이 없습니다.

이 플러그인은 이 모든 문제를 한 번의 위자드 실행으로 대체합니다. 모드에 따라 5–25개 질문에 답하면, 소규모팀이 실제로 의존할 수 있는 파이프라인이 나옵니다. 관측성 게이트까지 포함되어 — 에러 추적 없이는 배포 자체가 막힙니다.

그리고 자체 벤치마크로 **이 플러그인이 어디서 이기고 어디서 지는지** 공개합니다. 아래 [Honest Benchmarks](#honest-benchmarks-phase-1-v2--endtoend-isoiec-25010--owasp-asvs--dora) 섹션을 보세요 — "우리가 만든 플러그인 가치의 대부분은 마법이 아니라 위자드가 써준 CLAUDE.md 에서 온다" 고 스스로 밝히는 플러그인입니다.

---

## Quick Start

```bash
# 1. 설치 (최초 1회)
/plugin marketplace add https://github.com/aiAgentDevelop/harness-marketplace-plugin.git
/plugin install harness-marketplace
# ↑ 설치 후 Claude Code 를 완전히 재시작하세요 — 아래 설치 섹션 참조

# 2. harness 스캐폴드 (5–15분)
cd <your-project>
/harness-marketplace:wizard

# 3. 개발 시작
/project-harness "사용자 인증 구현"
# ↑ 위자드가 써준 CLAUDE.md 가 이 명령을 자동으로 다음과 같이 풀어줍니다:
#   plan → implement → verify, hooks + 관측성 + CI 포함
```

이게 전부입니다. 프로덕션 배포 전에 `/harness-marketplace:launch-check` 가 출시 전 감사를 돕니다 — 에러 추적 연결됐나? 헬스체크 있나? 롤백 경로 있나? 빠뜨린 게 있으면 배포를 막아줍니다.

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
  │   ├── ./CLAUDE.md                  — 프로젝트 루트 오케스트레이션 entrypoint 안내
  │   ├── project-config.yaml          — 모든 것을 결정하는 마스터 설정
  │   ├── project-interview/SKILL.md    — 딥 서비스 인터뷰 (Phase -1, 인터뷰 모드)
  │   ├── plan/SKILL.md                — 계획 단계 (Fan-out + Reader 병렬)
  │   ├── codebase-analysis/SKILL.md   — Phase 2.5 사전 분석 (refactor 시 자동)
  │   ├── debug/SKILL.md                — 디버그 조사 단계 (bugfix 전용)
  │   ├── implement/SKILL.md           — 구현 단계 (standard OR TDD 전략)
  │   ├── visual-qa/SKILL.md           — 시각적 QA (UI 프로젝트)
  │   ├── verify/SKILL.md              — 검증 단계 (모든 auditor 병렬)
  │   ├── prd/service-prd.md            — 인터뷰 모드 종합 PRD
  │   ├── agents/*.md                  — AI 생성 도메인 에이전트 (34-카탈로그 + supabase-security-gate)
  │   ├── guides/*.md                  — AI 생성 개발 가이드
  │   ├── hooks/*.sh                   — Claude Code hook 기반 코드 강제
  │   ├── hooks-config.json            — settings.json 용 hook 설정
  │   ├── .github/workflows/*.yml      — CI/CD 파이프라인 + AI 코드리뷰
  │   ├── state/learning-log.yaml      — 자기 학습 이력
  │   └── references/                  — 공통 UX + 데이터 계약:
  │       ├── progress-format.md       — phase N/M + 이모지 + 워커 트리 표준
  │       ├── ui-conventions.md        — 3-옵션 확인 게이트 + 완료 요약
  │       ├── classification.md        — 작업 분류 규칙
  │       ├── handoff-templates.md     — state/handoffs/*.md 구조
  │       ├── schemas.md               — InterviewResult/PlanResult/ImplementationResult/VerificationResult JSON
  │       ├── guide-injection.md       — 워커 → 가이드 + 에이전트 체크리스트 매핑
  │       ├── monitor-mode.md          — /project-harness monitor idle 자동 감시
  │       ├── parallel-execution.md    — Fan-out/Fan-in PARALLEL REQUIRED 규약
  │       ├── tdd-implementation.md    — Red-Green-Refactor 전략 (활성 시)
  │       ├── ui-defect-patterns.md    — 정적 UI 코드 리뷰 (has_ui 시)
  │       └── fsd-scaffold-patterns.md — FSD boilerplate (architecture=fsd 시)
  │
  └─ 검증 완료 → `/project-harness "작업"` 입력 — CLAUDE.md 가 Claude 를 자동 라우팅
```

## 설치

```bash
/plugin marketplace add https://github.com/aiAgentDevelop/harness-marketplace-plugin.git
/plugin install harness-marketplace
```

> **중요:** 설치 후 반드시 **Claude Code를 완전히 종료하고 새 세션을 시작**해야 합니다. `/reload-plugins`는 commands만 reload하고 **skills는 reload하지 않는** 알려진 버그([#35641](https://github.com/anthropics/claude-code/issues/35641))가 있습니다. 세션을 완전히 재시작하지 않으면 `/harness-marketplace:wizard` 실행 시 `Unknown skill` 오류가 발생합니다.

또는 수동 설치:

```bash
cp -r harness-marketplace/ ~/.claude/plugins/cache/harness-marketplace/harness-marketplace/1.0.0/
```

## 문제 해결

### `/` 자동완성에 스킬이 표시되지 않을 때

`/harness-marketplace:` 입력 시 스킬이 드롭다운에 나타나지 않는 경우:

1. **세션 완전 재시작 필요** — `/reload-plugins`에는 알려진 버그([#35641](https://github.com/anthropics/claude-code/issues/35641))가 있어 commands만 reload하고 skills는 reload하지 않습니다. VS Code를 완전히 종료 후 재시작하거나 CLI 세션을 새로 시작하세요.

2. **수동 입력은 항상 동작** — 자동완성이 안 되더라도 전체 명령어를 직접 입력하면 동작합니다:
   ```
   /harness-marketplace:wizard
   /harness-marketplace:upgrade
   /harness-marketplace:ci-cd
   /harness-marketplace:learn
   /harness-marketplace:gh
   ```

> **참고:** Claude Code의 미해결 이슈([#18949](https://github.com/anthropics/claude-code/issues/18949), [#35641](https://github.com/anthropics/claude-code/issues/35641))로 인해 마켓플레이스 플러그인 스킬이 자동완성에 표시되지 않을 수 있습니다. 이는 플러그인 버그가 아닌 Claude Code 런타임 제한사항입니다. 세션 완전 재시작이 가장 확실한 우회 방법입니다.

## 사용법

**시작 지점 고르기**: 새 프로젝트 → `wizard` (Deep Interview 모드). 기존 프로젝트 → `wizard` (Auto-Detect 모드). 이미 harness 가 있다면 → `upgrade`. 출시 준비 → `launch-check`.

### 6가지 스킬 한눈에 보기

| 스킬 | 명령어 | 용도 |
|------|--------|------|
| **Wizard** | `/harness-marketplace:wizard` | 새 harness 생성 |
| **Upgrade** | `/harness-marketplace:upgrade` | 설정 보존하며 템플릿 업데이트 |
| **CI/CD** | `/harness-marketplace:ci-cd` | CI/CD 파이프라인 독립 설정 |
| **Learn** | `/harness-marketplace:learn` | 팀 학습을 git-tracked 파일로 저장 |
| **GH** | `/harness-marketplace:gh` | GitHub 워크플로우 자동화 (Issue → Branch → PR) |
| **Launch-Check** | `/harness-marketplace:launch-check` | 출시 전 준비도 게이트 — 안전망 + 서비스 운영 준비도 감사 |

### 생성된 Harness 명령어

| 명령어 | 용도 |
|--------|------|
| `/project-harness "작업"` | 전체 파이프라인 실행 (plan → implement → verify) |
| `/project-harness interview` | 파이프라인 내 인터뷰 모드 실행 |
| `/project-interview` | 독립 딥 서비스 인터뷰 → PRD 생성 |

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
| A | 에이전트 선택 | security-reviewer, performance-auditor, game-economy-auditor... (25개 카탈로그, 복수 선택) |
| G | 가이드 선택 | api-design, database-design, game-design... (18개 카탈로그, 복수 선택) |

프로젝트 설명이 제공되면 (Manual 모드) 또는 인터뷰가 사용되면, AI가 각 단계에서 최적의 옵션에 `(Recommended — 이유)` 라벨을 표시합니다. 모든 옵션은 항상 표시됩니다.

---

### 딥 서비스 인터뷰 (Interview Mode)

```bash
/project-interview
/project-harness interview
```

**다중 라운드 딥 서비스 인터뷰**를 실행하여 종합 PRD (`.claude/skills/project-harness/prd/service-prd.md`)를 생성합니다. 인터뷰는 WebSearch 딥 리서치를 통해 도메인 전문가 에이전트를 생성하고, 개발 팀 구성을 정의하며, 10개 차원에서 구현 명확도 %를 추적합니다.

**동작 방식:**

```
/project-interview
  │
  ├─ Phase -1: 인터뷰
  │   ├── AI 기반 객관식 질문 (4개 선택지 + 직접 입력)
  │   ├── 모델 선택 (Sonnet for Pro / Opus for Max)
  │   ├── WebSearch 딥 리서치로 도메인 전문가 에이전트 생성
  │   ├── 개발 팀 구성 정의
  │   ├── 10개 차원에서 구현 명확도 추적
  │   └── 산출물: prd/service-prd.md (종합 PRD)
  │
  └─ 파이프라인 계속: classify → plan → implement → verify
```

독립 모드 (`/project-interview`)와 파이프라인 모드 (`/project-harness interview`) 모두 지원합니다. 파이프라인 모드에서는 Phase 0 (분류) 이전에 Phase -1로 인터뷰가 실행됩니다.

---

### 기존 harness 업그레이드

> 📖 **단계별 전체 가이드: [UPGRADE-ko.md](./UPGRADE-ko.md)**

업그레이드는 **순서대로 두 단계** 입니다:

**Step 1 — 플러그인 자체 업데이트** (릴리스당 1회):

```
/plugin          # Claude Code 안에서 → Marketplaces → harness-marketplace
                 # → Update marketplace → Update plugin → Claude Code 재시작
```

이 단계를 건너뛰면 `/upgrade`가 "이미 최신 버전입니다"라고 답하는 주된 원인이 됩니다 — 캐시된 플러그인(예: v0.3.0)이 자기 자신과 비교하기 때문입니다.

**Step 2 — 각 프로젝트의 harness 업그레이드** (프로젝트별 릴리스당 1회):

```bash
cd <your-project>
/harness-marketplace:upgrade
```

업그레이드 스킬은 GitHub에서 최신 템플릿을 자동으로 가져오며 (v0.4.0+), `project-config.yaml`, hook의 Custom Rules, `learning-log.yaml`을 보존하고, `.claude/backups/project-harness-{timestamp}/`에 타임스탬프 백업을 남깁니다. `--offline`으로 로컬 플러그인 캐시 강제 사용, `--preview`로 실행 없이 계획만 확인, `--backup-only`로 업그레이드 없이 백업만.

**v1.x legacy hook 자동 마이그레이션** (v0.5.1+): 프로젝트가 구버전 v1.x hook 컨트랙트로 생성되어 Claude Code v2.x에서 silent no-op 상태([#16](https://github.com/aiAgentDevelop/harness-marketplace-plugin/issues/16))임을 감지하면, `hooks/` 디렉토리 전체를 v2.x 포맷으로 교체합니다. 기존 hook은 백업 디렉토리에 보존되며, Custom Rules가 있었다면 수동 복사 필요. 업그레이드가 `.claude/settings.json`의 hook 엔트리 교체도 제안할 텐데 — **반드시 수락하세요**, 그러지 않으면 Claude Code가 새 hook을 등록하지 않습니다.

**업그레이드 후 검증**:

```bash
claude --debug-file /tmp/d.log        # 시작 후 즉시 Ctrl+C
grep "Registered.*hooks" /tmp/d.log   # 기대: N > 0
```

전체 플로우, 문제 해결 ("Registered 0 hooks", 백업 이 스킬로 등록되는 문제 등), 엔드-투-엔드 검증, 롤백은 [UPGRADE-ko.md](./UPGRADE-ko.md) 참고.

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

wizard 완료 시 **프로젝트 루트에 `CLAUDE.md` 가 자동 생성**되어 Claude Code 가 비-사소한 작업을 항상 `/project-harness` 파이프라인으로 라우팅하도록 지시합니다. 이로써 AI 오케스트레이션이 **기본 작업 방식**이 됩니다 — 새 기능 / 버그 수정 / 리팩토링이 자동으로 plan → implement → verify 전체 파이프라인을 따릅니다.

```bash
/project-harness "사용자 인증 구현"
/project-harness --dry-run "결제 연동 추가"
/project-harness --resume
```

생성되는 `CLAUDE.md` 내용:
- 오케스트레이션 entrypoint 안내 (언제 `/project-harness` 를 쓰나, 언제 건너뛰어도 되나)
- 훅 enforcement 표 (활성 보안/품질 가드)
- 스택 컨벤션 (선택된 가이드에서 추출)
- 구성 요소 위치 맵 (`.claude/skills/project-harness/{plan,implement,verify,...}/`)
- **`## Custom Rules` 섹션** — 팀의 프로젝트별 규칙. `/harness-marketplace:upgrade` 시 HTML 주석 마커로 **그대로 보존**

프로젝트 루트에 이미 `CLAUDE.md` 가 있으면 wizard 가 (a) GENERATED 구간만 병합, (b) 백업 후 전체 교체, (c) 건너뛰기 중 선택하도록 묻습니다.

---

## 관측성 (Wizard 실행 시 필수)

에러 추적, 프로덕트 분석, 헬스 시그널 없이 출시한 서비스는 프로덕션에서 사실상 눈을 감은 상태입니다. Wizard는 관측 스택 선택을 **옵션이 아닌 필수 게이트**로 취급합니다. Phase 5 생성 단계에 들어가기 전에 최소 하나의 에러 추적 플랫폼을 반드시 선택해야 합니다.

### Wizard 가 묻는 내용 (Phase 4, Step D)

| 질문 | 필수 여부 | 카탈로그 출처 |
|---|---|---|
| Q-D.1 — 에러 추적 플랫폼 | **필수, 정확히 1개** | `data/observability-platforms.yaml` → `error_tracking` + `native` |
| Q-D.2 — 프로덕트 분석 플랫폼 | 선택, 0개 이상 | `data/observability-platforms.yaml` → `product_analytics` + `native` |
| Q-D.3 — APM / 로그 백엔드 (`has_backend` 시) | 선택, 0 또는 1개 | `data/observability-platforms.yaml` → `apm` + `logs_metrics` + `vendor_neutral` |

카탈로그에 현재 등재된 11개 플랫폼: Sentry, Rollbar, Datadog, New Relic, PostHog, Amplitude, Plausible, Grafana Cloud, Axiom, OpenTelemetry, Vercel Analytics. 이 중 2개(Sentry, PostHog)는 바로 쓸 수 있는 보일러플레이트 템플릿을 제공하며, 나머지는 공식 문서 링크가 담긴 `TODO.md` 스텁을 방출합니다.

### 생성되는 파일

`integration_template_path`가 설정된 플랫폼(현재 Sentry + PostHog)을 선택하면 wizard가 보일러플레이트를 프로젝트에 바로 써넣습니다:

- **Sentry + Next.js** → `instrumentation.ts`, `app/error-boundary.tsx`, `app/api/health/route.ts`
- **Sentry + Node 백엔드** → `src/instrument.ts`, 헬스체크 엔드포인트
- **PostHog + Next.js** → `app/providers/posthog-provider.tsx`, `docs/events-catalog.md`

모든 생성 파일은 `═══ CUSTOM RULES BELOW (preserved on upgrade) ═══` 마커로 끝나므로 팀의 수정 사항은 `/harness-marketplace:upgrade` 를 거쳐도 보존됩니다.

Wizard는 동시에 `observability-auditor` 에이전트와 `observability-fundamentals` 가이드를 harness에 자동 추가하여, 매 verify 단계마다 에러 바운더리·헬스체크·SDK 초기화가 여전히 연결되어 있는지 재확인합니다.

---

## 출시 전 감사 — `/harness-marketplace:launch-check`

`verify`는 매 변경마다 돕니다. `launch-check`는 **릴리스 후보 하나당 1회** 실행되며, verify가 의도적으로 다루지 않는 축 — 서비스 운영 준비도, 법적·규정 준수, 테스트 완결성, 플레이북 존재 — 을 점검합니다.

| Section | 현재 상태 | 차단 여부 |
|---|---|---|
| 1. 안전망 (verify 위임) | 구현됨 | 실패 시 BLOCK |
| 2. 서비스 운영 준비도 | **완전 구현** (7개 체크) | 실패 시 BLOCK |
| 3. 법적 / 규정 준수 | Placeholder (경고만) | WARN only |
| 4. 테스트 완결성 | Placeholder (경고만) | WARN only |
| 5. 런북 & 플레이북 | Placeholder (경고만) | WARN only |

### Section 2 체크 항목

1. 관측 플랫폼 연결 확인 (`observability.error_tracking.platform_id` 설정 + env var 선언)
2. `has_ui`일 때 최상위 에러 바운더리 존재
3. 에러 캡처 SDK 초기화가 클라이언트와 서버 양쪽에 존재
4. `has_backend`일 때 헬스체크 엔드포인트 존재
5. 롤백 워크플로우 또는 플랫폼 수준 롤백 존재
6. 릴리스 식별자(SHA/tag)가 CI에서 주입됨
7. 비용 산정 파일 존재 (cost-guard P1 placeholder)

Section 1 또는 Section 2 체크 중 하나라도 실패하면 exit 1을 반환하므로 `deploy-prod.yml` 워크플로우에서 이를 관문으로 삼을 수 있습니다. Section 3–5는 본 구현이 후속 PR로 들어올 때까지 WARN 수준에 머뭅니다.

---

## 마크다운 파일 외에도 — 하네스가 직접 실행하는 4가지

### 1. Hook 기반 코드 강제 (실시간 차단)

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

### 2. CI/CD 파이프라인 생성

실제 CI/CD 워크플로우 파일을 생성합니다. 위자드 중 또는 `/harness-marketplace:ci-cd`로 독립 설정 가능.

| 파이프라인 | 트리거 | 설명 |
|-----------|--------|------|
| **CI** | push, PR | 테스트 + 린트 + 타입체크 + 빌드 |
| **AI 코드리뷰** | PR | Claude API가 diff 리뷰, 코멘트 게시, 선택적 머지 차단 |
| **프리뷰 배포** | PR | PR별 프리뷰 환경 배포 (Vercel, Netlify, Railway, Fly.io) |
| **프로덕션 배포** | main push | 프로덕션 자동 배포 (Vercel, AWS, Docker 등) |
| **보안 스캔** | 주간, PR | 의존성 감사 + 시크릿 스캔 + CodeQL 분석 |

**지원 플랫폼:** GitHub Actions, GitLab CI

### 3. 자기 학습 (Self-Learning)

하네스가 implement/verify 단계에서 발생한 실수로부터 학습하여 **시간이 지날수록 똑똑해집니다**:

```
AI가 실수 → 회귀 감지 → 수정 적용 →
  자기 학습 엔진:
    ├── 근본 원인 분류
    ├── hook 규칙 + 가이드 노트 제안
    └── 사용자 승인 → 적용
  → 같은 실수가 다시는 발생하지 않음
```

### 4. 디버그 조사 단계

버그 수정 작업 시, plan과 implement 사이에 **체계적 디버그 단계**가 실행됩니다 — 추측 대신 병렬 조사:

```
/project-harness "fix 로그인 500 에러"
  │
  ├─ plan (탐색 + 설계)
  │
  ├─ debug (bugfix 전용, 단순 버그는 스킵)
  │   ├── 에러 재현 → 스택 트레이스 + 출력 캡처
  │   ├── 3-5개 가설 생성 (가능성 순위)
  │   ├── 병렬 조사 (4개 에이전트 동시 실행):
  │   │   ├── root-cause-analyst — 상위 가설 검증
  │   │   ├── error-trace-mapper — 스택 트레이스 매핑 + git blame
  │   │   ├── impact-analyzer — 코드베이스 전체 동일 패턴 검색
  │   │   └── runtime-inspector — 실패 지점 변수 상태 캡처
  │   ├── Git bisection (복잡한 버그 시 조건부)
  │   └── 증거 수집 → DebugResult (확인된 근본 원인)
  │
  ├─ implement (DebugResult 활용 → 정확한 수정 + 영향 범위 수정)
  └─ verify
```

**스마트 라우팅** — 단순 버그(오타, 누락된 import)는 디버그 단계를 스킵합니다. 복잡한 버그(레이스 컨디션, 간헐적, 다중 파일)는 전체 조사를 수행합니다. `debug_complexity` 점수(low/medium/high)로 제어됩니다.

---

## 동작 원리

### 하이브리드 생성 방식

| 구성요소 | 방식 | 출처 |
|---------|------|------|
| SKILL.md 파일 (orchestrator, plan, debug, implement, verify) | **템플릿** | `templates/*.md` |
| interview (서비스 PRD) | **템플릿** | `templates/interview.md` |
| project-config.yaml | **매핑** | 위자드 답변 → YAML 스키마 |
| Hook 스크립트 (hooks/*.sh) | **템플릿** | `templates/hooks/*.sh.template` |
| CI/CD 워크플로우 (.github/workflows/*.yml) | **템플릿** | `templates/ci-cd/github-actions/*.yml.template` |
| agents/*.md | **AI 생성** | data/agents.yaml 카탈로그(34개) 기반 프로젝트 특화 에이전트 체크리스트 생성 |
| guides/*.md | **AI 생성** | data/guides.yaml 카탈로그(18개) 기반 프로젝트 특화 개발 가이드 생성 |
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

enforcement:              # 1 — 코드 강제 (실시간 차단)
  level: standard
  protected_files: ["**/.env*", "package-lock.json"]

ci_cd:                    # 2 — CI/CD 파이프라인
  platform: github-actions
  pipelines:
    - type: ci
      enabled: true
    - type: ai-review
      enabled: true

self_learning:            # 3 — 자기 학습
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
│   ├── interview.md               # 딥 서비스 인터뷰 → PRD 생성 (Phase -1)
│   ├── orchestrator.md            # 파이프라인 오케스트레이터
│   ├── plan.md                    # 계획 단계 (Reader/Fan-in 패턴 포함)
│   ├── debug.md                   # 디버그 조사 단계 (bugfix 전용)
│   ├── implement.md               # 구현 단계 (Learning Loop 포함)
│   ├── visual-qa.md               # 시각적 QA 단계
│   ├── verify.md                  # 검증 단계 (Learning Loop + Failure Tiers BLOCK/WARN/INFO)
│   ├── self-learning.md           # 자기 학습 엔진
│   ├── CLAUDE.md.template         # 프로젝트 루트 오케스트레이션 안내 (./CLAUDE.md 로 생성)
│   ├── progress-format.md         # Reference: phase N/M + 상태 이모지 + 워커 트리 표준
│   ├── ui-conventions.md          # Reference: 3-옵션 확인 게이트 + 완료 요약 스키마
│   ├── handoff-templates.md       # Reference: state/handoffs/{plan,debug,exec,verify}.md 구조
│   ├── schemas.md                 # Reference: InterviewResult/PlanResult/ImplementationResult/VerificationResult JSON 스키마
│   ├── guide-injection.md         # Reference: 워커 → 가이드 + 에이전트 체크리스트 매핑
│   ├── monitor-mode.md            # Reference: /project-harness monitor (CronCreate 기반 idle 자동 감시)
│   ├── parallel-execution.md      # Reference: Fan-out/Fan-in PARALLEL REQUIRED 규약 (단일 메시지 복수 Task 패턴)
│   ├── codebase-analysis.md       # Sub-skill: Phase 2.5 사전 분석 (arch/design/deps/impact)
│   ├── tdd-implementation.md      # Reference: Red-Green-Refactor 전략 (project-implement 조건부)
│   ├── ui-defect-patterns.md      # Reference: 정적 UI 코드 리뷰 (8 결함 패턴, 조건부: has_ui)
│   ├── fsd-scaffold-patterns.md   # Reference: FSD entity/feature/widget boilerplate (조건부: architecture=fsd)
│   ├── config-schema.yaml         # 설정 스키마 (context, enforcement, ci_cd, self_learning)
│   ├── classification.md          # 작업 분류 규칙 (디버그 복잡도 포함)
│   ├── hooks/                     # Hook 스크립트 템플릿 (8 스크립트 + 설정 + v2.x helper 2개)
│   │   ├── _parse.sh              # 공유: stdin JSON → TOOL_FILE_PATH/TOOL_CONTENT/TOOL_COMMAND
│   │   ├── _log.sh                # 공유: log_block 헬퍼 (.claude/hook-blocks.log 기록)
│   │   ├── *.sh.template          # 8개 hook 템플릿 (stdin 읽기, 차단 시 exit 2)
│   │   └── hooks-config.json.template
│   └── ci-cd/                     # CI/CD 워크플로우 템플릿
│       └── github-actions/        # 5개 워크플로우 템플릿
├── data/                          # 딥리서치 옵션 데이터셋 (14개 파일)
├── scripts/
│   ├── validate-harness.js        # 전체 검증 (구조, hook, CI/CD, 자기학습)
│   └── merge-hooks.js             # settings.json 비파괴적 hook 머지
├── benchmarks/                    # Phase 0.5 3-레이어 공정 평가 (harness 효과 측정 연구)
│   ├── README.md                  # 3-레이어 방법론 + 편파성 방지 장치
│   ├── PROTOCOL.md                # 선등록 가설/지표/판정규칙
│   ├── tasks/                     # 10개 태스크 (security/orchestration/pipeline)
│   ├── reference-projects/        # Seed 프로젝트 + harness 오버레이
│   ├── runner/                    # 다단계 러너 (invoke/control/treatment/probe/batch)
│   ├── scorer/                    # 자동 + 7차원 LLM judge + 집계
│   └── results/                   # phase05-report.md, scored/, aggregated.json
├── CHANGELOG.md                   # 버전 변경 이력
├── CLAUDE.md                      # 프로젝트 지침서
├── LICENSE                        # Apache-2.0
├── NOTICE                         # 귀속 표시
├── package.json
├── README.md
├── README-ko.md
├── UPGRADE.md                     # 단계별 업그레이드 가이드 (영문)
└── UPGRADE-ko.md                  # 단계별 업그레이드 가이드 (한글)
```

## 요구사항

- **Claude Code** Agent Teams 활성화 (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)

## Honest Benchmarks (Phase 1 v2 — End-to-End, ISO/IEC 25010 + OWASP ASVS + DORA)

`Plain Claude Code` vs `harness-marketplace` (v0.6.0 wizard 결과물) 의 end-to-end 평가. 국제 표준 준거 (ISO/IEC 25010, OWASP ASVS v4.0.3, OWASP Top 10 2021, CWE Top 25, DORA, HELM 원칙). 이전 Phase 0.5 단일-task 벤치마크 (commit `a455abe` 이전) 를 대체.

**설계**: 13축 가중 채점 (총 100%) × 3 condition × 17 OWASP adversarial task + 12 multi-step sprint cell (각 8 sequential step, state carry-over). 실행 전 [`PROTOCOL-v2.md`](./benchmarks/PROTOCOL-v2.md) 선등록 (FROZEN).

### 핵심 결과 (Pilot + Slim, 198 effective units, $63.78)

| Condition | Weighted Total | 비고 |
|---|---:|---|
| `bare_claude` (플러그인 없음) | 83.0 | 베이스라인 |
| **`claude_md_only`** (CLAUDE.md 만, skills/hooks 없음) | **88.1 ← 우승** | wizard 가 생성한 CLAUDE.md 만으로 |
| `full_harness` (v0.6.0 wizard 전체) | 86.8 | 풀 skills + hooks + agents |

**wizard 가 생성하는 `CLAUDE.md`** 가 오케스트레이션의 핵심 (load-bearing). skills/hooks/agents 레이어는 다음 3개 축에서 측정 가능한 추가 가치를 제공:

| 축 | bare | cmo | harness | 우승 |
|---|---:|---:|---:|---|
| **Perf — Cost** (sequential 작업) | 83 | 81 | **84** | full_harness |
| **Compatibility** (scope discipline) | 89 | 92 | **97** | full_harness |
| **Usability** (judge rubric) | 54 | 58 | **62** | full_harness |

다만 `claude_md_only` 가 Functional Suitability (86 vs 82), Security ASVS L2 (77 vs 69), CWE-가중 결함 (99 vs 99 동률), Maintainability (96 vs 96 동률), Wall-time (88 vs 87), DORA Lead Time (93 vs 91) 에서 우위.

**정직한 해석**: harness 의 측정 가능한 lift 대부분은 wizard 가 생성한 CLAUDE.md 에서 옴 (`bare_claude` 에는 없음). 런타임 hooks/skills 는 polish 축에서 진짜 가치를 더하지만, 본 벤치마크 구성에서는 보안 지표를 결정적으로 끌어올리지 않음 — 에이전트가 CLAUDE.md 컨벤션을 통해 이미 자가-정렬되어 런타임 hook 이 발동될 일이 거의 없었음 (harness condition 에서 평균 0.1 hook BLOCK / run).

**회귀 0건** 96 sequential sprint step 전체 (모든 condition). harness 의 regression-loop 가 잡을 일이 없었음.

### 결정 평가 (PROTOCOL-v2 §7 기준)

| 가설 | Pilot | Slim |
|---|---|---|
| H1 (Security ASVS 격차 ≥ 15) | ❌ +3 — 미달 | ❌ +3 — 미달 |
| H3 (Weighted total 격차 ≥ 5) | ❌ +3.9 — 미달 | ❌ +3.8 — 미달 |
| H5 (cmo 가 bare/harness 사이) | ❌ 역전 | ❌ 역전 |

두 stage 모두 동일한 결론: 플러그인의 측정 가능한 영향력은 wizard 가 생성한 CLAUDE.md 에서 압도적으로 나오며, 런타임 skills/hooks 레이어는 보조적. 오케스트레이션 scaffolding 을 위해 플러그인을 채택하되, skills/hooks 는 multi-step 라이프사이클에서 Compatibility / Usability / Perf-Cost polish 추가로 기대.

```bash
# 벤치마크 실행 (resumable, summary.json 존재 검사로 dedup)
cd benchmarks && npm install
node scorer/aggregate-v2.js --verify-weights      # 13축 가중치 합 100% 검증
node scorer/verify-blinding.js                    # judge 프롬프트에 condition label 누출 없는지 검증
node runner/render-seeds.js                       # reference-projects/{claude-md-only,harness}-{nextjs,fastapi}/ 빌드
node runner/batch.js --stage pilot --concurrency 2 --limit 25  # OWASP A2 chunk
node runner/batch.js --stage slim --concurrency 2 --limit 4    # sprint chunk
node scorer/judge-batch.js --stage slim --concurrency 3        # blind LLM judge
node scorer/aggregate-v2.js --stage slim                       # reports/slim-report.md 생성
```

전체 디렉터리 구조는 [`benchmarks/README.md`](./benchmarks/README.md), 선등록된 가설·결정 규칙은 [`benchmarks/PROTOCOL-v2.md`](./benchmarks/PROTOCOL-v2.md), 13축 매트릭스 + per-task ASVS 분해 + "harness 가 지는 경우" 정직 섹션은 [`benchmarks/reports/slim-report.md`](./benchmarks/reports/slim-report.md) 에 있습니다.

## 버전 히스토리

태그, 소스 압축 파일, 릴리스 노트는 [**GitHub Releases**](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases)에서 확인하세요. 저장소 내부 변경 이력은 [`CHANGELOG.md`](./CHANGELOG.md)에서 볼 수 있습니다.

주요 릴리스:

| 버전 | 주요 내용 |
|------|-----------|
| [**v0.7.0**](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases/tag/v0.7.0) | 인터뷰 모드 (`/project-interview`) — 다중 라운드 딥 서비스 인터뷰로 종합 PRD 생성. 도메인 전문가 에이전트, 팀 구성, 10개 차원 구현 명확도 추적 |
| [v0.6.0](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases/tag/v0.6.0) | Orchestration-by-default (`./CLAUDE.md` 자동 생성) + 실제 병렬 Fan-out/Fan-in 워커 + Phase 2.5 codebase-analysis + TDD 전략 + Supabase 보안 게이트 + monitor mode + Phase 1 v2 벤치마크 |
| [v0.5.2](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases/tag/v0.5.2) | upgrade skill & validate-harness polish (v0.5.1 현장 테스트에서 발견된 이슈 수정) |
| [v0.5.1](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases/tag/v0.5.1) | upgrade skill이 레거시 v1.x hook을 자동 감지/마이그레이션 |
| [v0.5.0](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases/tag/v0.5.0) | ⚠️ BREAKING — hook 템플릿을 Claude Code v2.x 컨트랙트(stdin JSON + exit 2)로 마이그레이션 |
| [v0.4.0](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases/tag/v0.4.0) | Agent/Guide 카탈로그(에이전트 34개 + 가이드 18개) + bugfix 파이프라인용 debug phase |
| [v0.3.0](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases/tag/v0.3.0) | 팀 지식 공유를 위한 `learn`, `gh` 스킬 추가 |
| [v0.2.2](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases/tag/v0.2.2) | plugin.json `skills` 필드 복원으로 자동완성 지원 + 버전 동기화(plugin/marketplace/package) + 한글 위자드 라벨 |
| [v0.2.0](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases/tag/v0.2.0) | 3가지 위자드 모드 + 3-레이어 파이프라인 시스템 |
| [v0.1.0](https://github.com/aiAgentDevelop/harness-marketplace-plugin/releases/tag/v0.1.0) | 최초 릴리스 |

**v0.4.x 이하에서 업그레이드 하시나요?** v0.5.0은 hook 컨트랙트가 변경된 BREAKING 릴리스입니다. 플러그인을 업데이트한 뒤 각 프로젝트에서 `/harness-marketplace:upgrade`를 실행하세요 — v0.5.1부터 레거시 v1.x hook을 자동 감지하여 v2.x 형식으로 교체합니다(기존 hook은 타임스탬프 백업 디렉토리에 보존).

## 버리는 디렉토리에서 먼저 써보세요

`.claude/settings.json` 을 건드리고 실제 프로젝트에 CLAUDE.md 를 쓰는 위자드를 바로 설치하기 망설여지면, 빈 폴더에서 먼저 돌려보세요:

```bash
mkdir harness-try && cd harness-try
/harness-marketplace:wizard
# Manual 모드 선택, CI/CD 는 "no", Step D 에서 Sentry + PostHog 선택
# → 생성된 .claude/skills/project-harness/ 트리를 직접 열어 확인
```

git 리포 없음, 의존성 없음, 실제 코드베이스에 부작용 없음. 다 보면 폴더째 삭제하면 끝입니다.

---

## Acknowledgments

Special thanks to In-gyo Jung.

## 라이선스

Apache-2.0 — 자세한 내용은 [LICENSE](./LICENSE)를 참조하세요.
