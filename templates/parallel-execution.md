# Parallel Execution Pattern — Fan-out / Fan-in 구체 API 규약

project-harness 의 모든 phase 가 공유하는 **병렬 워커 실행 표준**. Fan-out / Fan-in 이라는 단어만 쓰고 Claude 가 알아서 해주기를 기대하면 **대부분 순차 실행**되어 wall-time 손해가 크다. 이 문서가 그 갭을 메우는 concrete directive.

참조: `plan.md` §Reader Pattern, `verify.md` §Failure Tiers, `codebase-analysis.md` §Fan-out, `handoff-templates.md` (워커 결과 전달), `schemas.md` (JSON 계약).

---

## 핵심 원칙 — Claude Code 의 실제 병렬성

Claude Code 에서 **진짜 병렬 도구 호출**이 일어나는 유일한 조건:

> **단일 assistant 응답 메시지 안에 여러 Task/Agent tool-use 블록이 동시에 포함**되어 있을 때.

그 외는 전부 순차 실행:
- 메시지 1 개에 1 개 tool call → 결과 대기 → 메시지 2 개에 다음 tool call = **순차**
- `TaskCreate` 를 여러 번 호출해도 blockedBy 가 체인되면 = **순차**
- "Fan-out" 이라고 프롬프트에 적어도 실제 tool-use 가 한 메시지에 안 묶이면 = **순차**

따라서 **병렬을 보장하려면 스킬 SKILL.md 가 Claude 에게 명시적으로 "한 메시지에 N 개 호출을 동시에 넣어라" 고 지시**해야 한다.

---

## 표준 패턴 — PARALLEL SPAWN DIRECTIVE

각 Fan-out 단계에 아래 템플릿을 그대로 삽입하여 Claude 가 확실하게 병렬로 실행하도록 강제.

### Template

```markdown
### Fan-out 실행 규약 (PARALLEL REQUIRED)

**CRITICAL**: 아래 워커들은 **단일 assistant 메시지 내에서 여러 Task/Agent tool-use 블록으로 동시에 spawn** 할 것. 하나씩 순차 호출 금지 — 순차 호출 시 wall-time 이 워커 수 만큼 선형 증가.

```js
// ✅ 올바른 형태 (single message, N parallel tool calls):
[
  Task({subagent_type: "Explore", description: "structure-explorer", prompt: "..."}),
  Task({subagent_type: "Explore", description: "dependency-explorer", prompt: "..."}),
  Task({subagent_type: "Explore", description: "pattern-explorer", prompt: "..."})
]
// → 3 개 Task 가 동시 실행. 총 wall-time ≈ max(worker times) + overhead

// ❌ 금지된 형태 (sequential):
// Message 1: Task(structure-explorer) → 결과 대기
// Message 2: Task(dependency-explorer) → 결과 대기
// Message 3: Task(pattern-explorer) → 결과 대기
// → wall-time = sum(worker times). 3배 느림.
```

완료 후 reader 워커가 `TaskGet` 으로 각 결과 수집 후 merge.
```

### Key phrases (Claude 에게 강한 신호)

- **"CRITICAL: single message ... multiple ... tool calls"** — 명령형 + 기술적 정확성
- **Code example 제공** — prose 설명보다 실행 가능한 예시가 더 강력
- **금지 형태 명시** — 올바른 형태와 함께 "금지" 예시를 제공하면 모델이 훨씬 더 정확히 따름
- **Wall-time 영향 수치화** — "3배 느림" 같은 구체 숫자는 왜 중요한지 Claude 에게 각인

---

## blockedBy 규약 — 병렬 가능 vs 의존 체인

워커를 spawn 할 때 **TaskCreate 의 `blockedBy` 필드**로 의존성 명시:

| 워커 상태 | blockedBy 값 | 의미 |
|---|---|---|
| 독립 실행 가능 | `[]` 또는 미지정 | 즉시 시작. 다른 모든 independent 워커와 병렬 실행 |
| 선행 의존 있음 | `[task-id-1, task-id-2]` | 명시된 task 완료 후에만 시작 |

**병렬 가능 vs 체인 판단 기준**:
- **입력이 독립적** (서로의 결과를 참조하지 않음) → 병렬
- **A 의 출력이 B 의 입력** → 체인 (blockedBy 설정)

### 예시 — plan Phase 1 (모두 병렬)

```
structure-explorer   → blockedBy: []  (프로젝트 구조 탐색, 독립)
dependency-explorer  → blockedBy: []  (의존성 분석, 독립)
pattern-explorer     → blockedBy: []  (패턴 수집, 독립)
domain-explorer      → blockedBy: []  (도메인 탐색, 독립)
reader (merge)       → blockedBy: [structure, dependency, pattern, domain]
```

→ explorer 4 개 전부 병렬, reader 만 대기.

### 예시 — implement Phase 4 (하이브리드)

```
# 병렬 가능 (blockedBy: [])
scaffolder          → blockedBy: []
test-writer         → blockedBy: []  (acceptance criteria 만 필요, 구현 결과 불필요 — TDD 전략)
security-checker    → blockedBy: []  (정적 분석, 독립)
ui-checker          → blockedBy: []  (UI 코드 정적 리뷰, 독립)

# 체인 (선행 필요)
implementer         → blockedBy: [scaffolder]           (디렉터리 구조 먼저)
integrator          → blockedBy: [implementer]          (구현 후 통합)
test-runner         → blockedBy: [implementer, test-writer]  (구현 + 테스트 모두 완료)
build-checker       → blockedBy: [implementer]          (최종 빌드)
```

→ scaffolder / test-writer / security-checker / ui-checker 4 개 동시 시작. implementer 는 scaffolder 후. integrator → test-runner → build-checker 순차.

### 예시 — verify Phase 7 (거의 전부 병렬)

```
# 모든 auditor 병렬 (blockedBy: [])
arch-auditor, code-reviewer, type-linter, deploy-validator
  + ux-reviewer (has_ui), design-reviewer (has_ui)
  + db-auditor (has_database), auth-auditor (has_auth)
  + supabase-security-gate (supabase)
  + seo-verifier (!is_internal_service), security-auditor (has_security_surface)
  + domain-{id}-auditor (각 활성 도메인)

# 유일한 체인
reader (aggregate) → blockedBy: [모든 auditor]
```

→ 최대 14 auditor 가 동시 실행. reader 만 대기.

---

## 런타임 제약 / Runtime Constraints

### Claude Code 의 parallel tool-use 제약

- **최대 tool calls per message**: 모델/플랜마다 다름. 일반적으로 **10-15 개까지 안전**. 20 초과 시 rate limit / 응답 truncation 위험
- **Rate limit**: subscription / API 플랜에 따라 분당 토큰 제한. 병렬 10 개 Agent 동시 실행은 각자 30k 토큰 상황에서 300k TPM 소비 가능
- **Token 누적**: 병렬 = wall-time 감소, token 총량은 같음 (약간 증가 가능 — context 중복)
- **개별 Agent timeout**: 각 Agent 는 독립 timeout. 하나만 실패해도 나머지는 완료됨

### Fallback — parallel 실패 시

Phase 7 에서 10+ auditor 를 한 번에 spawn 하다 rate limit 에 걸리는 경우:

1. **자동 batch 전환**: `project-config.yaml.pipeline.parallel_batch_size` (기본 8) 만큼씩 나눠 병렬 실행. batch 간은 순차
2. **순차 fallback**: `project-config.yaml.pipeline.parallel_enabled: false` 설정 시 모든 phase 가 강제 순차. 디버깅 / rate-limited 환경용

### 설정 필드

```yaml
# project-config.yaml
pipeline:
  parallel:
    enabled: true              # false 면 모든 phase 강제 순차
    max_per_message: 8         # 단일 message 내 동시 tool calls (Phase 7 batch 크기)
    fallback_on_rate_limit: "batch_split"  # "batch_split" | "sequential"
```

---

## Reader 워커 — Fan-in 표준

Fan-out 으로 여러 워커가 결과를 낸 뒤, **reader 워커가 병합**. reader 는 항상:

1. **blockedBy 에 모든 fan-out 워커 포함** — 전부 완료 후 시작
2. **입력 최소화** — 각 워커의 notepad/JSON 결과만 읽음 (직접 tool 호출 X)
3. **merge 로직 순수** — 중복 제거 / 우선순위 정렬 / 충돌 감지 / 요약 생성
4. **출력 구조화** — phase 의 공식 결과 파일 (`state/results/{phase}.json`) 에 기록
5. **에러 내성** — fan-out 중 일부 실패 시 "partial: true" 플래그 + 사용 가능한 결과로 진행

### reader 가 쓰는 TaskGet 패턴

```js
// reader 워커 내부 로직 (Claude 가 해석):
const fanOutTasks = [
  "structure-explorer-{task-id}",
  "dependency-explorer-{task-id}",
  "pattern-explorer-{task-id}"
];

// blockedBy 로 이미 대기했지만 각 결과 접근:
for (const taskId of fanOutTasks) {
  const result = TaskGet({ taskId });  // 완료된 결과 읽기
  merge(result);
}

writeNotepad("project-plan-phase1-merged", mergedResult);
writeStateResult("state/results/plan.json", { exploration: mergedResult });
```

`TaskGet` 은 이미 완료된 결과를 읽는 것이므로 blocking 아님. reader 자체는 단일 tool call.

---

## 체크리스트 — 각 phase SKILL.md 에 반드시 포함되어야 할 것

- [ ] **PARALLEL REQUIRED** 명시 (phase 설명 최상단)
- [ ] **올바른 형태 코드 예시** (single message with multiple Task calls)
- [ ] **금지된 순차 형태 예시** (대비로 명확화)
- [ ] **blockedBy 값** 각 워커마다 명시
- [ ] **reader 워커** 역할 / blockedBy 의존성 정의
- [ ] **wall-time 비교 수치** ("N배 느림" 같은)

이 6개가 갖춰지지 않으면 해당 phase 는 **DESIGN-ONLY 병렬** (Claude 판단에 의존) 이 되어 실제 parallel 보장 불가.

---

## Phase 별 적용 현황 (이번 PR 기준)

| Phase | 위치 | PARALLEL REQUIRED 적용 |
|---|---|---|
| Phase 1 team-plan | `plan.md` | ✅ (본 PR) |
| Phase 2 team-prd | `plan.md` | ✅ (본 PR) |
| Phase 2.5 codebase-analysis fan-out | `codebase-analysis.md` | ✅ (본 PR) |
| Phase 4 team-exec (하이브리드) | `implement.md` | ✅ (본 PR — blockedBy 명시) |
| Phase 7 team-verify | `verify.md` | ✅ (본 PR) |
| Cross-phase (plan + visual-qa 동시) | `orchestrator.md` | ❌ (설계상 SERIAL — 각 phase 이전 결과 의존) |

---

## 관련 참조

- `progress-format.md` §"Phase 1 진행 중 (팀 모드)" — 워커 트리 표시 (병렬 진행 중 시각화)
- `plan.md` §Reader Pattern — Phase 1/2 fan-out 실행 방식
- `verify.md` §Failure Tiers — auditor 별 결과 tier 기록
- `schemas.md` — phase 결과 JSON 계약
- `handoff-templates.md` — phase 간 handoff 파일 (reader 결과 작성)
- `guide-injection.md` — 워커 역할 → 가이드 매핑
- Claude Code docs (external): `https://docs.claude.com/en/docs/claude-code/agent-tool` — Agent/Task tool 병렬 호출 원리
