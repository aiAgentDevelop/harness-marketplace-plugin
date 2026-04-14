# 진행률 표시 형식 (Progress Format)

project-harness 오케스트레이터 및 각 하위 스킬(project-plan, project-implement, project-visual-qa, project-verify, project-debug)의 진행률 출력 형식 정의. **모든 스킬은 이 형식을 따라 일관된 진행률을 표시**한다.

이 파일은 wizard 가 프로젝트의 `.claude/skills/project-harness/references/progress-format.md` 로 복사하며, 각 phase SKILL.md 가 참조한다.

---

## project-harness 전체 파이프라인 진행률

```
⚙️ Project Harness Pipeline
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 0: 분류        ✅ feature | has_ui | has_database
Phase 1: 분석        ✅ 파일 12개 | 영향 3 레이어
Phase 2: 설계        ✅ 생성 3 | 수정 2
Phase 3: 확인        ✅ 사용자 승인
Phase 3.5: 디버그    ⏭️ (type != bugfix)
Phase 4: 구현        🔄 Step 2/5
Phase 5: 테스트      ⏳
Phase 6: 시각 QA     ⏳
Phase 7: 검증        ⏳
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 상태 아이콘 (표준)

| 아이콘 | 상태 | 의미 |
|--------|------|------|
| ✅ | 완료 | 해당 phase/step 성공적 종료 |
| 🔄 | 진행 중 | 현재 실행 중 |
| ⏳ | 대기 | 앞 phase 완료 후 실행 예정 |
| ❌ | 실패 | 오류 또는 차단 발생 |
| ⏭️ | 건너뜀 | 조건 미충족으로 skip (괄호로 이유 표시) |
| 🔧 | 자동 수정 중 | 자동 수정 루프 실행 중 |
| ⚠️ | 경고 | 실패는 아니지만 주의 필요 |

---

## project-plan 진행률

```
📋 project-plan
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 0: 분류        🔄 키워드 분석 중
Phase 1: 분석        ⏳
Phase 2: 설계        ⏳
Phase 3: 확인        ⏳
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Phase 0 완료 시 (classification 출력 — templates/classification.md 와 일치)

```
Phase 0: 분류        ✅ feature | has_ui: true | has_database: true | has_auth: false
```

### Phase 1 진행 중 (team 모드, fixed 워커 3개)

```
Phase 1: 분석        🔄 team-plan (3/3 워커 완료 대기)
   ├─ structure-explorer    ✅
   ├─ dependency-explorer   🔄
   └─ pattern-explorer      ✅
```

### Phase 1 진행 중 (도메인 워커 1개 추가됨)

```
Phase 1: 분석        🔄 team-plan (4/4 워커 완료 대기)
   ├─ structure-explorer       ✅
   ├─ dependency-explorer      🔄
   ├─ pattern-explorer         ✅
   └─ auth-explorer            ✅
```

### Phase 2 진행 중 (team 모드)

```
Phase 2: 설계        🔄 team-prd (2/2 워커 완료 대기)
   ├─ architect       🔄
   └─ ui-designer     🔄
```

### Phase 3 대기 중 (사용자 승인 대기)

```
Phase 3: 확인        🔄 사용자 입력 대기 중...
```

---

## project-implement 진행률

```
🔨 project-implement
━━━━━━━━━━━━━━━━━━━━━━━━━━━
유형: feature | 팀: {{TEAM_NAME}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 0: 가이드 로드          ✅
Step 1: 스캐폴드             ✅ 3개 파일 생성
Step 2: 구현                 🔄 테스트 3/5 통과
Step 3: 통합 코드            ⏳
Step 3.5: UI 자가 검증       ⏳ (has_ui: true 시)
Step 4: 도메인 검사          ⏭️ (도메인: none)
Step 5: 빌드 게이트          ⏳
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### team 모드 워커 진행률

```
🔨 project-implement (team-exec)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
유형: feature | 팀: {{TEAM_NAME}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
scaffolder        ✅ 3개 파일 생성
implementer       🔄 TDD 실행 중
ui-checker        ⏳ (has_ui: true)
integrator        ⏳
domain-reviewer   ⏭️ (도메인: none)
security-checker  ⏭️ (has_database: false)
test-writer       ⏳
test-runner       ⏳
build-checker     ⏳
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### bugfix 유형

```
🔨 project-implement
━━━━━━━━━━━━━━━━━━━━━━━━━━━
유형: bugfix
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 1: 재현 테스트 작성     ✅ 1개 실패 테스트
Step 2: 버그 수정            🔄
Step 3: 통과 확인            ⏳
Step 4: 도메인 검사          ⏭️
Step 5: 빌드 게이트          ⏳
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### refactor 유형

```
🔨 project-implement
━━━━━━━━━━━━━━━━━━━━━━━━━━━
유형: refactor
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 1: 리팩토링 파이프라인   🔄 Phase 2/3
Step 2: 파일 분할            ⏳
Step 3: 도메인 검사          ⏭️
Step 4: 빌드 게이트          ⏳
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### config 유형

```
🔨 project-implement
━━━━━━━━━━━━━━━━━━━━━━━━━━━
유형: config
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 1: 설정 수정            ✅ 2개 파일
Step 2: 빌드 검증            🔄 typecheck 실행 중
Step 3: 도메인 검사          ⏭️
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 빌드 게이트 자동 수정 루프 (최대 5회)

```
Step 5: 빌드 게이트          🔄 자동 수정 (2/5회)
   ├─ typecheck: ❌ 3 errors
   ├─ 수정 시도: src/features/profile/ui/ProfileCard.tsx
   └─ 재실행 중...
```

---

## project-visual-qa 진행률

```
🖥️ project-visual-qa
━━━━━━━━━━━━━━━━━━━━━━━━━━━
대상: /dashboard, /profile
━━━━━━━━━━━━━━━━━━━━━━━━━━━
빌드 검증       ✅
dev 서버        ✅ localhost:3000
/dashboard      🔄 검사 중...
  ├─ overflow    ✅ 0건
  ├─ alignment   🔄
  ├─ spacing     ⏳
  ├─ text-clip   ⏳
  ├─ z-index     ⏳
  ├─ responsive  ⏳
  └─ a11y        ⏳
/profile        ⏳
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 자동 수정 발생 시

```
/dashboard      🔄 자동 수정 중 (1/3회)
  ├─ overflow    ✅ 0건
  ├─ alignment   ❌ → 🔧 수정 중 (1건)
  ├─ spacing     ✅ 0건
  ├─ text-clip   ✅ 0건
  ├─ z-index     ✅ 0건
  ├─ responsive  ✅ 3 breakpoints
  └─ a11y        ✅ 0건
```

### 완료 시

```
🖥️ project-visual-qa 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/dashboard  ✅ overflow 0 | alignment 0 | spacing 0 | text-clip 0
/profile    ✅ overflow 0 | alignment 1→0 (자동수정) | spacing 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━
총 자동 수정: 1건
결과: pass_with_fixes
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## project-verify 진행률

```
🔍 project-verify
━━━━━━━━━━━━━━━━━━━━━━━━━━━
모드: team-verify | 워커: 6/6 스폰
━━━━━━━━━━━━━━━━━━━━━━━━━━━
arch-auditor       🔄 아키텍처 감사 중
code-reviewer      🔄 AI 리뷰 중
type-linter        ✅ typecheck ✅ | lint ✅
deploy-validator   🔄 배포 영향 분석 중
ux-reviewer        ✅ overflow 0 | spacing 0 | alignment 0
design-reviewer    🔄 디자인 토큰 검증 중
db-auditor         ⏭️ (has_database: false)
seo-verifier       ⏭️ (is_internal_service: true)
security-auditor   ⏭️ (has_security_surface: false)
domain-auditor     ⏭️ (domain: none)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 도메인 감사 포함 시 (예: 게임)

```
domain-auditor     🔄
  ├─ game-economy-auditor     ✅ 15/15 통과
  ├─ gs-gacha-compliance      🔄 확률 검증 중
  └─ gs-integrity-auditor     🔄 서버 권한 감사 중
```

### 완료 시 (failure tier 구분 반영 — templates/verify.md §Failure Tiers 참조)

```
🔍 project-verify 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━
arch-audit:        ✅ BLOCK 0 | ⚠️ WARN 2 | ℹ️ INFO 1
code-review:       ✅ BLOCK 0 | ⚠️ WARN 1
typecheck:         ✅ 에러 0
lint:              ✅ 통과
deploy:            ✅ Frontend ✅ | DB ⏭️ | Edge ⏭️
ux-review:         ✅ overflow 0 | spacing 0 | alignment 0
design-review:     ✅ 85/100 (BLOCK 0 | ⚠️ WARN 2)
db-audit:          ⏭️
seo-block:         ⏭️
security-check:    ⏭️
domain-audit:      ⏭️
━━━━━━━━━━━━━━━━━━━━━━━━━━━
종합: ✅ pass
회귀 필요: false
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 회귀 루프 발생 시 (최대 2회)

```
🔍 project-verify — 회귀 루프 (1/2회)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
실패 항목: arch-audit BLOCK 1
원인: FSD 레이어 위반 (features → widgets 직접 import)
수정: team-fix 워커 스폰 → arch-fix 실행
상태: 🔄 수정 후 재검증 중...
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## project-debug 진행률 (bugfix 유형 전용)

```
🐛 project-debug
━━━━━━━━━━━━━━━━━━━━━━━━━━━
복잡도: high | 재현 가능: true
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 1: 재현               ✅ 로컬 재현 성공
Step 2: 가설 수립          🔄 2개 가설 중 1개 검증 중
Step 3: 근본 원인 조사     ⏳
Step 4: 증거 수집          ⏳
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 3 진행 중 (여러 가설 병렬 검증)

```
Step 3: 근본 원인 조사     🔄
  ├─ 가설 A: race condition      ❌ 기각 (재현 불가)
  ├─ 가설 B: stale cache         🔄 검증 중
  └─ 가설 C: N+1 쿼리            ✅ 확정 (로그 증거 수집됨)
```

---

## 공통 규칙

1. **진행률은 실시간 갱신** — 각 Step/워커 완료 시 즉시 업데이트
2. **조건부 항목은 명시** — `⏭️ (조건)` 형식으로 건너뛴 이유 표시
3. **에러 시 상세 표시** — 실패 원인과 자동 수정 시도 횟수 포함
4. **팀/단일 모드 구분** — 팀 모드는 워커 목록, 단일 모드는 Step 목록
5. **도메인 감사는 하위 트리** — 복수 도메인 시 각각 하위 항목으로 표시
6. **구분선 일관성** — `━━━━━━━━━━━━━━━━━━━━━━━━━━━` (27자) 로 통일
7. **Phase N/M 카운터** — 전체 파이프라인은 Phase 0~7, sub-skill 내부는 Step 1~N 으로 표기

---

## 관련 참조 파일

- `classification.md` — Phase 0 분류 출력 포맷 세부 규칙
- `handoff-templates.md` — phase 간 handoff 파일 구조
- `schemas.md` — PlanResult / ImplementationResult / VerificationResult JSON 스키마
- `guide-injection.md` — 워커 → 가이드 매핑
- `verify.md` §Failure Tiers — BLOCK / WARN / INFO 구분 기준
