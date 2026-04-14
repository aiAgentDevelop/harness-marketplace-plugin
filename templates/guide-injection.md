# 가이드 & 에이전트 체크리스트 주입 (Guide Injection)

project-harness 파이프라인의 각 워커에게 **가이드 파일과 에이전트 체크리스트를 자동 주입**하는 매핑 규칙.
project-plan, project-implement, project-visual-qa, project-verify 가 공통 참조.

> 이 파일은 wizard 가 프로젝트의 `.claude/skills/project-harness/references/guide-injection.md` 로 복사.
> 구체 가이드/에이전트 파일 목록은 `project-config.yaml.agents.selected` + `project-config.yaml.guides.selected` 기반으로 wizard 가 주입.

참조: `progress-format.md` (워커 진행 표시), `handoff-templates.md` (워커 결과 전달), `schemas.md` (결과 JSON 계약)

---

## 가이드 로드 규칙 / Guide Loading

### 워커별 가이드 파일 매핑 (generic baseline)

| 워커 | Phase | 기본 가이드 (selected guides 에서 활성화된 것만) |
|------|-------|------|
| structure-explorer | 1 — 분석 | architecture-overview, project-layout |
| dependency-explorer | 1 — 분석 | dependency-analysis |
| pattern-explorer | 1 — 분석 | pattern-conventions |
| architect | 2 — 설계 | architecture-overview, architecture-rules |
| ui-designer (has_ui) | 2 — 설계 | design-system, ux-checklist, **ui-defect-patterns** |
| scaffolder | 4 — 구현 | project-layout, module-scaffold, **fsd-scaffold-patterns** (architecture=fsd) |
| implementer | 4 — 구현 | architecture-rules, coding-standards |
| ui-checker (has_ui) | 4 — 구현 | ux-checklist, design-system, **ui-defect-patterns** |
| integrator | 4 — 구현 | architecture-rules |
| security-checker (has_security_surface) | 4 — 구현 | auth-security, api-design |
| test-writer | 4 — 구현 | testing-strategy |
| arch-auditor | 7 — 검증 | architecture-overview, architecture-rules |
| code-reviewer | 7 — 검증 | coding-standards, architecture-rules |
| deploy-validator | 7 — 검증 | deployment-checklist |
| ux-reviewer (has_ui) | 7 — 검증 | ux-checklist, **ui-defect-patterns** |
| design-reviewer (has_ui) | 7 — 검증 | design-system |
| db-auditor (has_database) | 7 — 검증 | database-design |
| auth-auditor (has_auth) | 7 — 검증 | auth-security |

### 가이드 파일 경로

```
.claude/skills/project-harness/guides/
├── architecture-overview.md       # 전체 구조 / 레이어 / 경계
├── architecture-rules.md          # 금지 의존성, 레이어 위반 규칙
├── project-layout.md              # 디렉토리/파일 배치 규칙
├── dependency-analysis.md         # 의존성 그래프 수집 가이드
├── pattern-conventions.md         # 프로젝트 고유 패턴 수집
├── design-system.md               # 디자인 토큰·컴포넌트 규칙 (has_ui)
├── ux-checklist.md                # UX 검증 체크리스트 (has_ui)
├── coding-standards.md            # 코딩 컨벤션
├── testing-strategy.md            # 테스트 작성 기준
├── auth-security.md               # 인증/인가 보안 (has_auth)
├── api-design.md                  # API 설계 규칙 (has_backend)
├── database-design.md             # DB 스키마/인덱스/쿼리 (has_database)
├── deployment-checklist.md        # 배포 전 검증
└── error-handling.md              # 에러 처리 패턴
```

> 실제 생성되는 파일 목록은 `project-config.yaml.guides.selected` 에 따라 달라짐. 미선택 가이드는 `.claude/skills/project-harness/guides/` 에 존재하지 않으며, 해당 가이드를 참조하는 워커는 경고 없이 skip.

---

## 에이전트 체크리스트 주입 / Agent Checklist Injection

### 기술 에이전트 (t-*) — 자동 주입

`.claude/skills/project-harness/agents/t-*.md` 에 있는 기술 전문가 에이전트의 `## Required Checklist` 섹션을 워커 프롬프트에 `참조 규칙:` 블록으로 자동 주입.

| 워커 | Phase | 주입 대상 (활성화된 t-* 에이전트만) |
|------|-------|------|
| architect | 2 — 설계 | t-frontend-architect (has_ui), t-backend-architect (has_backend), t-db-architect (has_database) |
| implementer | 4 — 구현 | t-frontend-architect, t-state-data-engineer (has_ui+state), t-backend-engineer (has_backend) |
| ui-checker (has_ui) | 4 — 구현 | t-ui-ux-engineer |
| scaffolder | 4 — 구현 | t-architecture-architect |
| security-checker (has_security_surface) | 4 — 구현 | t-security-engineer |
| test-writer | 4 — 구현 | t-testing-qa-engineer |
| arch-auditor | 7 — 검증 | t-architecture-architect |
| code-reviewer | 7 — 검증 | t-frontend-architect, t-state-data-engineer |
| db-auditor (has_database) | 7 — 검증 | t-db-expert (구체 엔진별 — `t-postgresql-expert`, `t-mysql-expert`, `t-mongo-expert` 등) |

> `t-*.md` 에이전트 파일 존재 여부 체크 후 주입. 파일 미존재 시 해당 체크리스트 주입 자체를 skip (워커는 가이드만 로드해서 진행).

### 기술 에이전트 파일 경로

```
.claude/skills/project-harness/agents/
├── t-architecture-architect.md    # 전반적 아키텍처 체크리스트
├── t-frontend-architect.md        # FE 프레임워크별 체크리스트
├── t-backend-architect.md         # BE 프레임워크별 체크리스트
├── t-backend-engineer.md          # BE 구현 체크리스트
├── t-state-data-engineer.md       # 상태관리/데이터 체크리스트
├── t-ui-ux-engineer.md            # UI/UX 구현 체크리스트
├── t-db-architect.md              # DB 설계 체크리스트
├── t-{engine}-expert.md           # 엔진별 전문가 (postgresql/mysql/mongo/...)
├── t-security-engineer.md         # 보안 체크리스트
└── t-testing-qa-engineer.md       # 테스트/QA 체크리스트
```

### 주입 방법 / Injection Mechanics

워커 프롬프트 생성 시 해당 에이전트 `.md` 파일의 `## Required Checklist` 섹션을 읽어 `참조 규칙:` 블록으로 삽입:

```markdown
# 워커 프롬프트

[기존 워커 지시사항]

---
참조 규칙 / Required Checklist:
[t-frontend-architect.md 의 ## Required Checklist 내용]
[t-ui-ux-engineer.md 의 ## Required Checklist 내용]
---
```

주입 텍스트는 워커 컨텍스트 상단에 배치 — 모든 의사결정이 체크리스트를 인지한 상태에서 이뤄지도록.

---

## 도메인 에이전트 — 조건부 주입 / Domain Agent Injection (conditional)

도메인 플래그(`project-config.yaml.flags.domain_*`) 활성화 시 해당 도메인 에이전트 체크리스트를 전문 워커에게 주입.
도메인 워커는 Phase 1 (탐색), Phase 2 (설계 검증), Phase 4 (구현 리뷰), Phase 7 (최종 감사) 에 투입.

> **에이전트 파일 미존재 시 자동 skip** — 프로젝트의 `.claude/skills/project-harness/agents/` 에 해당 에이전트 파일이 없으면 해당 도메인 워커 스폰 자체를 skip.

### 도메인 에이전트 카탈로그 (data/agents.yaml 기반)

wizard 가 `data/agents.yaml` 에서 `domain` 필드 값에 따라 선택적으로 생성. 11개 도메인:

| 도메인 | 에이전트 ID 예시 | 활성 플래그 |
|--------|---------------|-----------|
| security | `security-auditor`, `auth-auditor`, `dependency-scanner` | has_security_surface |
| performance | `performance-auditor`, `bundle-analyzer`, `render-auditor` | has_performance_target |
| db | `db-auditor`, `migration-safety-reviewer`, `concurrency-auditor` | has_database |
| frontend | `accessibility-auditor`, `mobile-responsive-auditor`, `design-system-reviewer`, `seo-auditor` | has_ui |
| data | `ml-pipeline-auditor`, `etl-validator` | domain_data |
| devops | `ci-cd-auditor`, `infra-cost-reviewer` | has_ci_cd |
| arch | `architecture-architect`, `layer-boundary-auditor` | 항상 |
| quality | `code-reviewer`, `type-linter` | 항상 |
| debugging | `root-cause-analyst`, `trace-auditor` | type=bugfix |
| iot | `device-protocol-auditor`, `edge-runtime-auditor` | project_type=iot |
| game | `game-economy-auditor`, `gs-gacha-compliance`, `gs-integrity-auditor`, `t-game-api-architect` | project_type=game |

### 도메인 워커 스폰 패턴

각 활성화된 도메인에 대해 Phase 별로 동적으로 워커 이름 생성:

```
{domain_id}-explorer    # Phase 1 — 기존 구현 탐색
{domain_id}-validator   # Phase 2 — 설계 정합성 검증
domain-reviewer         # Phase 4 — 구현 리뷰 (도메인 에이전트 체크리스트 주입)
{domain_id}-auditor     # Phase 7 — 최종 감사
```

예시 (project_type=game 에서 `gs-gacha-compliance` 활성 시):

```
gs-gacha-compliance-explorer   # Phase 1
gs-gacha-compliance-validator  # Phase 2
domain-reviewer (주입: gs-gacha-compliance.md 체크리스트)  # Phase 4
gs-gacha-compliance-auditor    # Phase 7
```

---

## Phase 별 주입 요약 / Phase Summary

### Phase 1: 분석 (team-plan)

| 워커 | 가이드 | 기술 에이전트 | 도메인 에이전트 |
|------|-------|-------------|--------------|
| structure-explorer | architecture-overview, project-layout | - | - |
| dependency-explorer | dependency-analysis | - | - |
| pattern-explorer | pattern-conventions | - | - |
| {domain}-explorer (조건부) | - | - | 해당 agent 체크리스트 |

### Phase 2: 설계 (team-prd)

| 워커 | 가이드 | 기술 에이전트 | 도메인 에이전트 |
|------|-------|-------------|--------------|
| architect | architecture-overview, architecture-rules | t-frontend-architect (has_ui), t-backend-architect (has_backend), t-db-architect (has_database) | - |
| ui-designer (has_ui) | design-system, ux-checklist | t-ui-ux-engineer | - |
| {domain}-validator (조건부) | - | - | 해당 agent 체크리스트 |

### Phase 4: 구현 (team-exec)

| 워커 | 가이드 | 기술 에이전트 | 도메인 에이전트 |
|------|-------|-------------|--------------|
| scaffolder | project-layout, module-scaffold, **fsd-scaffold-patterns** (if fsd) | t-architecture-architect | - |
| implementer | architecture-rules, coding-standards | t-frontend-architect, t-state-data-engineer, t-backend-engineer | - |
| ui-checker (has_ui) | ux-checklist, design-system | t-ui-ux-engineer | - |
| integrator | architecture-rules | - | - |
| domain-reviewer (조건부) | - | - | 해당 agent 체크리스트 |
| security-checker (has_security_surface) | auth-security, api-design | t-security-engineer | - |
| test-writer | testing-strategy | t-testing-qa-engineer | - |

### Phase 7: 검증 (team-verify)

| 워커 | 가이드 | 기술 에이전트 | 도메인 에이전트 |
|------|-------|-------------|--------------|
| arch-auditor | architecture-overview, architecture-rules | t-architecture-architect | - |
| code-reviewer | coding-standards, architecture-rules | t-frontend-architect, t-state-data-engineer | - |
| type-linter | - | - | - |
| deploy-validator | deployment-checklist | - | - |
| ux-reviewer (has_ui) | ux-checklist | - | - |
| design-reviewer (has_ui) | design-system | - | - |
| db-auditor (has_database) | database-design | t-{engine}-expert | - |
| auth-auditor (has_auth) | auth-security | - | - |
| {domain}-auditor (조건부) | - | - | 해당 agent 체크리스트 |

---

## 주입 우선순위 / Priority

워커 프롬프트에 컨텍스트 주입 순서 (상단→하단):

1. **워커 기본 지시사항** — 해당 phase / 역할의 기본 프롬프트
2. **가이드 파일 내용** — 워커의 기반 지식 (기본 1-2개)
3. **기술 에이전트 체크리스트** — `참조 규칙:` 블록
4. **도메인 에이전트 체크리스트** — 도메인 플래그 활성화 시 추가
5. **handoff 파일** (Phase 2+ 에서) — 이전 phase 의 결과 전달

스탬프 원칙: **워커는 자신이 어떤 가이드·체크리스트·도메인 규칙을 따라야 하는지 한 번에 전부 인지**한 상태로 작업을 시작해야 한다. 중간에 추가 주입이나 runtime lookup 이 필요하지 않아야 함.

---

## 관련 참조 파일

- `progress-format.md` — 워커 진행 표시 (워커 트리 렌더)
- `handoff-templates.md` — phase 간 결과 전달 구조
- `schemas.md` — 워커 결과 JSON 스키마
- `ui-conventions.md` — 사용자에게 보이는 요약 포맷
