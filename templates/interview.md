---
name: project-interview
description: {{DESCRIPTION}} — Deep service interview with multi-round Q&A, implementation clarity tracking, PRD generation, domain-expert agent creation via deep research, and development team formation.
argument-hint: "[--resume] [--skip-research] [--no-team] service description"
---

# {{PROJECT_NAME}} Interview

## Overview

`/project-interview "service description"` runs a **deep service interview** that produces a comprehensive PRD, creates domain-specific expert agents, and forms a development team.

Unlike the wizard (which sets the tech stack), the interview mode focuses on understanding the **service's nature** — business logic, user flows, domain rules, and quality requirements.

## Usage

```
/project-interview "service description"              — standalone interview
/project-interview --resume                            — resume interrupted interview
/project-interview --skip-research                     — skip deep research for agents
/project-interview --no-team                           — skip team formation
{{RUN_OPTIONS}}
```

### harness integration
```
/project-interview --team-name <name> --config <JSON> "description"  — called by project-harness
```

---

## Pipeline Structure

```
/project-interview "service description"
  │
  ├─ Step 0:   Initialization
  ├─ Step 0.5: Model Selection (sonnet/opus)
  │
  ├─ Step 1:   Interview Rounds (iterative)
  │              Round 1: 10 structured questions (AI-driven multiple choice)
  │              → Clarity % display + continue gate
  │              Round 2+: 5-10 follow-up questions (targeting low-clarity dimensions)
  │              → Repeat until user chooses "Generate PRD"
  │
  ├─ Step 2:   PRD Generation (Fan-out: service-planner + tech-architect)
  │              → .claude/skills/project-harness/prd/service-prd.md (permanent)
  │              → state/results/interview.json (pipeline data)
  │
  ├─ Step 3:   Agent Analysis & Creation
  │              → Deep research gate (user choice)
  │              → .claude/skills/project-harness/agents/{domain}-expert.md
  │
  ├─ Step 4:   Team Formation
  │              → team_composition in InterviewResult
  │
  └─ Step 5:   User Confirmation Gate
               → Proceed / Revise / Cancel
```

---

## Execution Flow

### Step 0: Initialization

```
1. Accept service description from args
2. Read: .claude/skills/project-harness/project-config.yaml
   - Load interview config: min_clarity_for_prd, max_rounds, deep_research, default_model
   - Load existing agents list for reuse check
3. Write state/pipeline-state.json:
   {
     "mode": "interview",
     "current_phase": "interview",
     "service_description": "<service description>",
     "interview_started": true
   }
4. Initialize: state/results/interview-progress.json
   {
     "rounds": [],
     "current_round": 0,
     "clarity": { "vision": 0, "users": 0, "features": 0, "business_rules": 0,
                  "user_flows": 0, "edge_cases": 0, "data_model": 0, "nfr": 0,
                  "integrations": 0, "constraints": 0 },
     "qa_pairs": []
   }
```

### Step 0.5: Model Selection

Select the model for all subsequent Agent calls (PRD generation, agent creation).

```
AskUserQuestion:
  question: "인터뷰 및 에이전트 생성에 사용할 모델을 선택하세요."
  header: "모델 선택"
  options:
    - label: "Sonnet (Pro 요금제 추천)"
      description: "Pro 요금제 사용자에게 최적. 빠르고 효율적인 인터뷰 및 PRD 생성. Opus는 Pro 요금제에서 사용할 수 없습니다."
    - label: "Opus (Max 요금제 추천)"
      description: "Max 요금제 사용자에게 최적. 더 깊은 분석과 고품질 PRD/에이전트 생성. 최고 수준의 기획 품질."

Store as: interview_model ("sonnet" | "opus")
All subsequent Agent calls use model=interview_model.
```

---

### Step 1: Interview Rounds (Iterative)

#### Round 1 — 10 Structured Questions

Each question targets one of the 10 clarity dimensions.

| # | Dimension | Question Theme |
|---|-----------|---------------|
| 1 | vision | Service core idea, problem being solved |
| 2 | users | Target users, personas, usage scenarios |
| 3 | features | Core features (top 5-7), priority |
| 4 | business_rules | Domain business rules, policies |
| 5 | user_flows | Primary user flows (happy path) |
| 6 | edge_cases | Exception scenarios, error handling |
| 7 | data_model | Core data entities, relationships |
| 8 | nfr | Non-functional requirements (performance, security, availability) |
| 9 | integrations | External system integrations, APIs |
| 10 | constraints | Constraints (regulatory, technical, timeline, budget) |

#### Question Format: AI-Driven Multiple Choice + Custom Input

Each question is presented via AskUserQuestion. **Instead of free text**, the AI analyzes the service context (description + previous Q&A) and presents 4 specific options first.

```
AskUserQuestion:
  question: "{dimension-specific concrete question}"
  header: "{dimension name}"
  options:
    - label: "{AI-analyzed best-fit option 1} (Recommended)"
      description: "{detailed explanation of this direction}"
    - label: "{AI-analyzed option 2}"
      description: "{detailed explanation}"
    - label: "{AI-analyzed option 3}"
      description: "{detailed explanation}"
    - label: "{AI-analyzed option 4}"
      description: "{detailed explanation}"
  # AskUserQuestion automatically provides "Other" → user can type custom input
```

**Multiple-choice generation rules:**
- Analyze all previous answers (service description + accumulated Q&A) to generate options tailored to this specific service
- First option is AI's top recommendation (append "(Recommended)" to label)
- Each option must be concrete and implementation-ready (not vague)
- For dimensions needing multiple selections (features, integrations), use `multiSelect: true`
- User can always use "Other" for custom text input (built-in AskUserQuestion feature)

**Example (features dimension):**
```
AskUserQuestion:
  question: "이 서비스의 핵심 기능은 무엇인가요? (복수 선택 가능)"
  header: "핵심 기능"
  multiSelect: true
  options:
    - label: "실시간 대시보드 + 데이터 시각화 (Recommended)"
      description: "사용자별 맞춤 대시보드, 실시간 차트/그래프, 데이터 필터링"
    - label: "사용자 인증 + 역할 기반 접근 제어"
      description: "소셜 로그인, RBAC, 팀/조직 관리, 초대 시스템"
    - label: "결제 및 구독 관리"
      description: "Stripe/토스 연동, 구독 플랜, 청구서, 환불 처리"
    - label: "알림 및 이메일 자동화"
      description: "인앱 알림, 이메일 트리거, 웹훅, Slack 연동"
```

#### After Each Round: Clarity Display + Continue Gate

After all questions in a round are answered, calculate and display implementation clarity.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 인터뷰 라운드 {N} 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
구현 명확도: {total_pct}%

  vision:        {bar}  {pct}%
  users:         {bar}  {pct}%
  features:      {bar}  {pct}%
  business_rules:{bar}  {pct}%
  user_flows:    {bar}  {pct}%
  edge_cases:    {bar}  {pct}%
  data_model:    {bar}  {pct}%
  nfr:           {bar}  {pct}%
  integrations:  {bar}  {pct}%
  constraints:   {bar}  {pct}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Bar format: `████████░░` (10 chars, filled proportional to percentage)

**Clarity calculation:**
- Each dimension scored 0-100 by AI based on: specificity, ambiguity, implementation-readiness
- **Weighted average** for total clarity:
  - features: weight 1.5
  - user_flows: weight 1.5
  - data_model: weight 1.5
  - business_rules: weight 1.2
  - Other dimensions: weight 1.0

**Continue gate (AskUserQuestion):**
```
AskUserQuestion:
  question: "인터뷰를 계속할까요?"
  header: "인터뷰 진행"
  options:
    - label: "계속 인터뷰"
      description: "부족한 영역({lowest dimensions}) 중심으로 {5-10}개 추가 질문을 진행합니다."
    - label: "현재 결과로 PRD 생성"
      description: "구현 명확도 {pct}%로 PRD를 생성합니다.{warning if below min_clarity}"
    - label: "중단"
      description: "현재 상태를 저장하고 인터뷰를 중단합니다. --resume으로 재개 가능."
```

If clarity < `min_clarity_for_prd` (default 60%) and user chooses "PRD 생성":
```
⚠️ 구현 명확도가 {pct}%로 권장 기준({min}%) 미만입니다.
   추가 인터뷰를 권장하지만, 현재 결과로도 PRD 생성이 가능합니다.
```

#### Follow-up Rounds (5-10 questions each, dynamically generated)

- Target the **lowest clarity dimensions** first
- Generate questions that drill deeper into gaps identified in previous answers
- Same AI-driven multiple choice format
- Same clarity display + continue gate after each round
- Save progress to `state/results/interview-progress.json` after each round (for --resume)
- Maximum rounds: `pipeline.interview.max_rounds` (default 5)
- After max rounds: force proceed to Step 2

---

### Step 2: PRD Generation

Generate a comprehensive PRD using 2 agents in Fan-out pattern.

**Agents (model = interview_model):**

| Role | subagent_type | Responsibility |
|------|--------------|----------------|
| service-planner | Plan | Service planning — vision, users, feature specs, business rules, user flows, success metrics |
| tech-architect | Plan | Development direction — architecture decisions, data model, tech strategy, integration design, NFR strategy |

```
[Leader] ─┬─ service-planner (Plan)  ─┐
           └─ tech-architect (Plan)    ─┼─ [Leader merges → unified PRD]
```

**Worker prompt context:**
- Full accumulated Q&A from all interview rounds
- Clarity breakdown (so agents know which areas need more inference)
- project-config.yaml (tech stack, platform, framework)

**Leader merges results into PRD with this structure:**
```markdown
# {Service Name} PRD

## Executive Summary
{1-2 paragraph overview of the service, target market, value proposition}

## Target Users & Personas
{User types, demographics, pain points, usage scenarios}

## Feature Specifications
{Feature-by-feature breakdown with acceptance criteria}
### Feature 1: {name}
- **Description**: ...
- **User Story**: As a {user}, I want to {action} so that {benefit}
- **Acceptance Criteria**: ...
- **Priority**: P0/P1/P2

## User Flows
{Step-by-step user journeys for core workflows}
### Flow 1: {name}
1. ...
2. ...

## Business Rules
{Domain-specific rules, validations, constraints}

## Data Model
{Core entities, relationships, key attributes}
### Entity: {name}
- field1: type — description
- field2: type — description
- Relations: ...

## Non-Functional Requirements
{Performance targets, security requirements, availability, scalability}

## External Integrations
{Third-party services, APIs, data flows}

## Constraints & Assumptions
{Technical, regulatory, timeline, budget constraints}

## Success Metrics
{KPIs, measurable outcomes, acceptance thresholds}

## Development Phases
{Phased implementation plan with milestones}
### Phase 1: MVP
- {feature set}
- {timeline estimate}
### Phase 2: Enhancement
- ...
```

**Output:**
- **Permanent file**: Write PRD to `.claude/skills/project-harness/prd/service-prd.md`
- **Pipeline JSON**: Write InterviewResult to `state/results/interview.json`
- **Handoff**: Write to `state/handoffs/interview.md`
- **State update**: `current_phase: "interview-prd-done"` in `state/pipeline-state.json`

---

### Step 3: Agent Analysis & Creation

1. Analyze PRD to identify required domain expertise gaps
2. Check existing agents from `project-config.yaml` agents list
3. Identify missing domain expertise

**Present analysis:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 에이전트 분석 결과
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
기존 에이전트 (재사용):
  ✅ security-auditor — 보안 검증
  ✅ accessibility-checker — 접근성 검증

추가 필요 에이전트:
  🆕 {domain}-expert — {이유}
  🆕 {domain}-expert — {이유}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Deep research gate (AskUserQuestion):**
```
AskUserQuestion:
  question: "에이전트 생성 방식을 선택하세요."
  header: "에이전트 생성"
  options:
    - label: "딥리서치 후 전문 에이전트 생성 (Recommended)"
      description: "웹 리서치를 통해 도메인 베스트 프랙티스, 업계 표준, 규제 요건을 조사하여 시니어급 전문 에이전트를 생성합니다."
    - label: "인터뷰 컨텍스트로만 생성"
      description: "웹 리서치 없이 인터뷰 결과와 PRD 기반으로 에이전트를 생성합니다. 더 빠르지만 도메인 지식이 제한적일 수 있습니다."
    - label: "에이전트 생성 건너뛰기"
      description: "새 에이전트를 만들지 않고 기존 에이전트만 사용합니다."
```

**If deep research selected:**

{{CONDITION:deep_research}}
For each identified domain gap:
1. Use WebSearch to research:
   - Domain best practices and industry standards
   - Common pitfalls and anti-patterns
   - Regulatory/compliance requirements
   - Senior-level review checklists
2. If WebSearch unavailable: fall back to LLM knowledge with notice
   ```
   ⚠️ WebSearch를 사용할 수 없습니다. LLM 학습 데이터 기반으로 에이전트를 생성합니다.
   ```
{{/CONDITION:deep_research}}

**Agent .md generation (same format as wizard-generated agents):**
```markdown
---
name: {Domain} Expert
description: {domain-specific expertise description}
model: {interview_model}
---

# {Domain} Expert Agent

## Role
Senior-level {domain} specialist. {specific expertise areas}.
Created via {deep research | interview context} during project-interview.

## Domain Knowledge
{Key domain concepts, industry standards, regulatory requirements}

## Required Checklist
1. {domain-specific validation item}
2. {domain-specific validation item}
... (10-15 items, deep domain expertise)

## Common Anti-patterns
- {anti-pattern 1}: {why it's problematic}
- {anti-pattern 2}: {why it's problematic}

## Constraints
- Follow project-config.yaml tech stack conventions
- Report findings using BLOCK/WARN/INFO tiers
- Reference PRD specifications when validating

## Output Format
{structured output format for review results}
```

Write each agent to: `.claude/skills/project-harness/agents/{domain-id}-expert.md`

**Check for naming conflicts:**
- If agent file already exists: skip and report (do not overwrite wizard-generated agents)
- Update `project-config.yaml` agents list with newly created agents

---

### Step 4: Team Formation

Based on PRD + agents (existing + newly created), define development team composition.

**Team composition includes:**
- Role assignments (who does what)
- Phase mappings (which agent participates in which pipeline phase)
- Communication patterns (Fan-out / Pipeline)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 개발 팀 구성
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| 역할           | 에이전트              | 참여 단계          | 출처    |
|---------------|-----------------------|-------------------|---------|
| Lead Architect | architecture-reviewer | plan, verify      | existing|
| Domain Expert  | {domain}-expert       | plan, impl, verify| created |
| Security Lead  | security-auditor      | impl, verify      | existing|
| ...           | ...                   | ...               | ...     |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Write team composition to InterviewResult's `team_composition` field.

`--no-team` flag skips this step.

---

### Step 5: User Confirmation Gate

Present comprehensive summary for user approval.

**Display:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 인터뷰 결과 요약
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
구현 명확도: {pct}% ({rounds}라운드, {questions}문항)

PRD: .claude/skills/project-harness/prd/service-prd.md
에이전트: {N}개 생성 + {M}개 기존 활성화
팀 구성: {K}개 역할 정의
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**AskUserQuestion (3-option gate):**
```
AskUserQuestion:
  question: "인터뷰 결과를 확인했습니다. 어떻게 진행할까요?"
  header: "확인"
  options:
    - label: "진행"
      description: "PRD + 에이전트 + 팀 구성을 확정하고 다음 단계로 진행합니다."
    - label: "수정 후 진행"
      description: "피드백을 반영하여 PRD나 에이전트를 수정합니다."
    - label: "중단"
      description: "상태를 저장하고 종료합니다. --resume으로 재개 가능."
```

**Response handling:**
- **"진행"**: Finalize InterviewResult, set `user_approved: true`, return
- **"수정 후 진행"**: Accept user feedback, re-run relevant Steps (2/3/4)
- **"중단"**: Save state, exit

---

## `--resume` Behavior

Resume an interrupted interview from the last checkpoint.

### Recovery Procedure
```
1. Read state/results/interview-progress.json → load Q&A + clarity state
   - If missing/corrupt → report to user + offer new interview
2. Read state/pipeline-state.json → determine current phase
   - "interview" → resume from last incomplete round
   - "interview-prd-done" → resume from Step 3 (agent creation)
   - "interview-agents-done" → resume from Step 4 (team formation)
3. Restore interview_model from progress data
4. Resume from the appropriate step
```

### Recovery Status Display
```
🔄 인터뷰 재개
━━━━━━━━━━━━━━━━━━━━━━━━━━━
서비스: <service description>
완료 라운드: {N}회 (질문 {M}개)
현재 명확도: {pct}%
재개 지점: Round {N+1}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Output (InterviewResult)

JSON schema is defined in `references/schemas.md` under **InterviewResult** section.
Notepad key: `project-interview-result` | Handoff: `state/handoffs/interview.md`

---

## Team Cleanup

### Standalone invocation
- `--team-name` not provided → no team created (interview is interactive, not team-based)
- State files cleaned: `state/results/interview-progress.json` (temporary)
- State files preserved: `state/results/interview.json`, `prd/service-prd.md`, `agents/*.md`

### harness invocation
- `--team-name <name>` → uses existing team, no TeamDelete (harness manages)
- InterviewResult passed to project-plan via `--interview-result state/results/interview.json`

---

## Failure Handling

| Situation | Handling |
|-----------|---------|
| WebSearch unavailable | Fall back to LLM knowledge for agent creation |
| PRD generation agent failure | 2 retries → single agent fallback (service-planner only) |
| Interview progress file corrupt | Offer fresh start or manual recovery |
| User closes mid-interview | Progress auto-saved per round (--resume recovers) |

---

## Related References

- `references/schemas.md` — InterviewResult JSON schema
- `references/handoff-templates.md` — interview.md handoff format
- `references/progress-format.md` — interview progress display format
- `references/ui-conventions.md` — 3-option gate + summary format
