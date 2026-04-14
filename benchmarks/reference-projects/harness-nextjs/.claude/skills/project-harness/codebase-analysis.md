---
name: project-codebase-analysis
description: {{PROJECT_NAME}} 의 대규모 코드베이스를 병렬 Explore 에이전트로 분석. 아키텍처/디자인/의존성/변경 영향 4가지 type 지원. refactor 작업 전 자동 실행 또는 --analysis-first 플래그로 수동 호출.
---

# project-codebase-analysis (Phase 2.5)

## Overview

`/project-codebase-analysis --type {arch|design|deps|impact}` — 병렬 Explore 에이전트를 스폰하여 대규모 코드베이스를 빠르게 분석하고 구조화된 보고서 생성.

project-harness 파이프라인에서 **Phase 2.5** (Plan 완료 후, Implement 시작 전) 에 조건부 실행:

- **자동 트리거**: `project_type == "refactor"` AND `pipeline.codebase_analysis.auto_on_refactor == true`
- **수동 트리거**: `/project-harness --analysis-first "<task>"` 플래그
- **독립 실행**: `/project-codebase-analysis --type arch` 단독 호출 가능

실행 결과는 `state/results/codebase-analysis.json` (schemas.md 의 CodebaseAnalysisResult 형식) 에 저장되어 Phase 4 implement 워커에 handoff.

## Usage

```
/project-codebase-analysis --type arch                         — 아키텍처 분석 (전체)
/project-codebase-analysis --type design                       — 디자인 패턴 분석
/project-codebase-analysis --type deps                         — 의존성 분석
/project-codebase-analysis --type impact <file-or-module>      — 변경 영향 분석
/project-codebase-analysis --scope <path>                      — 특정 앱/모듈만
/project-codebase-analysis --quiet                             — 진행 로그 최소화
```

Phase 2.5 자동 실행 시 orchestrator 가 `--type impact <plan.files_to_modify>` 를 계산하여 호출.

---

## Analysis Types

### arch — 아키텍처 분석

대상: 전체 프로젝트 또는 `--scope` 로 지정된 서브디렉터리.

수집/평가 항목:
- {{CONDITION:fsd}}**FSD 레이어 준수** (app / pages / widgets / features / entities / shared) — 역방향 의존성 감지{{/CONDITION:fsd}}
- **모듈 결합도/응집도** — inter-module import 수, 공통 코드 사용률
- **의존성 방향** — acyclic 여부, 순환 의존성 목록
- **안티패턴** — god module, long file (>500 lines), deep nesting (>4 levels)
- **개선 권장사항** — 상위 3건

출력: `CodebaseAnalysisResult.arch` 섹션 (schemas.md 참조)

### design — 디자인 패턴 분석

수집/평가 항목:
- **컴포넌트 패턴** — Compound / Render Props / HOC / Hooks composition 사용 양상
- **상태 관리** — Zustand / Redux / Context / React Query 사용 패턴
- **API 통신** — TanStack Query / SWR / axios 직접 호출 혼용 여부
- **에러 처리** — Error Boundary / try-catch / throw 전파 패턴
- **재사용성** — shared util 사용률, 중복 구현 hot-spot

### deps — 의존성 분석

수집 항목:
- **Unused deps** — `package.json` 에 있으나 import 되지 않는 패키지
- **Duplicate deps** — 서로 다른 버전이 동시 사용되는 패키지
- **Security vulnerabilities** — `npm audit` / `pnpm audit` 실행 결과
- **Bundle impact** — 각 dep 의 번들 사이즈 기여 (추정)
- **Update candidates** — major 버전 뒤처진 패키지 목록

### impact — 변경 영향 분석

`--type impact <target>` — `<target>` 은 file 경로 또는 모듈 path. plan phase 에서 자동 계산된 `files_to_modify` 를 target 으로 사용.

수집 항목:
- **Direct importers** — target 을 직접 import 하는 파일 목록
- **Indirect dependency chain** — 2-hop 이상의 의존성 체인
- **Affected zones/apps** — monorepo 에서 영향받는 워크스페이스
- **Test coverage impact** — 영향 범위의 test coverage 부족 지점
- **Risk level** — low / medium / high (파일 수 + critical path 여부 기반)

---

## 실행 흐름 / Execution Flow

### Step 1: Context 수집

```
1. project-config.yaml 읽기 → platform / tech_stack / commands 확보
2. plan.json (state/results/plan.json) 읽기 → files_to_modify / task_type 확보 (Phase 2.5 자동 실행 시)
3. --type 파라미터 확인 (없으면 Phase 2.5 는 project_type 기반 자동 선택: refactor → impact + arch)
```

### Step 2: Fan-out — 병렬 Explore 에이전트 스폰

**PARALLEL REQUIRED**: type 별 3-4 개 explorer 를 **단일 메시지 내 복수 Task tool-use 블록으로 동시 spawn**. 순차 호출 금지 (3 explorer 기준 wall-time 3배 증가). 자세한 규약은 `references/parallel-execution.md`.

**arch 모드** — single message with 3 parallel Task calls:

```js
[
  Task({ subagent_type: "Explore",
         description: "arch-layer-explorer",
         prompt: "FSD 레이어 분석 — app/pages/widgets/features/entities/shared 간 의존성 방향. 역방향 import 목록 수집." }),
  Task({ subagent_type: "Explore",
         description: "arch-coupling-explorer",
         prompt: "모듈 결합도 — 각 모듈의 import 개수 + 공통 util 사용률 통계." }),
  Task({ subagent_type: "Explore",
         description: "arch-antipattern-explorer",
         prompt: "안티패턴 감지 — 500+ 라인 파일, 4+ nesting, duplicate logic hotspot." })
]
// 모든 Task: blockedBy: [] (독립 실행)
```

**design 모드**:
```
Agent 1: 컴포넌트 패턴 사용 양상
Agent 2: 상태 관리 도구 사용 패턴
Agent 3: API 통신 계층 패턴
```

**deps 모드** (Bash 도구 병렬):
```
Bash 1: npm ls --parseable --prod / pnpm list --depth=0
Bash 2: npm audit / pnpm audit
Bash 3: depcheck (if available)
Bash 4: bundle size estimation (optional)
```

**impact 모드**:
```
Agent 1: Direct importers — Grep (rg) 으로 target 을 import 하는 파일 수집
Agent 2: Indirect chain — 2-hop 의존성 graph
Agent 3: Test coverage 매핑 — 영향 범위와 test 파일 교차
```

### Step 3: Fan-in — Reader 워커로 결과 통합

별도 reader 워커 (plan.md §Reader Pattern 참조) 가 각 agent 결과를 받아:
1. 중복 findings 병합
2. 우선순위 판정 (🔴 High / 🟡 Medium / ⚪ Low)
3. `state/results/codebase-analysis.json` 으로 직렬화

### Step 4: 출력 / Report

`ui-conventions.md` §"V4. 완료 요약" 스키마 적용:

```
📊 project-codebase-analysis 완료 / complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━
type: arch | impact | design | deps
━━━━━━━━━━━━━━━━━━━━━━━━━━━
분석 범위 / Scope
  - 대상: <전체 또는 --scope 경로>
  - 파일 수: N개
  - 총 라인 수: N

분석 결과 / Findings
  - 🔴 High priority: N건
  - 🟡 Medium: N건
  - ⚪ Low: N건

핵심 발견사항 / Key findings (top 3)
  1. ...
  2. ...
  3. ...

권장 개선사항 / Recommendations
| 우선순위 | 항목 | 영향도 | 난이도 |
|---------|------|--------|--------|
| 🔴 High | ... | 큼 | 중 |
| 🟡 Medium | ... | 중 | 작 |

총 소요 시간: Xm Ys
━━━━━━━━━━━━━━━━━━━━━━━━━━━
종합: ✅ complete
다음 stage 입력: Phase 4 (implement) 에서 본 결과 참조
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Phase 2.5 자동 실행 조건 (orchestrator.md 연계)

orchestrator 는 다음 조건일 때 Phase 2.5 를 파이프라인에 삽입:

```
IF plan.classification.type == "refactor"
   AND project-config.yaml.pipeline.codebase_analysis.auto_on_refactor == true
THEN invoke /project-codebase-analysis --type impact <plan.files_to_modify>
ELIF --analysis-first flag present
THEN invoke /project-codebase-analysis --type arch
ELSE skip Phase 2.5
```

결과는 Phase 4 implement 의 handoff 에 포함되어 implementer 가 영향 범위 인지한 상태로 작업.

---

## 관련 참조 파일 / Related References

- `progress-format.md` — 진행 중 출력 (Fan-out 워커 트리)
- `ui-conventions.md` — 완료 요약 포맷
- `schemas.md` — CodebaseAnalysisResult JSON 스키마
- `handoff-templates.md` — Phase 2.5 → Phase 4 handoff (analysis.md 신규 항목 추가 필요)
- `plan.md` §Reader Pattern — Fan-in reader 워커 스펙 재사용
- `guide-injection.md` — Explore 에이전트 주입 guide (architecture-overview / dependency-analysis / pattern-conventions)

---

## 독립 실행 vs 파이프라인 통합

| 호출 방식 | 사용 시점 | 결과 저장 |
|---|---|---|
| `/project-codebase-analysis --type arch` 단독 | 정기 코드베이스 점검, PR 리뷰 전 | state/results/codebase-analysis.json (덮어쓰기) |
| Phase 2.5 자동 (refactor 시) | `/project-harness "refactor ..."` 실행 중 | 위와 동일 + handoff 에 요약 포함 |
| `--analysis-first` 플래그 | 새 기능 전 현황 파악이 필요한 경우 | 위와 동일 |

각 호출마다 JSON 결과가 overwrite 되지만, `state/analysis-history/{timestamp}.json` 으로 아카이브 (project-config.yaml.pipeline.codebase_analysis.archive_history=true 시).

---

## config 필드 / Configuration

```yaml
# project-config.yaml
pipeline:
  codebase_analysis:
    auto_on_refactor: true        # default. false 면 Phase 2.5 자동 실행 안 함
    default_type_for_phase_2_5: "impact"  # refactor 에서 기본 type
    archive_history: false        # true 면 state/analysis-history/ 에 누적
    parallel_explorer_count: 3    # fan-out 워커 수 (1-5)
    timeout_per_explorer_ms: 180000  # 각 워커 3분 제한
```
