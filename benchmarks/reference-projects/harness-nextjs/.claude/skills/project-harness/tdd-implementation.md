# TDD Implementation Strategy — Red-Green-Refactor

`project-implement` 스킬의 대체 워크플로. `project-config.yaml.pipeline.implement_strategy: "tdd"` 시 활성화되며, 표준 scaffolder→implementer→integrator 파이프라인을 **test-writer (Red) → implementer (Green) → refactorer (Refactor)** 순서로 대체한다.

참조: `progress-format.md` (진행 표시), `ui-conventions.md` (3-옵션 게이트), `handoff-templates.md` (Phase 간 handoff), `guide-injection.md` (test-writer 주입 가이드)

---

## 언제 사용하는가 / When to use

**TDD 가 적합한 경우**:
- 요구사항이 명확히 정의됨 (acceptance criteria 작성 가능)
- 테스트 커버리지 보장이 중요한 영역 (결제 / 인증 / 도메인 로직 / 라이브러리)
- 회귀 방지가 critical (자주 건드리는 hot-path)
- 다인 협업 프로젝트 (테스트가 계약 역할)

**TDD 가 부적합한 경우** (standard 전략 권장):
- UI 시각 prototyping (테스트 비용이 가치보다 큼)
- 일회성 스크립트 / migration
- 외부 API 샘플링 / spike
- config 변경 (Phase 0 classification 에서 type=config 로 분류됨)

---

## Red-Green-Refactor 사이클

```
     ┌─────────────────────────────────────────────┐
     │                                             │
  ┌──▼──┐         ┌───────┐           ┌──────────┐ │
  │ Red │ ──────▶ │ Green │ ────────▶ │ Refactor │─┤
  └─────┘         └───────┘           └──────────┘ │
    fail            pass                  still      │
    test            test                  pass       │
                                           │         │
                                           ▼         │
                                      다음 케이스 ────┘
```

- **Red**: 실패하는 테스트 작성 (컴파일 실패 OR assertion 실패). `npm test` (또는 pytest 등) 로 실패 확인.
- **Green**: 테스트를 통과하는 **최소** 구현. over-engineering 금지. 모든 테스트 통과 확인.
- **Refactor**: 코드 정리, 중복 제거, 네이밍 개선. 테스트 계속 pass 유지.
- **반복**: 다음 acceptance criterion 으로 이동, Red 부터 다시.

---

## 워커 구성 / Worker Composition

표준 전략 대비 워커 교체:

| 표준 (standard) | TDD (tdd) |
|---|---|
| scaffolder — 디렉터리 / 파일 boilerplate 먼저 | **test-writer** — 실패 테스트 먼저 |
| implementer — 기능 구현 | implementer — 최소 구현 (테스트 통과용) |
| integrator — 주변 코드 통합 | **refactorer** — 코드 정리 + 중복 제거 |
| ui-checker (has_ui) | ui-checker (has_ui) — Phase 4 끝에 동일 |
| security-checker (has_security_surface) | security-checker — 동일 |
| test-writer | (별도 워커 없음 — 이미 Red 에서 작성됨) |
| test-runner | test-runner — Refactor 후 최종 실행 |
| build-checker | build-checker — 동일 |

### test-writer 워커 책임

1. Plan phase 에서 확정된 acceptance criteria 목록을 받음
2. 각 criterion 당 **1개 실패 테스트** 작성 (더 작게 쪼갤 수 있으면 sub-criterion 까지)
3. 테스트 파일 배치:
   {{CONDITION:fsd}}- **FSD 프로젝트**: `src/entities/<domain>/__tests__/` 또는 `src/features/<feature>/__tests__/` (fsd-scaffold-patterns.md 참조)
   {{/CONDITION:fsd}}- **일반**: `__tests__/` 또는 `tests/` 디렉터리 (프로젝트 컨벤션 준수)
4. `npm test` (또는 `pytest -x`) 로 **모든 테스트 실패 확인**
5. 실패 출력을 notepad `project-implement-red` 로 저장
6. 완료 시 Green 단계로 handoff

### implementer 워커 책임 (Green)

1. test-writer 의 notepad `project-implement-red` 에서 실패 테스트 목록 + 기대 동작 읽기
2. 테스트를 통과하는 **최소** 코드 작성 — hardcoded return 도 허용, 다음 Red 에서 일반화
3. 각 구현 후 `npm test` 실행, 테스트 통과 확인
4. **주의사항**:
   - Green 단계에서 refactoring 금지 (다음 단계 담당)
   - 미래 요구를 예상한 abstraction 금지
   - 테스트에 없는 기능 추가 금지

### refactorer 워커 책임 (Refactor)

1. Green 이 끝난 시점의 코드 품질 개선:
   - 중복 제거 (DRY)
   - 네이밍 개선
   - 함수/모듈 분리
   - 타입 정교화
2. 각 변경 후 `npm test` 실행 — 테스트 실패 시 즉시 revert
3. 최종 결과를 notepad `project-implement-refactor` 로 저장

---

## 프레임워크별 테스트 도구 / Test Tooling

`project-config.yaml.commands.test` 의 값에 따라 test-writer 가 사용할 도구 결정:

### Frontend — Vitest + Testing Library (JS/TS)

```typescript
// __tests__/UserProfile.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import userEvent from '@testing-library/user-event'
import { UserProfile } from '../ui/UserProfile'

describe('UserProfile', () => {
  it('사용자 이름을 표시한다', () => {
    render(<UserProfile name="홍길동" email="hong@example.com" />)
    expect(screen.getByText('홍길동')).toBeInTheDocument()
  })

  it('편집 버튼 클릭 시 onEdit 호출', async () => {
    const onEdit = vi.fn()
    const user = userEvent.setup()
    render(<UserProfile name="홍길동" email="h@e.com" onEdit={onEdit} />)
    await user.click(screen.getByRole('button', { name: /편집/ }))
    expect(onEdit).toHaveBeenCalledOnce()
  })
})
```

### Frontend — Hook / Store / API mock

```typescript
// __tests__/useProfile.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useProfile } from '../api/useProfile'

describe('useProfile', () => {
  it('GET /profile 을 호출하고 결과 반환', async () => {
    // MSW 로 API mocking
    const { result } = renderHook(() => useProfile('user-1'))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('user-1')
  })
})
```

### Backend — pytest (Python)

```python
# tests/test_auth.py
import pytest
from app.auth import create_access_token, get_current_user_id

def test_create_access_token_contains_sub():
    token = create_access_token(user_id=42)
    user_id = get_current_user_id(token)
    assert user_id == 42

def test_expired_token_raises():
    # given: 과거 시점 토큰
    ...
    with pytest.raises(TokenExpiredError):
        get_current_user_id(expired_token)
```

### Backend — Vitest + Supabase mock (Edge Function / RPC wrapper)

```typescript
// __tests__/submitDocument.test.ts
import { describe, it, expect, vi } from 'vitest'

describe('submitDocument', () => {
  it('RPC submit_document 를 올바른 파라미터로 호출', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: { id: '1', status: 'pending' }, error: null })
    }
    const { submitDocument } = await import('../supabase-rpc')
    const result = await submitDocument(mockSupabase as any, 'form-1', { title: '테스트' })
    expect(mockSupabase.rpc).toHaveBeenCalledWith('submit_document', {
      p_form_id: 'form-1',
      p_data: { title: '테스트' }
    })
    expect(result.data?.status).toBe('pending')
  })
})
```

---

## E2E 테스트 (--e2e 플래그 시)

`/project-harness "..." --e2e` 또는 `implement_strategy_tdd_includes_e2e: true` 시 Phase 4 끝에 E2E 워커 추가:

- **Playwright** (일반): 브라우저 자동화 + screenshot + network interception
- **Cypress** (React 주력): component test + E2E 모드
- **Testing Library + MSW** (lightweight): API mock 기반 통합 테스트

E2E 테스트는 Red 단계 포함 가능하지만 **선택적**. 단위 테스트 Red-Green 사이클이 우선.

---

## 사용자 출력 / User Output

Phase 4 시작 시 (ui-conventions.md §"V4. 완료 요약" 표준 + 진행 표시는 progress-format.md 준수):

```
🔨 project-implement (TDD strategy) 시작
━━━━━━━━━━━━━━━━━━━━━━━━━━━
유형: feature | 전략: tdd | 팀: {{TEAM_NAME}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 0: 가이드 로드             ✅ (tdd-implementation.md 로드됨)
Step 1: 테스트 작성 (Red)       🔄 Acceptance 3/5 처리 중
   ├─ test-writer          🔄 __tests__/UserProfile.test.tsx 작성 중
   └─ (기대: 모든 테스트 실패)
Step 2: 최소 구현 (Green)       ⏳
Step 3: 리팩토링                ⏳
Step 4: 통합 + 빌드 게이트      ⏳
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

각 Step 전환 시 이모지/상태 갱신 (✅/🔄/⏳/❌). Red 실패율 < 100% 시 경고 (일부 acceptance 가 이미 구현되어 있음을 암시).

---

## Handoff / State

handoff-templates.md 의 `exec.md` 에 아래 필드 추가 (TDD 전략 시):

```markdown
## TDD Cycle Summary
- **Red**: 작성된 실패 테스트 N개 (notepad: project-implement-red)
- **Green**: 최소 구현 완료 (notepad: project-implement-green)
- **Refactor**: 리팩토링 적용 N건 (notepad: project-implement-refactor)
- **테스트 최종**: 통과 N/N (커버리지 X%)
```

schemas.md 의 `ImplementationResult` 에 optional 필드 추가 (deserialization 시 undefined 허용):

```json
{
  "tdd_cycle": {
    "red_tests_written": 5,
    "green_cycles": 5,
    "refactor_changes": 3,
    "final_pass_rate": "5/5"
  }
}
```

---

## 제약 / Constraints

1. **project-config.yaml.commands.test 필수** — 미설정 시 wizard 가 경고 + standard 로 fallback
2. **type=config 에서는 비활성** — config 변경은 TDD 불필요. classification 단계에서 자동 skip
3. **refactor 시 TDD**: 기존 테스트 유지 + 리팩토링이 기존 테스트를 깨지 않는지 확인. Red 단계 skip 가능 (이미 테스트 존재)
4. **build gate 는 standard 와 동일** — typecheck/lint/build 자동 수정 루프 그대로 적용
5. **timeout** — test-writer 단독 phase 당 10분 제한 (대형 acceptance 10+ 시 경고)

---

## 관련 참조 파일

- `progress-format.md` §"project-implement 진행률" — TDD variant 출력 규칙
- `ui-conventions.md` §"V4. 완료 요약" — TDD Cycle Summary 포함
- `handoff-templates.md` — exec.md 에 TDD 섹션 추가
- `schemas.md` — ImplementationResult.tdd_cycle optional 필드
- `guide-injection.md` — test-writer 워커에 testing-strategy guide 주입
- {{CONDITION:fsd}}`fsd-scaffold-patterns.md` — FSD 프로젝트의 테스트 파일 위치 규칙{{/CONDITION:fsd}}

---

## 독립 실행 vs 통합

| 호출 방식 | 실행 상황 |
|---|---|
| `project-config.yaml.pipeline.implement_strategy = "tdd"` | `/project-harness "..."` Phase 4 가 TDD 파이프라인으로 자동 실행 |
| `/project-implement --strategy tdd "..."` | 단독 실행 (project-plan 없이 직접) |
| `/project-harness "..." --strategy tdd` | 세션 한정 오버라이드 |

config 값이 우선하며, 플래그로 세션 별 오버라이드 가능.
