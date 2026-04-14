# UI Conventions — Confirmation Gates & Completion Summaries

project-harness 파이프라인 전체에서 사용자에게 보이는 확인 게이트와 완료 요약의 **표준 포맷**.
`orchestrator.md` 와 각 하위 스킬(project-plan, project-implement, project-verify 등)이 이 규칙을 따른다.

참조: `progress-format.md` (진행률 아이콘/배너), `classification.md` (Phase 0 분류 출력)

---

## V3. 확인 게이트 (Confirmation Gate) — 3-옵션 표준

모든 사용자 확인 지점(plan 승인, regression loop 시작, destructive action 전, config 덮어쓰기 등)은 **정확히 3개 옵션**으로 구성된다:

### 표준 포맷

```
AskUserQuestion:
  question: "<현 상황 1-2문장>. 어떻게 진행할까요?"
  label_ko: "<짧은 헤더 (4-8글자)>"
  options:
    (a) "진행 / Proceed"           — 현재 상태로 그대로 진행
    (b) "수정 후 진행 / Modify"    — 조정 의견을 받아 반영 후 진행
    (c) "중단 / Abort"             — 파이프라인 중단 (state 보존, --resume 가능)
```

### 예시 1 — plan 승인 게이트 (project-plan Phase 3)

```
📋 Plan 완성 — 아래 계획으로 구현을 진행할까요?

작업: 사용자 프로필 카드 UI 추가
유형: feature | has_ui: true | has_auth: true

📁 생성할 파일 (3):
  - src/features/profile/ui/ProfileCard.tsx
  - src/features/profile/api/useProfile.ts
  - src/features/profile/model/types.ts

📝 수정할 파일 (2):
  - src/pages/dashboard/ui/DashboardPage.tsx
  - src/shared/api/endpoints.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━

[진행]           [수정 후 진행]           [중단]
```

- **진행** 선택 시: `state/handoffs/plan.md` 작성 → Phase 4 (implement) 로 이동
- **수정 후 진행** 선택 시: 자유 입력으로 조정 의견 받고 설계 재수립 (Phase 2 재실행)
- **중단** 선택 시: `state/pipeline-state.json.status = "aborted"` 기록, `/project-harness --resume` 으로 재개 가능

### 예시 2 — regression loop 재시도 게이트 (verify 실패 후)

```
🔍 verify 실패 — 회귀 루프를 실행할까요?

실패 항목: arch-audit BLOCK 1 (FSD 레이어 위반)
원인: features/profile 에서 widgets 직접 import
예상 수정 범위: 1 파일 (src/features/profile/ui/ProfileCard.tsx)
소요 예상: ~3분

━━━━━━━━━━━━━━━━━━━━━━━━━━━

[진행 (1/2회)]     [수정 후 진행]     [중단]
```

### 예시 3 — destructive action 전 (파일 overwrite / DB schema change 등)

```
⚠️ 파일 덮어쓰기 확인

대상: .claude/settings.json
기존 사용자 설정 3개 키가 있음 (hooks, statusLine, permissions)
신규 wizard 가 추가할 항목: 5 hook 등록

━━━━━━━━━━━━━━━━━━━━━━━━━━━

[병합 (기존 보존)]     [전체 교체]     [건너뛰기]
```

### 규칙

1. **정확히 3개 옵션** — 2개 or 4개 이상 금지. 선택지가 많으면 sub-option 으로 들어가거나 radio → text input 으로 전환
2. **label_ko** 는 짧게 (4-8글자) — 모바일 UI 에서도 chip 형태로 렌더
3. **첫 옵션은 항상 "진행"** — 가장 자주 선택되는 path 를 왼쪽에
4. **마지막 옵션은 항상 "중단"** — 사용자 철회 가능
5. **AskUserQuestion 앞에 context 블록 표시** — 어떤 결정인지 사용자가 충분히 이해하도록
6. **autopilot 모드** (`/project-harness autopilot "task"`) 시 모든 게이트 자동 "진행" 선택

---

## V4. 완료 요약 (Completion Summary) — 표준 스키마

각 phase 종료 + 파이프라인 전체 완료 시 **동일한 섹션 구조**로 요약 출력.

### 표준 스키마

```
{emoji} {skill-name} 완료 / {skill-name} complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━
작업 정보 / Task info
  - 작업: <task description>
  - 유형: <feature | bugfix | refactor | config>
  - 플래그: has_ui | has_backend | ...

변경 요약 / Changes
  - 생성 / Created: N 파일
  - 수정 / Modified: N 파일
  - 삭제 / Deleted: N 파일
  - 이동/리네임 / Moved: N 파일

검증 항목별 결과 / Verification
  - <항목 1>: ✅ / ❌ / ⚠️ / ⏭️
  - <항목 2>: ...

총 소요 시간 / Elapsed: Xm Ys
━━━━━━━━━━━━━━━━━━━━━━━━━━━
종합 / Overall: ✅ pass | ⚠️ pass_with_warnings | ❌ fail
회귀 필요 / Regression needed: true | false
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 예시 — project-harness 전체 파이프라인 완료

```
⚙️ Project Harness Pipeline 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━
작업 정보
  - 작업: 사용자 프로필 카드 UI 추가
  - 유형: feature
  - 플래그: has_ui | has_auth | has_database

변경 요약
  - 생성: 3 파일 (src/features/profile/ 하위)
  - 수정: 2 파일 (DashboardPage.tsx, endpoints.ts)
  - 삭제: 0
  - 이동/리네임: 0

검증 항목별 결과
  - typecheck: ✅ 에러 0
  - lint: ✅ 통과
  - test: ✅ 15/15 통과
  - visual-qa: ✅ overflow 0 | alignment 0 | spacing 0
  - arch-audit: ✅ BLOCK 0 | ⚠️ WARN 1
  - security-audit: ⏭️ (has_security_surface: false)
  - db-audit: ⏭️ (has_database: false, Phase 5 건너뜀)

총 소요 시간: 12m 34s
━━━━━━━━━━━━━━━━━━━━━━━━━━━
종합: ✅ pass
회귀 필요: false
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 예시 — project-implement 단독 완료

```
🔨 project-implement 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━
작업 정보
  - 작업: Fix login 500 error
  - 유형: bugfix
  - 플래그: has_auth | has_backend

변경 요약
  - 생성: 1 파일 (tests/login.regression.test.ts)
  - 수정: 2 파일 (src/auth/login.ts, src/auth/session.ts)
  - 삭제: 0
  - 이동/리네임: 0

검증 항목별 결과
  - 재현 테스트: ✅ 실패 1건 확인
  - 버그 수정: ✅ 세션 만료 조건 보정
  - 통과 확인: ✅ 재현 테스트 통과
  - 빌드 게이트: ✅ typecheck ✅ | lint ✅

총 소요 시간: 4m 18s
━━━━━━━━━━━━━━━━━━━━━━━━━━━
종합: ✅ pass
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 규칙

1. **모든 섹션 헤더는 한/영 병기** — bilingual 사용자에게 friction 최소
2. **파일 카운트는 0이어도 표기** — `생성: 0` (빈 값 → 누락 혼동 방지)
3. **⏭️ 건너뜀은 이유 괄호** — `⏭️ (has_database: false)` 형태로
4. **총 소요 시간은 mm:ss** — 1시간 초과 시 `Xh Ym Zs`
5. **종합 판정은 3단계** — `✅ pass` / `⚠️ pass_with_warnings` / `❌ fail`
6. **구분선** — `━━━━━━━━━━━━━━━━━━━━━━━━━━━` (27자) 로 모든 summary 에서 동일

---

## 출력 위치 규칙

- 각 sub-skill 완료 시 **자체 summary 출력** (해당 skill 고유 emoji 사용)
- orchestrator (`project-harness`) 는 **최종 파이프라인 summary** 출력 (⚙️ 이모지)
- regression loop 진입 시 verify summary 먼저 표시 → confirmation gate → 2회차 summary
- `--quiet` 플래그: summary 의 "변경 요약" + "총 소요 시간" 만 표시, 검증 항목 생략
- `--verbose` 플래그: 검증 항목마다 상세 로그 첨부

---

## 관련 참조 파일

- `progress-format.md` — 진행 중 출력 포맷 (phase N/M, worker tree)
- `classification.md` — Phase 0 분류 출력 (🏷️ 형식)
- `handoff-templates.md` — phase 간 `state/handoffs/*.md` 구조
- `verify.md` §Failure Tiers — BLOCK / WARN / INFO 판정 기준
