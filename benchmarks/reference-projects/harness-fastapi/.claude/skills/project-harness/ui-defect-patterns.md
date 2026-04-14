# UI Defect Patterns — 정적 코드 리뷰 체크리스트

프론트엔드 UI 구현 시 자주 발생하는 **8가지 결함 패턴** 과 각 수정법. `project-implement` Phase 4 의 ui-checker 워커 + `project-verify` Phase 7 의 ux-reviewer 워커가 주입받아 사용.

참조: `visual-qa.md` (런타임 DOM 측정 — 보완 관계), `guide-injection.md` (워커 주입 매핑), `progress-format.md` (진행 표시).

**관계**: visual-qa.md 는 실제 브라우저에서 DOM 측정(runtime), ui-defect-patterns.md 는 **소스 코드 수준의 정적 리뷰** (static). 두 방식은 보완적으로 함께 사용.

---

## 활성화 조건

`project-config.yaml.flags.has_ui == true` 시 wizard Step 5.2 가 이 파일을 `.claude/skills/project-harness/references/ui-defect-patterns.md` 로 복사. `guide-injection.md` 의 워커→가이드 매핑 테이블에 포함되어 ui-checker / ux-reviewer / ui-designer 워커가 자동 로드.

---

## 8가지 UI Defect 체크리스트

구현 중 / 후 반드시 확인:

```
□ 1. overflow — 텍스트/요소가 부모 컨테이너 밖으로 나가지 않는가?
□ 2. truncate — 긴 텍스트에 text-overflow 처리가 있는가?
□ 3. min-w-0 — flex 자식 요소에 min-w-0 적용? (flex shrink 이슈 방지)
□ 4. spacing — 인접 요소 간 gap 이 4px/8px 배수로 일관적인가?
□ 5. vertical-align — 같은 행의 요소들이 세로 중앙 정렬되어 있는가?
□ 6. responsive — 다양한 너비에서 레이아웃이 깨지지 않는가?
□ 7. padding-consistency — 카드/섹션 내부 padding 이 일관적인가?
□ 8. border-radius — 디자인 시스템 토큰(rounded-sm/md/lg/xl)을 준수하는가?
```

---

## 패턴별 수정법

### 1. overflow — Flex 내부 텍스트 삐져나감

**결함**:
```tsx
<div className="flex">
  <span>{longText}</span>  {/* 부모 밖으로 삐져나감 */}
</div>
```

**수정**:
```tsx
<div className="flex min-w-0">
  <span className="truncate">{longText}</span>
</div>
```

**원리**: flex 자식은 기본적으로 `min-width: auto` (콘텐츠 크기). 텍스트가 크면 flex container 를 밀어낸다. `min-w-0` + `truncate` 조합으로 해결.

---

### 2. truncate — 긴 텍스트 처리 누락

**결함**:
```tsx
<div className="w-48">
  <p>{veryLongString}</p>  {/* 줄바꿈 무한 또는 오버플로 */}
</div>
```

**수정** (단일 줄):
```tsx
<div className="w-48">
  <p className="truncate">{veryLongString}</p>
</div>
```

**수정** (다중 줄 — N줄 후 ...):
```tsx
<div className="w-48">
  <p className="line-clamp-2">{veryLongString}</p>
</div>
```

---

### 3. min-w-0 — flex 자식 shrink 이슈

**결함**:
```tsx
<div className="flex gap-2">
  <div className="flex-1">
    <input className="w-full" />  {/* 실제로 축소 안됨 */}
  </div>
  <button>Submit</button>
</div>
```

**수정**:
```tsx
<div className="flex gap-2">
  <div className="flex-1 min-w-0">  {/* min-w-0 추가 */}
    <input className="w-full" />
  </div>
  <button>Submit</button>
</div>
```

**원리**: flex item 의 기본 `min-width: auto` 가 `flex-1` 의 shrink 를 무력화. `min-w-0` 으로 override.

---

### 4. spacing — 불일치한 gap

**결함**:
```tsx
<div className="flex flex-col gap-3">
  <Card />
  <Card />
</div>
<div className="flex flex-col gap-5">  {/* 다른 섹션인데 gap 다름 */}
  <Card />
  <Card />
</div>
```

**수정** (디자인 토큰 일관):
```tsx
<div className="flex flex-col gap-4">  {/* 16px 표준 */}
  <Card />
  <Card />
</div>
<div className="flex flex-col gap-4">
  <Card />
  <Card />
</div>
```

**Tailwind 권장**:
- 컴포넌트 내부 요소 간: `gap-1` (4px) / `gap-2` (8px) / `gap-3` (12px)
- 관련 카드/섹션 간: `gap-4` (16px) / `gap-6` (24px)
- 큰 섹션 구분: `gap-8` (32px) / `gap-12` (48px)

---

### 5. vertical-align — 아이콘 + 텍스트 정렬

**결함**:
```tsx
<div className="flex">
  <CheckIcon className="w-4 h-4" />
  <span>Verified</span>  {/* 아이콘과 텍스트 세로 정렬 안됨 */}
</div>
```

**수정**:
```tsx
<div className="flex items-center gap-1.5">  {/* items-center 추가 */}
  <CheckIcon className="w-4 h-4" />
  <span>Verified</span>
</div>
```

**일반 원칙**: flex container 에서 아이콘/텍스트 등 서로 다른 높이의 요소가 같은 행에 있으면 `items-center` 필수.

---

### 6. responsive — breakpoint 미대응

**결함**:
```tsx
<div className="grid grid-cols-4 gap-4">
  {cards.map(c => <Card key={c.id} {...c} />)}
</div>
```

모바일에서 4열 grid 는 카드가 너무 좁아짐.

**수정**:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {cards.map(c => <Card key={c.id} {...c} />)}
</div>
```

**breakpoint 표준** (Tailwind 기준):
- `sm` — 640px+
- `md` — 768px+
- `lg` — 1024px+
- `xl` — 1280px+

---

### 7. padding-consistency — 동일 레벨 컴포넌트 padding 다름

**결함**:
```tsx
<Card className="p-4">...</Card>
<Card className="p-6">...</Card>  {/* 같은 레벨인데 다른 padding */}
<Card className="px-3 py-5">...</Card>
```

**수정** (디자인 시스템 준수):
```tsx
<Card className="p-4">...</Card>
<Card className="p-4">...</Card>
<Card className="p-4">...</Card>
```

**컴포넌트 레벨별 표준**:
- Card / Modal inner: `p-4` (16px) or `p-6` (24px, 큰 카드)
- Button: `px-4 py-2` (medium) / `px-3 py-1.5` (small)
- Section wrapper: `px-6 py-8` or 디자인 토큰 수치

---

### 8. border-radius — 임의 값 대신 토큰

**결함**:
```tsx
<div className="rounded-[10px]">...</div>  {/* 임의 값 */}
<div className="rounded-lg">...</div>       {/* 토큰 */}
<div className="rounded-[8px]">...</div>    {/* 임의 값 */}
```

**수정** (토큰 일관):
```tsx
<div className="rounded-lg">...</div>
<div className="rounded-lg">...</div>
<div className="rounded-lg">...</div>
```

**Tailwind 표준**:
- `rounded-sm` — 2px
- `rounded` — 4px
- `rounded-md` — 6px
- `rounded-lg` — 8px
- `rounded-xl` — 12px
- `rounded-2xl` — 16px
- `rounded-full` — 완전 원형

**중첩 규칙**: 바깥 radius 가 안쪽 radius 보다 커야 자연스러움. `rounded-xl` 카드 안에 `rounded-lg` 버튼.

---

## ui-checker 워커 (Phase 4) 동작

ui-checker 는 implementer 가 끝낸 뒤 실행되며:

1. 변경된 `.tsx` / `.jsx` / `.vue` 파일 목록 획득 (git diff)
2. 각 파일을 읽어 위 8개 패턴 정적 검사 (Grep/Read 기반)
3. 결함 발견 시:
   - **명확한 수정** 가능 (min-w-0, items-center, truncate 누락 등) → **직접 Edit 로 수정**
   - **판단 필요** (padding 값, breakpoint 선택) → plan/handoff 에 제안 기록만, 수정은 implementer 에게 다음 사이클로 회부
4. `state/results/implement.json` 의 `workers.ui-checker` 필드에 수정 건수 기록

---

## ux-reviewer 워커 (Phase 7) 동작

verify phase 의 ux-reviewer 는 read-only 분석:

1. 전체 UI 코드 (변경분 + 영향 범위) 로드
2. 8개 패턴 체크 + 디자인 시스템 토큰 준수 여부 검증
3. 결과를 `VerificationResult.conditional_checks.ux_review` 에 기록:
   ```json
   {
     "ux_review": {
       "status": "pass|warn",
       "overflow": 0,
       "spacing_inconsistency": 2,
       "alignment": 0,
       "padding_inconsistency": 1,
       "border_radius_nonstandard": 0,
       "responsive_gaps": 0,
       "recommendations": [...]
     }
   }
   ```
4. `verify.md` §Failure Tiers 기준:
   - overflow / truncate / min-w-0 누락 → **BLOCK** (runtime 에서 확실히 깨짐)
   - spacing / padding / border-radius 불일치 → **WARN** (미학 문제)
   - responsive gap → **WARN**
   - vertical-align → **BLOCK** (명백한 버그)

---

## 디자인 시스템 토큰 준수

프로젝트에 design system 토큰이 정의된 경우 (e.g. `src/shared/ui/theme.ts`, `tailwind.config.ts`):

- **색상**: `text-primary` / `bg-surface-1` / `border-muted` 등 토큰 사용. `text-[#3366cc]` 같은 hardcoded hex 금지
- **spacing scale**: `gap-N` / `p-N` 토큰만. `p-[17px]` 같은 임의 수치 금지
- **radius**: `rounded-{sm|md|lg|xl|2xl}` 사용
- **shadow**: `shadow-{sm|md|lg|xl}` 사용. `shadow-[0_4px_6px_rgba(0,0,0,0.1)]` 금지
- **폰트 크기**: `text-{xs|sm|base|lg|xl|2xl}` 사용

ui-checker 가 위 규칙 위반 감지 시 WARN 으로 기록 (자동 수정 하지 않음 — 디자인 의도 파악 어려움).

---

## 출력 예시 / Example Output

ui-checker 완료 시 (progress-format.md §"project-implement 진행률" + ui-conventions.md §"V4. 완료 요약" 준수):

```
🔨 project-implement — ui-checker 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━
대상: 3 파일 (ProfileCard.tsx, UserBadge.tsx, LoginForm.tsx)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
자동 수정 / Auto-fixed (3건)
  - ProfileCard.tsx:45   min-w-0 추가
  - UserBadge.tsx:12     truncate 추가
  - LoginForm.tsx:38     items-center 추가

경고 / Warnings (2건)
  ⚠️ UserBadge.tsx:28   spacing 불일치 (gap-3 vs 주변 gap-4)
  ⚠️ LoginForm.tsx:52   border-radius hardcoded [10px] (rounded-lg 권장)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
종합: ✅ pass (자동 수정 3, WARN 2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 관련 참조 파일

- `visual-qa.md` — 런타임 DOM 측정 (보완 관계)
- `guide-injection.md` — ui-checker / ux-reviewer / ui-designer 워커 매핑
- `progress-format.md` — ui-checker 진행 표시 포맷
- `ui-conventions.md` — 완료 요약 포맷
- `verify.md` §Failure Tiers — BLOCK vs WARN 판정 기준
- (프로젝트별) `design-system.md` / `theme.ts` — 디자인 토큰 정의
