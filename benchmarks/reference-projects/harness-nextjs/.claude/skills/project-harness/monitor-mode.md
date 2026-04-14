# Monitor Mode — Idle Auto-Watch (CronCreate 기반)

`project-harness monitor` 서브커맨드의 동작 명세.
**REPL idle 상태에서도 주기적으로 에러를 자동 감지**하는 백그라운드 감시 루프를 CronCreate 로 설정한다.

이 파일은 wizard 가 `.claude/skills/project-harness/references/monitor-mode.md` 로 복사. orchestrator.md 가 짧게 링크만 하고 상세는 여기 유지 (orchestrator 가 500줄 초과 방지).

참조: `progress-format.md` (출력 포맷), `ui-conventions.md` (3-옵션 게이트), `schemas.md` (error event shape)

---

## 개요

### 왜 CronCreate 인가

`/loop` 는 Claude 가 명시적으로 idle → active 전환해야 실행됨. 반면 `CronCreate(recurring=true)` 는 OS/세션 스케줄러 수준에서 주기 실행되므로 Claude 가 다른 작업 중이어도 독립적으로 발동.

게임/앱 개발 중 REPL 에서 설계/구현 작업을 하면서 **동시에 백엔드 로그와 프론트엔드 console 을 자동 감시** 하려면 CronCreate 가 필수.

### 사용법

```
/project-harness monitor                      — 프론트엔드 + 백엔드 동시 감시 (기본)
/project-harness monitor --backend            — 백엔드만 (프로세스 로그 + health check)
/project-harness monitor --frontend           — 프론트엔드만 (chrome-devtools MCP)
/project-harness monitor --interval 2m        — 감시 간격 변경 (기본 1분, 최소 1분)
/project-harness monitor stop                 — CronDelete + 서버 종료
```

---

## Backend Monitor (`--backend`)

백엔드 서버 로그 + 헬스 체크 기반 감시. 프레임워크 (NestJS / Express / FastAPI / Spring / Django) 불문.

### 기술 스택

| 구성요소 | 도구 | 역할 |
|---------|------|------|
| 서버 실행 | `Bash(run_in_background)` + 프로젝트의 dev 명령 | 백그라운드 실행 + 로그 캡처 |
| 자동 루프 | `CronCreate(*/1 * * * *)` | 매 1분 체크 (idle 시에도 실행) |
| 로그 감시 | `tail + grep` | 에러 패턴 탐지 |
| 헬스 체크 | `curl localhost:{port}/health` | 서버 생존 + DB 연결 확인 |
| 자동 재빌드 | 프레임워크 watch 옵션 | 코드 수정 시 자동 재컴파일 |

### Step 1: 서버 시작

```
1. npx kill-port {port} (기존 프로세스 정리)
2. Bash(run_in_background): <project-config.yaml.commands.dev>
   → stdout/stderr 임시 파일로 캡처 (LOG_FILE 경로 저장)
3. sleep 5 → 서버 기동 확인 (framework-specific ready 패턴)
4. 초기 라인 카운트 기록 (last_line_count)
```

### Step 2: CronCreate 감시 루프

```
CronCreate:
  cron: "*/1 * * * *"    (매 1분)
  recurring: true
  prompt: |
    백엔드 모니터링 체크:
    1. LOG_FILE 의 새 줄을 tail 로 추출 (last_line_count 이후)
    2. grep -iE "error|exception|FATAL|crash|TypeError|ReferenceError|500"
       제외: WARN|Found 0 errors|DeprecationWarning|401|404 (참고성 패턴)
    3. curl -s localhost:{port}/health 로 생존/DB 확인
    4. 에러 발견 시 → 즉시 보고 + 원인 분석 + 수정 여부 질문 (3-옵션)
    5. 에러 없으면 → 무음 (무출력, REPL 방해 최소화)
```

### Step 3: 에러 감지 시 사용자 출력 (progress-format.md + ui-conventions.md 조합)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 [BACKEND] 서버 에러 자동 감지 / Server error detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━
시각 / Time: HH:MM:SS
유형 / Type: RuntimeError | DatabaseError | CrashError
에러 / Message: <요약>
파일 / Location: <스택 트레이스 top frame — file:line>
상세 / Details: <핵심 3줄>
━━━━━━━━━━━━━━━━━━━━━━━━━━━

AskUserQuestion (ui-conventions.md 3-option 표준):
  [수정 / Fix]     — 원인 분석 + 즉시 수정 + watch 재컴파일 대기 + 감시 재개
  [무시 / Ignore]  — 감시 계속 (같은 에러 5분 내 재발생 시 재보고)
  [중단 / Stop]    — CronDelete + 서버 종료
```

---

## Frontend Monitor (`--frontend`)

chrome-devtools MCP 기반 브라우저 자동 감시. `visual_qa_capable: true` 일 때만 유효 (Unity / Unreal / native 앱 에선 skip + 경고).

### 기술 스택

| 구성요소 | 도구 | 역할 |
|---------|------|------|
| 브라우저 연결 | `mcp__plugin_chrome-devtools-mcp__list_pages` | 활성 페이지 탐지 |
| 페이지 선택 | `mcp__plugin_chrome-devtools-mcp__select_page` | 대상 페이지 선택 |
| 자동 루프 | `CronCreate(*/1 * * * *)` | 매 1분 체크 |
| 콘솔 감시 | `mcp__plugin_chrome-devtools-mcp__list_console_messages` | 에러/경고 수집 |
| 네트워크 감시 | `mcp__plugin_chrome-devtools-mcp__list_network_requests` | 실패 HTTP 요청 탐지 |
| 스크린샷 | `mcp__plugin_chrome-devtools-mcp__take_screenshot` | 에러 발생 시 화면 캡처 |

### Step 1: 브라우저 연결

```
1. list_pages → 활성 페이지 목록 (dev server URL 매칭)
2. select_page → 대상 페이지 선택 (없으면 사용자에게 URL 입력 요청)
```

### Step 2: CronCreate 감시 루프

```
CronCreate:
  cron: "*/1 * * * *"
  recurring: true
  prompt: |
    프론트엔드 브라우저 모니터링 체크:
    1. list_console_messages → severity === "error" 필터
       제외: favicon.ico 404, HMR websocket 관련 메시지
    2. list_network_requests → status >= 500 또는 failed 필터
       제외: favicon.ico, __webpack_hmr, /_next/webpack-hmr
    3. 에러 발견 시: 보고 + take_screenshot + 수정 여부 질문
    4. 에러 없으면: 무음
```

### Step 3: 에러 감지 시 사용자 출력

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟡 [FRONTEND] 브라우저 에러 자동 감지 / Browser error detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━
시각 / Time: HH:MM:SS
유형 / Type: ConsoleError | NetworkError | ResourceError
페이지 / Page: <현재 URL>
에러 / Message: <요약>
상세 / Details: <콘솔 메시지 또는 실패 URL + status>
📸 스크린샷 / Screenshot: <path>
━━━━━━━━━━━━━━━━━━━━━━━━━━━

AskUserQuestion:
  [분석 / Analyze]  — 에러 원인 분석 + 수정 제안
  [무시 / Ignore]   — 감시 계속
  [중단 / Stop]     — CronDelete
```

---

## 동시 감시 (기본 `/project-harness monitor`)

Backend + Frontend CronCreate 2 개를 동시 설정:

```
/project-harness monitor
  ├─ CronCreate #1: Backend (*/1 * * * *, tail + grep + curl)
  └─ CronCreate #2: Frontend (*/1 * * * *, chrome-devtools)
```

### 에러 우선순위 / Error Priority

| 우선순위 | 조건 | 행동 |
|---------|------|------|
| 🔴 Critical | 서버 크래시, DB 다운 | 즉시 보고 + 자동 재시작 시도 (AskUserQuestion 먼저) |
| 🟠 High | 서버 500, JS 런타임 에러 | 즉시 보고 + 수정 여부 문의 |
| 🟡 Medium | API 400, 콘솔 warning 지속 | 누적 후 5분마다 요약 보고 |
| ⚪ Low | 네트워크 타임아웃, 리소스 404 | 로그만 기록, 보고 생략 |

---

## monitor stop

```
/project-harness monitor stop
  1. CronDelete(backend_job_id)
  2. CronDelete(frontend_job_id)  (있는 경우)
  3. npx kill-port {port} (서버 종료)
  4. 마지막 감시 통계 출력:
     - 총 감시 시간
     - 발견 에러 건수 (priority 별)
     - 수정된 에러 건수
```

---

## 제약 사항 / Constraints

- **CronCreate 최소 간격**: 1분 (cron 표현식 한계 `*/1`). 그 이하는 불가
- **세션 종료 시 크론 자동 소멸** — 세션 내 한정 실행. 세션 유지가 필요하면 별도 CI 프로세스 사용
- **7일 후 자동 만료** — recurring CronCreate 의 기본 정책
- **visual_qa_capable: false 프로젝트** — `--frontend` / 기본 `monitor` 시도 시 "이 프로젝트는 브라우저 기반 UI 가 아닙니다" 경고 후 `--backend` 로 자동 fallback
- **health endpoint 필수** — backend monitor 는 `/health` 엔드포인트 존재 가정. 없으면 wizard 설정 시 경고 + 사용자에게 만들도록 안내
- **로그 파일 크기 제한** — Bash(run_in_background) 의 임시 로그는 기본 10MB, 초과 시 로테이션

---

## 다른 모드와 조합

```
허용 / Allowed:
  /project-harness monitor                    — 독립 실행 (파이프라인 불필요)
  /project-harness monitor --backend          — 백엔드만
  /project-harness monitor --frontend         — 프론트엔드만
  /project-harness monitor 와 다른 harness 작업 동시 실행 OK
         (crawn 은 독립 실행, pipeline 은 별도 Claude 세션 행위)

불허 / Not allowed:
  /project-harness monitor "task"             — task 인자는 사용하지 않음
  /project-harness autopilot monitor          — autopilot 은 파이프라인 전용
```

---

## project-config.yaml 관련 필드

```yaml
pipeline:
  monitor:
    enabled: true              # false 면 monitor 서브커맨드 비활성
    default_interval: "1m"     # 기본 감시 간격
    backend_health_path: "/health"
    backend_dev_command: "{{project-config.yaml.commands.dev}}"
    frontend_visual_qa_capable: true  # chrome-devtools MCP 사용 가능 여부
    error_priority_rules:      # 에러 우선순위 커스터마이즈
      critical: ["EADDRINUSE", "MongoNetworkError", "ECONNREFUSED"]
      high: ["500", "TypeError", "ReferenceError"]
```

---

## 관련 참조 파일

- `progress-format.md` — 감시 중 출력 아이콘 및 구분선 규칙
- `ui-conventions.md` — 에러 감지 후 3-옵션 AskUserQuestion 표준
- `schemas.md` — monitor 이 수집한 error event 의 JSON 형식 (선택적 로깅)
- `orchestrator.md` — monitor 서브커맨드 진입점 및 링크

---

## Generic 패턴 (GP1, GP2) — 선택 적용

### GP1. System Grouping (Plan 단계)

game-harness 가 economy-group / progression-group / competitive-group 으로 시스템 그룹화하듯,
일반 프로젝트도 **5+ system** 을 가진 경우 그룹화해서 worker bloat 방지 가능.

- 예: e-commerce — auth + payment + inventory + reviews + search → "commerce-core-group"
- `plan.md` Phase 1 에 조건부 그룹화 로직 추가 필요 (`project-config.yaml.pipeline.system_grouping.enabled`)
- 현재는 opt-in — 기본 false

### GP2. Phase 3.5 API QA (Postman MCP + smoke test)

game-harness 의 API QA phase — 서버 bringup 후 Postman MCP 로 주요 엔드포인트 smoke test.
- 백엔드 heavy 프로젝트에 유용
- `--include-api-qa` 플래그로 opt-in
- 현재는 별도 구현 필요 (deferred — 이 PR 범위 밖)
