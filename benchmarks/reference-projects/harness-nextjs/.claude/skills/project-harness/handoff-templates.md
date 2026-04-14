# Handoff 템플릿 (Handoff Templates)

project-harness 파이프라인의 team stage 간 전달을 위한 handoff 파일 형식.
각 stage 완료 시 `.claude/skills/project-harness/state/handoffs/{stage}.md` 에 작성한다.

이 템플릿들은 **deterministic recovery** 를 가능하게 한다 — `/project-harness --resume` 실행 시 handoff 파일을 파싱해 중단 지점부터 이어감.

참조: `schemas.md` (JSON 데이터 계약), `progress-format.md` (진행 표시), `ui-conventions.md` (summary 포맷)

---

## plan.md (Phase 1 → Phase 2 / → Phase 4+5)

```markdown
# Handoff: project-plan → project-implement

## 작업 개요 / Task Info
- **작업 설명**: {task_description}
- **작업 유형**: {type}  # feature | bugfix | refactor | config
- **팀**: {team_name}

## 분류 결과 / Classification
- type: {feature|bugfix|refactor|config}
- has_ui: {true|false}
- has_backend: {true|false}
- has_database: {true|false}
- has_auth: {true|false}
- has_realtime: {true|false}
- has_security_surface: {true|false}
- is_internal_service: {true|false}
- visual_qa_capable: {true|false}
- active_agents: [{agent_ids}]  # 또는 "none"
- domains: [{domain_ids}]  # 또는 "none"

## 탐색 결과 / Exploration

### 관련 파일 / Related Files
{structure-explorer 결과: 파일 목록, 각 파일의 역할 요약}

### 의존성 분석 / Dependencies
{dependency-explorer 결과: import/export 그래프, npm/pip 패키지 상태}

### 기존 패턴 / Existing Patterns
{pattern-explorer 결과: 발견된 컨벤션, 유사 기능 구현 방식}

### 도메인 탐색 / Domain Exploration (해당 시)
{domain-explorer 결과: 도메인별 기존 구현 확인}

## 설계 / Design

### 파일 생성 / Files to Create
{files_to_create: [path, purpose]}

### 파일 수정 / Files to Modify
{files_to_modify: [path, change_summary]}

### 파일 삭제 / Files to Delete
{files_to_delete: [path]}  # 통상 0개

### 작업 순서 / Task Order
{task_order: [step_index, description, depends_on]}

### 도메인 검증 / Domain Validation (해당 시)
{domain-validator 결과: 도메인 정합성 검증}

## UI/UX 설계 (has_ui == true 일 때만)

### 컴포넌트 구조 / Component Tree
{ux-designer 결과: 컴포넌트 계층}

### 레이아웃 전략 / Layout Strategy
{spacing, overflow 방지, alignment 패턴, responsive breakpoints}

### 디자인 토큰 / Design Tokens
{사용할 디자인 토큰 목록}

## 주의사항 / Risks
- {잠재적 위험 요소}
- {의존성 충돌 가능성}
- {배포 영향 범위}

## 사용자 승인 / User Approval
- 확인 일시: {ISO timestamp}
- 선택: {진행 | 수정 후 진행 (변경 사항: ...) | 중단}

## 다음 stage 입력 / Next Stage Input
- Phase 4+5 (project-implement) 에서 위 계획에 따라 구현
- 데이터 위치:
  - Notepad 키: `project-plan-phase2-merged`
  - JSON 결과: `state/results/plan.json` (schemas.md 의 PlanResult 스키마)
```

---

## debug.md (Phase 3.5 — bugfix + high complexity 일 때만)

```markdown
# Handoff: project-debug → project-implement

## 작업 개요 / Task Info
- **작업 설명**: {task_description}
- **작업 유형**: bugfix
- **디버그 복잡도**: {high|medium}  # low 면 debug phase 자체 skip

## 재현 결과 / Reproduction
- **재현 가능**: {true|false}
- **재현 방법**: {단계별 설명}
- **환경**: {OS / 브라우저 / node 버전 등}
- **에러 메시지**: {stderr / console / stack trace}

## 가설 검증 / Hypothesis Testing
| # | 가설 | 검증 결과 | 증거 |
|---|------|-----------|------|
| A | {hypothesis_a} | {confirmed / rejected / inconclusive} | {log, code ref, test output} |
| B | {hypothesis_b} | ... | ... |
| C | {hypothesis_c} | ... | ... |

## 근본 원인 / Root Cause
{최종 확정된 근본 원인. 코드 경로 + 조건 + 증거}

## 수정 방향 / Fix Direction
- **수정 위치**: {file:line 범위}
- **수정 전략**: {patch | refactor | 새 guard 추가}
- **회귀 방지**: {재현 테스트 추가 필요 여부}

## 다음 stage 입력 / Next Stage Input
- Phase 4+5 (project-implement) 에서 재현 테스트 먼저 작성 → 수정 → 통과 확인 순서
- 데이터 위치:
  - Notepad 키: `project-debug-result`
  - JSON 결과: `state/results/debug.json`
```

---

## exec.md (Phase 4+5 → Phase 6 / → Phase 7)

```markdown
# Handoff: project-implement → project-verify

## 작업 개요 / Task Info
- **작업 설명**: {task_description}
- **작업 유형**: {type}
- **팀**: {team_name}

## 분류 결과 / Classification
(plan.md 와 동일 — 모든 stage 가 독립적으로 참조 가능하도록 반복)

## 구현 결과 / Implementation Result

### 생성된 파일 / Files Created
{files_created: [path, loc]}

### 수정된 파일 / Files Modified
{files_modified: [path, diff_lines_added, diff_lines_removed]}

### 삭제된 파일 / Files Deleted
{files_deleted: [path]}

### 워커별 완료 상태 / Worker Status
- scaffolder: {완료 | 건너뜀 (이유)}
- implementer: {완료 | 건너뜀}
- ui-checker: {완료 | 건너뜀 (has_ui: false)}
- integrator: {완료 | 건너뜀}
- domain-reviewer: {완료 | 건너뜀 (도메인: none)}
- security-checker: {완료 | 건너뜀 (has_security_surface: false)}
- test-writer: {완료 | 건너뜀}
- test-runner: {완료 | 건너뜀}
- build-checker: {완료 | 건너뜀}

## 테스트 결과 / Test Results
- 통과 / Passed: {N}개
- 실패 / Failed: {N}개
- 커버리지 / Coverage: {pct}% (측정 가능 시)

## 빌드 결과 / Build
- typecheck: {pass | fail (N errors)}
- lint: {pass | fail (N violations)}
- build: {pass | fail}
- 자동 수정 시도: {N}/5회

## 보안 게이트 / Security Gate (has_database or has_auth 시)
- security-audit: {pass | block | n/a}
- 세부사항 / Details: {항목별 결과 리스트}

## 도메인 리뷰 / Domain Review (도메인 플래그 시)
- domain-review: {pass | warn | n/a}
- 세부사항 / Details: {도메인별 리뷰 코멘트}

## 브라우저 QA / Browser QA (has_ui == true, Phase 6 실행 후)
- visual-qa: {pass | pass_with_fixes | fail | skipped}
- 자동 수정 / Auto-fixes: {N}건
- 세부사항 / Details: {페이지별 결과}

## 다음 stage 입력 / Next Stage Input
- Phase 7 (project-verify) 에서 위 결과를 바탕으로 다중 에이전트 검증
- 데이터 위치:
  - Notepad 키: `project-implement-result`, `project-visual-qa-result`
  - JSON 결과: `state/results/implement.json`, `state/results/visual-qa.json`
```

---

## verify.md (Phase 7 → 완료 / 회귀)

```markdown
# Handoff: project-verify → complete / regression

## 작업 개요 / Task Info
- **작업 설명**: {task_description}
- **작업 유형**: {type}
- **팀**: {team_name}

## 분류 결과 / Classification
(이전 handoff 들과 동일)

## 검증 결과 / Verification Results

### 고정 검증 / Fixed Checks (항상 실행)
| 항목 | 결과 | 세부 |
|------|------|------|
| arch-audit | {pass \| fail} | BLOCK: {N}, WARN: {N}, INFO: {N} |
| code-review | {pass \| fail} | BLOCK: {N}, WARN: {N} |
| typecheck | {pass \| fail} | 에러: {N} |
| lint | {pass \| fail} | - |
| deploy-validation | {pass \| fail} | Frontend: {s}, Backend: {s}, DB: {s} |

### 조건부 검증 / Conditional Checks
| 항목 | 조건 | 결과 | 세부 |
|------|------|------|------|
| ux-review | has_ui | {pass\|warn\|skip} | overflow: {N}, spacing: {N}, alignment: {N} |
| design-review | has_ui | {pass\|warn\|skip} | score: {N}/100, BLOCK: {N}, WARN: {N} |
| db-security | has_database | {pass\|block\|skip} | 통과: {N}/{Total}, 해당없음: {N} |
| auth-security | has_auth | {pass\|block\|skip} | 통과: {N}/{Total} |
| seo-verification | is_internal_service=false | {pass\|warn\|skip} | 레이어: {N}/4 |
| security-audit | has_security_surface | {pass\|warn\|skip} | HIGH: {N}, MEDIUM: {N} |
| domain-{id}-audit | domain 활성화 | {pass\|warn\|skip} | {N}/{Total} 통과 |

(도메인별 audit 은 선택된 domain agent 에 따라 동적으로 추가됨)

## 종합 판정 / Overall
- **overall**: {pass | pass_with_warnings | fail}
- **regression_needed**: {true | false}
- **tier breakdown**: BLOCK {N} | WARN {N} | INFO {N} (verify.md §Failure Tiers 참조)

## 회귀 시 / Regression (regression_needed == true)
- **실패 항목 / Failed items**: {구체적 에러 목록}
- **회귀 유형 / Regression type**: {arch-fix | build-fix | security-fix | domain-fix}
- **회귀 stage**: team-fix → project-implement → (Phase 6) → project-verify
- **회귀 횟수 / Attempt**: {current}/{max}  # max = 2

## 완료 시 / Complete (regression_needed == false)
- 팀 해체: TeamDelete("{team_name}")
- 상태 정리: state_clear(pipeline)
- 최종 summary 출력: ui-conventions.md §"V4. 완료 요약" 스키마
- Notepad 키: `project-verify-result`
- JSON 결과: `state/results/verify.json`
```

---

## Handoff 파일 경로 / File Paths

```
.claude/skills/project-harness/state/handoffs/
├── plan.md         # Phase 1+2+3 결과 → Phase 4+5 입력
├── debug.md        # Phase 3.5 결과 → Phase 4+5 입력 (조건부)
├── exec.md         # Phase 4+5 결과 → Phase 7 입력
└── verify.md       # Phase 7 결과 → 최종 보고서 / 회귀 결정
```

---

## Handoff 작성 규칙 / Writing Rules

1. **필수 섹션**: 작업 개요 + 분류 결과는 **모든 handoff 에 포함** (각 stage 가 독립적 재시작 가능)
2. **분류 결과 전파**: plan.md 의 분류 결과를 exec.md / verify.md 에서도 반복 — 각 stage 가 독립 참조 가능
3. **조건부 섹션은 skip 로 명시**: 해당 플래그가 false 라도 섹션 자체는 제거하지 않고 "skipped" 또는 "n/a" 로 표시
4. **Notepad 키 참조**: 상세 데이터는 Notepad 에 저장하고 handoff 에는 키만 기록 (handoff 파일 크기 bounded)
5. **JSON 결과 경로 명시**: `state/results/*.json` 에 schemas.md 스키마 기반 구조화 데이터 저장
6. **다음 stage 안내**: handoff 끝에 "다음 stage 입력" 섹션으로 재개 지점 명시
7. **ISO timestamp**: 모든 시간 기록은 ISO 8601 UTC (예: `2026-04-14T01:23:45Z`)

---

## 관련 참조 파일

- `schemas.md` — state/results/*.json 의 공식 JSON 스키마
- `progress-format.md` — 진행 중 출력 (handoff 작성은 phase 종료 시)
- `ui-conventions.md` — 사용자 승인 게이트 + 완료 요약 포맷
- `guide-injection.md` — 각 워커가 참조할 guide 파일 매핑
