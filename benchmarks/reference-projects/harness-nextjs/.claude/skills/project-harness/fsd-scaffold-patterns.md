# FSD Scaffold Patterns — 모듈 boilerplate 생성 규칙

Feature-Sliced Design (FSD) 아키텍처 프로젝트의 모듈 boilerplate 표준. `project-implement` Phase 4 의 scaffolder 워커가 `entity` / `feature` / `widget` 층에 모듈 생성 시 이 패턴을 따름.

참조: `guide-injection.md` (scaffolder 워커 주입), `progress-format.md` (scaffolder 진행 표시), 관련 guide: `architecture-overview.md` / `project-layout.md` (FSD 레이어 규칙).

---

## 활성화 조건

`project-config.yaml.tech_stack.architecture == "fsd"` 시 wizard Step 5.2 가 이 파일을 `.claude/skills/project-harness/references/fsd-scaffold-patterns.md` 로 복사. scaffolder 워커가 자동 로드.

---

## FSD 레이어 개요

```
app/        — 앱 진입점 (provider 조합, 라우팅)
pages/      — 페이지 단위 (라우트별 컴포넌트)
widgets/    — 독립적 UI 블록 (여러 feature 조합)
features/   — 사용자 시나리오 단위 기능
entities/   — 비즈니스 엔티티 (사용자 / 주문 / 상품)
shared/     — 범용 유틸 / UI / API / 타입
```

**의존성 방향**: 위→아래 (app 이 pages 를 알고, pages 는 widgets 을 알고, …). **역방향 import 금지** — entities 가 features 를 import 할 수 없음.

---

## Entity 스캐폴드

### 디렉터리 구조

```
src/entities/<name>/
├── model/
│   ├── types.ts           # 도메인 타입 정의
│   ├── store.ts           # Zustand 스토어 (선택)
│   ├── constants.ts       # 도메인 상수 (선택)
│   └── index.ts           # model public API
├── api/
│   ├── queries.ts         # TanStack Query 쿼리 훅
│   ├── mutations.ts       # TanStack Query 뮤테이션 훅
│   ├── schemas.ts         # Zod/valibot 스키마 (선택)
│   └── index.ts           # api public API
├── ui/
│   ├── <Name>Card.tsx     # 기본 UI 컴포넌트
│   ├── <Name>List.tsx     # 리스트 뷰 (선택)
│   └── index.ts           # ui public API
├── lib/
│   ├── helpers.ts         # 도메인 헬퍼 함수
│   ├── formatters.ts      # 포맷팅 함수 (선택)
│   └── index.ts           # lib public API
└── index.ts               # 모듈 public API (re-export hub)
```

### types.ts 템플릿

```typescript
/**
 * <Name> 도메인 타입
 */

export interface <Name> {
  id: string
  createdAt: Date
  updatedAt: Date
  // TODO: 도메인별 필드 추가
}

export interface Create<Name>Input {
  // TODO: 생성에 필요한 최소 필드만 정의
}

export interface Update<Name>Input {
  id: string
  // TODO: partial update 가능한 필드 (Pick + Partial 조합)
}

export interface <Name>ListFilters {
  search?: string
  sortBy?: keyof <Name>
  sortOrder?: 'asc' | 'desc'
}
```

### api/queries.ts 템플릿 (TanStack Query)

```typescript
import { useQuery } from '@tanstack/react-query'
import type { <Name>, <Name>ListFilters } from '../model'

export const <name>Keys = {
  all: ['<name>'] as const,
  lists: () => [...<name>Keys.all, 'list'] as const,
  list: (filters: <Name>ListFilters) => [...<name>Keys.lists(), filters] as const,
  details: () => [...<name>Keys.all, 'detail'] as const,
  detail: (id: string) => [...<name>Keys.details(), id] as const,
}

export function use<Name>List(filters: <Name>ListFilters = {}) {
  return useQuery({
    queryKey: <name>Keys.list(filters),
    queryFn: () => {
      // TODO: API 호출 (shared/api 의 client 사용)
      throw new Error('Not implemented')
    },
  })
}

export function use<Name>(id: string | undefined) {
  return useQuery({
    queryKey: <name>Keys.detail(id ?? ''),
    queryFn: () => {
      if (!id) throw new Error('id required')
      // TODO: 단건 조회
      throw new Error('Not implemented')
    },
    enabled: Boolean(id),
  })
}
```

### api/mutations.ts 템플릿

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { <Name>, Create<Name>Input, Update<Name>Input } from '../model'
import { <name>Keys } from './queries'

export function useCreate<Name>() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: Create<Name>Input): Promise<<Name>> => {
      // TODO: API 호출
      throw new Error('Not implemented')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: <name>Keys.lists() })
    },
  })
}

export function useUpdate<Name>() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: Update<Name>Input): Promise<<Name>> => {
      throw new Error('Not implemented')
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: <name>Keys.lists() })
      queryClient.setQueryData(<name>Keys.detail(updated.id), updated)
    },
  })
}

export function useDelete<Name>() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      throw new Error('Not implemented')
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: <name>Keys.lists() })
      queryClient.removeQueries({ queryKey: <name>Keys.detail(id) })
    },
  })
}
```

### model/store.ts 템플릿 (Zustand, 선택적)

```typescript
import { create } from 'zustand'
import type { <Name> } from './types'

interface <Name>Store {
  selected<Name>: <Name> | null
  select<Name>: (<name>: <Name> | null) => void
  clearSelected: () => void
}

export const use<Name>Store = create<<Name>Store>((set) => ({
  selected<Name>: null,
  select<Name>: (<name>) => set({ selected<Name>: <name> }),
  clearSelected: () => set({ selected<Name>: null }),
}))
```

### ui/<Name>Card.tsx 템플릿

```tsx
import type { <Name> } from '../model'

interface <Name>CardProps {
  <name>: <Name>
  onClick?: (id: string) => void
}

export function <Name>Card({ <name>, onClick }: <Name>CardProps) {
  return (
    <div
      className="rounded-lg border p-4 hover:bg-muted/50 cursor-pointer"
      onClick={() => onClick?.(<name>.id)}
    >
      {/* TODO: 필드별 UI */}
      <div className="text-sm text-muted-foreground">
        ID: {<name>.id}
      </div>
    </div>
  )
}
```

### index.ts 템플릿 (public API re-export hub)

```typescript
// src/entities/<name>/index.ts — 외부 레이어가 import 할 최소 surface

export type { <Name>, Create<Name>Input, Update<Name>Input, <Name>ListFilters } from './model'
export { use<Name>Store } from './model/store'
export { use<Name>List, use<Name>, <name>Keys } from './api'
export { useCreate<Name>, useUpdate<Name>, useDelete<Name> } from './api/mutations'
export { <Name>Card } from './ui'
```

**중요**: 다른 레이어는 `import { <Name>Card } from '@/entities/<name>'` 만 사용. `@/entities/<name>/ui/<Name>Card` 직접 import 금지 (encapsulation 유지).

---

## Feature 스캐폴드

### 디렉터리 구조

```
src/features/<name>/
├── model/
│   ├── types.ts           # feature 로컬 타입
│   ├── store.ts           # feature 상태 (선택)
│   └── index.ts
├── api/
│   ├── submit.ts          # feature 전용 API (mutation 위주)
│   └── index.ts
├── ui/
│   ├── <Name>Form.tsx     # 입력 폼 / 인터랙션 컴포넌트
│   ├── <Name>Trigger.tsx  # 버튼 / 링크 (feature 진입점, 선택)
│   └── index.ts
├── lib/
│   ├── validators.ts      # 입력 유효성 검사
│   └── index.ts
└── index.ts
```

### 차이점 (entity 와 비교)

- Feature 는 **사용자 액션/시나리오** 단위. entity 는 **데이터 모델** 단위
- Feature 는 entity 를 **import 가능** (e.g. `import { User } from '@/entities/user'`)
- Feature 의 API 는 **mutation 중심** (query 는 entity 에서). 예외: feature-specific search / filter
- Feature 에 store 가 있다면 UI state 용 (폼 상태, 모달 open 여부 등). 도메인 데이터는 entity store 로

### 예시 — `auth` feature

```
src/features/auth/
├── model/types.ts         # LoginFormValues, LoginError
├── api/login.ts           # useLogin mutation
├── ui/
│   ├── LoginForm.tsx      # 로그인 폼
│   └── LogoutButton.tsx   # 로그아웃 버튼
├── lib/validators.ts      # Zod schema
└── index.ts               # re-export
```

---

## Widget 스캐폴드

### 디렉터리 구조

```
src/widgets/<name>/
├── ui/
│   ├── <Name>Widget.tsx   # 조합형 UI 블록
│   └── index.ts
└── index.ts
```

### 차이점

- Widget 은 **여러 feature/entity 를 조합**하는 compound UI. 자체 비즈니스 로직 없음 (대부분 UI 만)
- feature/entity 를 **import 가능**. 하지만 다른 widget 은 import 금지 (widget 간 순환 방지)
- API 호출 자체는 feature/entity 에 위임. widget 은 render 와 user-event handling 만

### 예시 — `UserProfileWidget`

```tsx
// src/widgets/user-profile/ui/UserProfileWidget.tsx
import { use<User>, UserCard } from '@/entities/user'
import { EditProfileForm } from '@/features/edit-profile'

export function UserProfileWidget({ userId }: { userId: string }) {
  const { data: user, isLoading } = use<User>(userId)

  if (isLoading) return <Skeleton />
  if (!user) return <NotFound />

  return (
    <div className="space-y-4">
      <UserCard user={user} />
      <EditProfileForm userId={user.id} />
    </div>
  )
}
```

---

## Public API 규칙 (critical)

FSD 의 핵심: 각 모듈은 **`index.ts`** 를 통해서만 외부에 노출. 내부 파일 직접 import 금지.

### 올바른 import

```typescript
// 외부 레이어에서
import { UserCard, useUser } from '@/entities/user'         // ✅ public API
import { LoginForm } from '@/features/auth'                 // ✅
import { UserProfileWidget } from '@/widgets/user-profile'  // ✅
```

### 금지된 import

```typescript
import { UserCard } from '@/entities/user/ui/UserCard'             // ❌ 내부 직접 접근
import { use<User> } from '@/entities/user/api/queries'            // ❌
```

**이유**: internal 파일을 직접 import 하면 모듈 구조 refactor 가 어려워짐. Public API 만 유지하면 내부는 자유롭게 변경 가능.

**체크 도구**: ESLint `boundaries` 플러그인 또는 TypeScript path alias 설정으로 강제. wizard 가 설정한 `.eslintrc` / `tsconfig.json` 에 이미 rule 포함되어 있을 수 있음.

---

## scaffolder 워커 동작

scaffolder 가 이 reference 파일 로드 후:

1. plan phase 에서 전달된 `design.files_to_create` 목록 분석
2. 각 파일 경로가 `src/entities/` / `src/features/` / `src/widgets/` 중 어느 레이어에 속하는지 판정
3. 해당 레이어 디렉터리 구조 전체 생성 (위 템플릿 기반)
4. 내부 파일들에 `TODO:` 주석 포함한 minimal boilerplate 작성
5. `index.ts` re-export hub 자동 생성
6. 완료 시 notepad `project-implement-scaffold-result` 에 생성 파일 목록 기록

### 출력 예시

```
🔨 project-implement — scaffolder (FSD) 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━
레이어 / Layer: entity
이름 / Name: user
━━━━━━━━━━━━━━━━━━━━━━━━━━━
생성 / Created (8 files)
  ✅ src/entities/user/model/types.ts
  ✅ src/entities/user/model/index.ts
  ✅ src/entities/user/api/queries.ts
  ✅ src/entities/user/api/mutations.ts
  ✅ src/entities/user/api/index.ts
  ✅ src/entities/user/ui/UserCard.tsx
  ✅ src/entities/user/ui/index.ts
  ✅ src/entities/user/index.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━
다음 단계: implementer 가 TODO 주석을 실제 로직으로 치환
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 관련 참조 파일

- `architecture-overview.md` / `architecture-rules.md` — FSD 의존성 방향 규칙
- `project-layout.md` — 디렉터리 구조 일반 규칙
- `guide-injection.md` — scaffolder 워커의 가이드 주입 매핑
- `progress-format.md` — scaffolder 진행 표시
- `ui-defect-patterns.md` — 생성된 UI 컴포넌트 레이아웃 검증
- (선택적) `module-scaffold` 스킬 — 독립 실행 `/project-module-scaffold fsd <layer> <name>` 형태
