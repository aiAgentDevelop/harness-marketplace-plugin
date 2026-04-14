# project-harness 파이프라인 JSON 스키마 (Schemas)

각 sub-skill 이 출력하는 structured 데이터의 **공식 계약(contract)**.
- Notepad 에 저장되는 intermediate 결과
- `state/results/*.json` 에 기록되는 최종 phase 결과
- handoff-templates.md 가 참조하는 schema 소스

참조: `handoff-templates.md` (stage 간 markdown handoff), `progress-format.md` (진행 표시), `ui-conventions.md` (요약 포맷)

---

## Classification (공통 — 모든 결과 객체에 포함)

project-harness 가 유지하는 공통 분류 컨텍스트. 모든 phase 결과가 이 객체를 포함해야 함.

```json
{
  "classification": {
    "type": "feature|bugfix|refactor|config",
    "flags": {
      "has_ui": true,
      "has_backend": true,
      "has_database": false,
      "has_auth": true,
      "has_realtime": false,
      "has_security_surface": false,
      "is_internal_service": false,
      "visual_qa_capable": true
    },
    "active_agents": ["security-auditor", "ui-reviewer"],
    "active_domains": ["game"] ,
    "debug_complexity": "none|low|medium|high"
  }
}
```

- `type` — 작업 유형
- `flags.*` — `project-config.yaml` 의 `flags` 섹션에서 로드. bool
- `active_agents` — 실제 verify phase 에서 스폰될 agent id 배열 (비어있으면 `[]`, "none" 대신 빈 배열 사용)
- `active_domains` — 도메인 활성화 목록 (예: `["game", "fintech"]`)
- `debug_complexity` — bugfix 타입일 때만 의미 있음. `low` 면 debug phase skip

---

## PlanResult (project-plan 출력)

- **Notepad 키**: `project-plan-result`
- **JSON 파일**: `state/results/plan.json`
- **Handoff 파일**: `state/handoffs/plan.md`

```json
{
  "schema_version": "1.0",
  "skill": "project-plan",
  "classification": { /* Classification 객체 */ },
  "exploration": {
    "related_files": ["src/features/profile/ui/ProfileCard.tsx"],
    "impact_scope": ["features", "pages"],
    "existing_patterns": "FSD 레이어, custom hooks 패턴, Tailwind 디자인 토큰 사용",
    "dependencies": {
      "added_packages": [],
      "affected_packages": ["@/features/profile"]
    },
    "warnings": ["auth 세션 만료 처리 로직 중복 가능성"]
  },
  "design": {
    "files_to_create": [
      { "path": "src/features/profile/ui/ProfileCard.tsx", "purpose": "presentational card component" }
    ],
    "files_to_modify": [
      { "path": "src/pages/dashboard/ui/DashboardPage.tsx", "change_summary": "ProfileCard 임포트 및 렌더" }
    ],
    "files_to_delete": [],
    "task_order": [
      { "step": 1, "description": "ProfileCard 컴포넌트 작성", "depends_on": [] },
      { "step": 2, "description": "dashboard 통합", "depends_on": [1] }
    ],
    "ux_design": {
      "component_tree": "DashboardPage > ProfileCard > Avatar + Name + Email",
      "layout_strategy": "flex column, 16px gap, overflow: hidden on avatar",
      "design_tokens": ["--spacing-md", "--radius-lg", "--color-surface-1"]
    },
    "domain_validation": "n/a"
  },
  "user_approved": true,
  "user_feedback": null,
  "timings": { "started_at": "ISO", "finished_at": "ISO", "elapsed_ms": 123456 }
}
```

---

## DebugResult (project-debug 출력 — bugfix high-complexity 에서만)

- **Notepad 키**: `project-debug-result`
- **JSON 파일**: `state/results/debug.json`
- **Handoff 파일**: `state/handoffs/debug.md`

```json
{
  "schema_version": "1.0",
  "skill": "project-debug",
  "classification": { /* Classification 객체 */ },
  "reproduction": {
    "reproducible": true,
    "steps": ["1. 로그인", "2. 프로필 편집", "3. 저장 시 500 발생"],
    "environment": "Windows 11 + Node 20 + Chrome 130",
    "error_message": "500 Internal Server Error — UniqueViolation",
    "stack_trace": "..."
  },
  "hypotheses": [
    { "id": "A", "description": "race condition on session save", "result": "rejected", "evidence": "로그 타임스탬프 확인, 단일 요청임" },
    { "id": "B", "description": "stale session cookie", "result": "confirmed", "evidence": "fresh login 후 재현 불가" }
  ],
  "root_cause": "세션 만료 조건이 refresh 토큰 갱신보다 1초 빠름",
  "fix_direction": {
    "location": "src/auth/session.ts:42-48",
    "strategy": "patch — expires_at 비교 연산자 교체",
    "needs_regression_test": true
  },
  "timings": { "started_at": "ISO", "finished_at": "ISO", "elapsed_ms": 234567 }
}
```

---

## ImplementationResult (project-implement 출력)

- **Notepad 키**: `project-implement-result`
- **JSON 파일**: `state/results/implement.json`
- **Handoff 파일**: `state/handoffs/exec.md`

```json
{
  "schema_version": "1.0",
  "skill": "project-implement",
  "classification": { /* Classification 객체 */ },
  "changes": {
    "files_created": [
      { "path": "src/features/profile/ui/ProfileCard.tsx", "loc": 68 }
    ],
    "files_modified": [
      { "path": "src/pages/dashboard/ui/DashboardPage.tsx", "lines_added": 3, "lines_removed": 1 }
    ],
    "files_deleted": []
  },
  "workers": {
    "scaffolder": "completed",
    "implementer": "completed",
    "ui-checker": "completed",
    "integrator": "completed",
    "domain-reviewer": "skipped (domain: none)",
    "security-checker": "skipped (has_security_surface: false)",
    "test-writer": "completed",
    "test-runner": "completed",
    "build-checker": "completed"
  },
  "test_results": {
    "passed": 15,
    "failed": 0,
    "skipped": 0,
    "coverage_pct": 87.5
  },
  "build": {
    "typecheck": "pass",
    "lint": "pass",
    "build": "pass",
    "auto_fix_attempts": 0
  },
  "security_gate": "n/a",
  "domain_review": "n/a",
  "timings": { "started_at": "ISO", "finished_at": "ISO", "elapsed_ms": 234567 }
}
```

---

## VisualQAResult (project-visual-qa 출력 — has_ui + visual_qa_capable)

- **Notepad 키**: `project-visual-qa-result`
- **JSON 파일**: `state/results/visual-qa.json`

```json
{
  "schema_version": "1.0",
  "skill": "project-visual-qa",
  "pages": [
    {
      "path": "/dashboard",
      "viewport": "desktop",
      "checks": {
        "overflow": { "count": 0, "fixed": 0 },
        "alignment": { "count": 1, "fixed": 1 },
        "spacing": { "count": 0, "fixed": 0 },
        "text_clip": { "count": 0, "fixed": 0 },
        "z_index": { "count": 0, "fixed": 0 },
        "responsive": { "breakpoints_tested": ["mobile", "tablet", "desktop"], "issues": 0 },
        "a11y": { "contrast": 0, "aria": 0, "keyboard": 0 }
      }
    }
  ],
  "total_fixes": 1,
  "status": "pass|pass_with_fixes|fail|skipped",
  "timings": { "started_at": "ISO", "finished_at": "ISO", "elapsed_ms": 45678 }
}
```

---

## VerificationResult (project-verify 출력)

- **Notepad 키**: `project-verify-result`
- **JSON 파일**: `state/results/verify.json`
- **Handoff 파일**: `state/handoffs/verify.md`

```json
{
  "schema_version": "1.0",
  "skill": "project-verify",
  "classification": { /* Classification 객체 */ },
  "fixed_checks": {
    "arch_audit": { "block": 0, "warn": 2, "info": 1 },
    "code_review": { "block": 0, "warn": 1 },
    "typecheck": "pass",
    "lint": "pass",
    "deploy_validation": { "frontend": "pass", "backend": "pass", "database": "skip" }
  },
  "conditional_checks": {
    "ux_review": { "status": "pass", "overflow": 0, "spacing": 0, "alignment": 0 },
    "design_review": { "status": "pass", "score": 85, "block": 0, "warn": 2 },
    "db_security": { "status": "skip", "reason": "has_database: false" },
    "auth_security": { "status": "pass", "passed": 12, "total": 12 },
    "seo_verification": { "status": "skip", "reason": "is_internal_service: true" },
    "security_audit": { "status": "skip", "reason": "has_security_surface: false" },
    "domain_audits": {}
  },
  "tier_breakdown": {
    "BLOCK": 0,
    "WARN": 3,
    "INFO": 1
  },
  "overall": "pass|pass_with_warnings|fail",
  "regression_needed": false,
  "regression_attempt": 0,
  "timings": { "started_at": "ISO", "finished_at": "ISO", "elapsed_ms": 56789 }
}
```

---

## Notepad 키 규약 / Notepad Key Naming

sub-skill 결과 + intermediate merged notepad 의 키 명명 규칙:

```
# 최종 결과 (JSON 파일과 페어링)
project-plan-result              # PlanResult
project-debug-result             # DebugResult (조건부)
project-implement-result         # ImplementationResult
project-visual-qa-result         # VisualQAResult (조건부)
project-verify-result            # VerificationResult

# project-plan 중간 결과
project-plan-phase1-merged       # 탐색 결과 취합 (reader/fan-in — plan.md §Reader Pattern 참조)
project-plan-phase2-merged       # 설계 결과 취합
project-plan-phase2-arch         # architect 워커 결과
project-plan-phase2-ux           # ux-designer 워커 결과 (has_ui)

# project-verify 중간 결과 (워커별 스폰 결과)
project-verify-arch              # arch-auditor
project-verify-review            # code-reviewer
project-verify-typelint          # type-linter
project-verify-deploy            # deploy-validator
project-verify-ux                # ux-reviewer (has_ui)
project-verify-design            # design-reviewer (has_ui)
project-verify-db                # db-auditor (has_database)
project-verify-auth              # auth-auditor (has_auth)
project-verify-seo               # seo-verifier (!is_internal_service)
project-verify-security          # security-auditor (has_security_surface)
project-verify-domain-{id}       # domain-auditor 별 (agents.yaml id)
```

---

## 스키마 진화 규칙 / Schema Evolution

1. **schema_version 필드 필수** — 모든 top-level 결과 객체는 `"schema_version": "X.Y"` 포함
2. **semver** — major 증가 시 breaking change (reader 가 파싱 실패 가능), minor 증가 시 backward-compatible 확장 (신규 optional 필드)
3. **신규 필드는 optional** — 기존 consumer 가 신규 필드 없이도 동작하도록
4. **제거 전 deprecated 표시** — `"deprecated_field": "_deprecated"` 형태로 1 minor 버전 유지 후 제거
5. **wizard 생성 시 버전 고정** — `project-config.yaml.schema_version` 이 해당 프로젝트의 계약 버전 기록

---

## 관련 참조 파일

- `handoff-templates.md` — markdown handoff 파일 구조 (schemas.md 의 JSON 을 markdown 으로 직렬화)
- `progress-format.md` — 실행 중 진행 표시 (schemas.md 는 phase 종료 후)
- `ui-conventions.md` — 사용자가 보는 요약 포맷
- `guide-injection.md` — 각 워커가 참조하는 가이드 매핑
