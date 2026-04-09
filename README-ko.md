# harness-marketplace

**프로젝트 맞춤형 개발 파이프라인 harness 스킬을 생성하는 스캐폴딩 위자드 — Claude Code 플러그인**

프로젝트 유형, 기술 스택, 배포 환경에 맞는 완전한 개발 파이프라인(plan → implement → visual-qa → verify)을 생성합니다. 하나의 위자드로 모든 프로젝트를 지원합니다.

> **[English](./README.md)**

---

## 기능 요약

```
/harness-marketplace:wizard
  │
  ├─ 프로젝트에 대한 단계별 질문
  │   (유형, 언어, DB, 플랫폼, 기술스택...)
  │
  ├─ 완전한 harness 스킬 세트 생성
  │   ├── project-config.yaml
  │   ├── plan/SKILL.md
  │   ├── implement/SKILL.md
  │   ├── visual-qa/SKILL.md  (UI 프로젝트인 경우)
  │   ├── verify/SKILL.md
  │   ├── agents/*.md          (AI 생성, 사용자 선택)
  │   ├── guides/*.md          (AI 생성, 사용자 선택)
  │   └── references/
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
| 8+ | 조건부 질문 | 인증 방식, 상태관리, CI/CD... (프로젝트 유형에 따라 달라짐) |
| A | 에이전트 선택 | security-reviewer, performance-auditor... (복수 선택) |
| G | 가이드 선택 | api-design, database-design... (복수 선택) |

모든 질문 완료 후: 파일 생성 → 구조 검증 → plan 드라이런 → 사용자 확인.

### 기존 harness 업그레이드

```bash
/harness-marketplace:upgrade
```

`project-config.yaml`을 보존하면서 템플릿 기반 스킬 파일만 최신 버전으로 업데이트합니다.

### 생성된 harness 사용

```bash
/project-harness "사용자 인증 구현"
/project-harness --dry-run "결제 연동 추가"
/project-harness --resume
```

## 동작 원리

### 하이브리드 생성 방식

| 구성요소 | 방식 | 출처 |
|---------|------|------|
| SKILL.md 파일 (orchestrator, plan, implement, verify) | **템플릿** | `templates/*.md` — 파이프라인 구조 일관성 유지 |
| project-config.yaml | **매핑** | 위자드 답변 → YAML 스키마 |
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

## 플러그인 구조

```
harness-marketplace/
├── .claude-plugin/
│   ├── plugin.json              # 플러그인 매니페스트
│   └── marketplace.json         # 마켓플레이스 메타데이터
├── skills/
│   ├── wizard/SKILL.md          # 메인 스캐폴딩 위자드
│   └── upgrade/SKILL.md         # Harness 업그레이드 스킬
├── templates/                   # Harness 골격 템플릿 (7개)
│   ├── orchestrator.md
│   ├── plan.md
│   ├── implement.md
│   ├── visual-qa.md
│   ├── verify.md
│   ├── config-schema.yaml
│   └── classification.md
├── data/                        # 딥리서치 옵션 데이터셋 (8개)
│   ├── project-types.yaml       # 3단계 프로젝트 분류 체계
│   ├── languages.yaml           # 프로그래밍 언어
│   ├── databases.yaml           # 데이터베이스 (서버리스 & 전통)
│   ├── cache-servers.yaml       # 캐시 옵션
│   ├── platforms.yaml           # 배포 플랫폼
│   ├── tech-stacks.yaml         # 기술 스택 옵션
│   ├── mcps.yaml                # MCP 서버 요구사항
│   └── branching-tree.yaml      # 조건분기 위자드 단계
├── scripts/
│   └── validate-harness.js      # 구조 & 스키마 검증기
├── package.json
└── README.md
```

## 요구사항

- **Claude Code** Agent Teams 활성화 (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)
- **omc** (oh-my-claudecode) — 선택사항, 설치 시 상태 관리 향상

## revfactory/harness 와의 비교

| 관점 | revfactory/harness | harness-marketplace |
|------|-------------------|---------------------|
| 범위 | 범용 (모든 도메인) | **소프트웨어 개발 파이프라인 특화** |
| 입력 | 자연어 프롬프트 | **구조화된 위자드** (10+ 단계) |
| 생성 | 전체 AI 생성 | **하이브리드** (템플릿 + AI) |
| 설정 | 없음 (마크다운만) | **project-config.yaml** 기반 |
| 파이프라인 | 범용 에이전트 팀 | **plan → implement → visual-qa → verify** |
| 검증 | 기본 드라이런 | 구조 검증 + plan 드라이런 + 사용자 확인 |
| 업그레이드 | 없음 | config 보존 템플릿 업그레이드 |

## 라이선스

MIT
