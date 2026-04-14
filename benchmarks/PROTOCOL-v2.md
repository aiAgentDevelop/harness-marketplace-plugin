# PROTOCOL-v2 — Phase 1 End-to-End Benchmark

**Pre-registered**: 2026-04-13
**Registered by**: aiAgentDevelop
**Status**: FROZEN — changes after this date require PROTOCOL-v2.1 amendment log

> This document locks in hypotheses, weights, decision rules, and honesty safeguards **before** any runs are collected, to prevent post-hoc rationalization of results.

---

## 1. Research Question

Does `project-harness` (v0.6.0 full wizard output) produce higher end-to-end development pipeline quality than plain `claude -p` across a representative task mix, when measured against international standards (ISO/IEC 25010, OWASP ASVS v4.0.3, DORA)?

---

## 2. Hypotheses

### Primary

- **H1 (Security)**: `full_harness` will score ≥ 15 points higher than `bare_claude` on the **Security ASVS L2** axis (expected: 40+ pp gap based on Phase 0.5 signal).
- **H2 (Reliability)**: `full_harness` will score ≥ 10 points higher than `bare_claude` on the **Reliability** axis (regression loop + verify phase effect).
- **H3 (Over-weight total)**: `full_harness` weighted total (13 axes) will exceed `bare_claude` weighted total by ≥ 5 points.

### Secondary

- **H4 (Cost trade-off)**: `full_harness` will score ≥ 25 points **lower** than `bare_claude` on **Perf — Cost** axis (harness overhead).
- **H5 (Orchestration contribution)**: `claude_md_only` will sit ≥ 5 points above `bare_claude` but ≥ 5 points below `full_harness` on weighted total (i.e., CLAUDE.md alone is not enough).

### Null hypothesis

H0: weighted total difference |full_harness − bare_claude| < 3 points across the pooled task set (no meaningful effect).

---

## 3. Conditions (3-way)

| ID | Name | Setup |
|---|---|---|
| C1 | `bare_claude` | Plain `claude -p` — no seed, no CLAUDE.md, no skills |
| C2 | `claude_md_only` | Seed project + project-root `CLAUDE.md` (wizard-generated). No `skills/`, no hooks. |
| C3 | `full_harness` | Full wizard output v0.6.0 — CLAUDE.md + skills (wizard/plan/implement/verify/...) + hooks + agents + guides |

Seed project for C2/C3 matches the task's target stack (Next.js+Supabase / FastAPI+Postgres / game-backend).

---

## 4. Task Pool (Layer A)

### A1 — SWE-bench Verified subset (N=20)

20 tasks sampled from SWE-bench Verified 500, stratified by difficulty (7 easy / 7 medium / 6 hard). Seed = `20260413`. Sampling script committed at `benchmarks/external/swebench/sample.js` before run.

**Scoring**: `hidden_tests_pass_rate` (objective, no judge).

### A2 — OWASP Top 10 adversarial suite (N=17)

17 tasks covering all 10 OWASP Top 10 2021 categories (A01-A10). Each task designs a user prompt that plausibly tempts the model into an insecure final state. See `benchmarks/tasks/owasp/*.md`.

Distribution: A01×3, A02×2, A03×2, A04×2, A05×2, A06×1, A07×1, A08×2, A09×1, A10×1.

**Scoring**: `risky_final_state_rate` (automated check engine) + CWE label.

### A3 — Multi-task sprints (N=24, sequential)

3 sprints × 8 tasks each. Sequential: task K starts on task K-1's final git state.

- Sprint 1 — Next.js + Supabase CRUD MVP
- Sprint 2 — FastAPI + PostgreSQL Backend API
- Sprint 3 — Game backend (Supabase security gate activated) — Full stage only

---

## 5. Scoring Axes (Layer B) — 13-axis, weights total 100%

| # | Axis | Standard | Measurement | Weight |
|---|---|---|---|---|
| 1 | Functional Suitability | ISO 25010 §4.1 | A1 hidden-test pass rate + A3 acceptance pass | **15%** |
| 2 | Reliability | ISO 25010 §4.5, DORA CFR | A3 pre-existing test break rate + regression recovery | **12%** |
| 3 | Security — ASVS L2 coverage | OWASP ASVS v4.0.3 | A2 non-risky final state rate (mapped to ASVS L2 14 domains) | **15%** |
| 4 | Security — CWE-weighted defect score | CWE Top 25 + CVSS-like weights | defects in A1/A3 output labeled by CWE number | **10%** |
| 5 | Maintainability | ISO 25010 §4.7 | cyclomatic complexity delta + coverage delta + LLM judge (modularity) | **10%** |
| 6 | Perf — Wall-time | ISO 25010 §4.2 | median task wall-time (inverse-normalized; lower is better) | **6%** |
| 7 | Perf — Cost (token) | ISO 25010 §4.2 | total token cost (inverse-normalized; lower is better) | **6%** |
| 8 | Compatibility | ISO 25010 §4.3 | scope drift (files outside plan) + convention adherence | **6%** |
| 9 | DORA Lead Time for Changes | DORA | task start → commit-ready time | **5%** |
| 10 | DORA Change Failure Rate | DORA | sprint-only CFR | **3%** |
| 11 | DORA MTTR | DORA | regression recovery time | **3%** |
| 12 | Usability | ISO 25010 §4.4 | LLM judge (plan adherence + readability + error msgs) | **5%** |
| 13 | Over-engineering↓ (reverse) | Phase 0.5 extension | LLM judge (scope creep + unnecessary abstractions), **lower-is-better** | **4%** |
| | **Total** | | | **100%** |

**Weight sum validation**: `scorer/aggregate-v2.js` MUST assert `sum(weights) === 100` at runtime, exit 1 otherwise.

### Score normalization

- All axes expressed on **0-100 scale**.
- Lower-is-better axes (6, 7, 13): `score = 100 * (1 - clip(value / max_observed, 0, 1))`.
- `max_observed` frozen at pilot completion (recorded in `benchmarks/results/pilot/normalization.json`). Slim/Full reuse the same normalization constants so all three stages are comparable.

### Weighted total

```
weighted_total = Σ (axis_score[i] * weight[i] / 100)
```

---

## 6. Run Parameters

| Parameter | Value |
|---|---|
| Model | `claude-sonnet-4-6` (pinned) |
| Temperature | default (sonnet standard) |
| Max tokens | default |
| N per (condition × task) | **2** for Pilot (budget-safety); **3** for Slim; **3** for Full |
| Timeout per task | 900s (15 min) hard kill |
| Seed (task sampling + run order shuffle) | `20260413` |
| Parallelism | max 3 concurrent runs per host (disk contention lesson from Phase 0.5) |
| Reference-project reset | `git reset --hard origin/main && git clean -fdx` between each run |

---

## 7. Decision Rules (pre-registered)

- **Ship full_harness as recommended default IF**: `weighted_total(C3) − weighted_total(C1) ≥ 5` (H3 met) AND `Security_ASVS(C3) − Security_ASVS(C1) ≥ 15` (H1 met) AND Pilot Wilcoxon signed-rank p < 0.10 on A2 security axis.
- **Document harness as "security-focused, cost-heavy" (mixed) IF**: Security H1 met BUT H3 fails OR |cost gap| > 30.
- **Deprecate harness orchestration layer IF**: both H1 and H3 fail with Wilcoxon p > 0.20 (null accepted).
- **Escalate to Slim/Full**: after Pilot, IF any axis shows |C3−C1| ≥ 10 points with p < 0.20. Else stop at Pilot and report.

---

## 8. Honesty Safeguards

1. **Pre-registration**: this document frozen at commit on feature/benchmark-v2 before any C3 run completes. Any weight/rule change requires `PROTOCOL-v2.md` amendment with signed date.
2. **Blind LLM judge**: judge prompt strips condition labels (`C1`/`C2`/`C3`) and runner metadata. Grep check in CI: `scorer/verify-blinding.js` fails if condition identifiers leak.
3. **Run order shuffle + seed fixing**: `runner/batch.js` shuffles with seed `20260413`, committed.
4. **"Where harness loses" section (mandatory)**: each report MUST list bottom-3 task cells per axis for C3 vs C1. No selective omission.
5. **SWE-bench = objective floor**: hidden-test pass is judge-free. Reported separately even if judge-based axes disagree.
6. **External tool versions recorded**: semgrep / radon / eslint / node / python versions written to every `aggregated.json`.
7. **Scope limitations disclosed**: Portability (ISO §4.8) out of scope. Usability is judge-subjective (weight kept low at 5%).
8. **Statistical test**: N≥3 cells → Wilcoxon signed-rank paired per task (C3 vs C1, C3 vs C2, C2 vs C1). p-values reported, not just deltas.
9. **Cost tracked in USD per run**: `results/raw/<run-id>/cost.json`. Budget ceiling: Pilot ≤ $40, Slim ≤ $120, Full ≤ $350. Stop runner if exceeded.
10. **Partial data policy**: if a stage terminates with ≥ 80% runs complete, report on complete subset + flag in "Threats to Validity".

---

## 9. Verification Checklist (before any run)

- [ ] `scorer/aggregate-v2.js` asserts `sum(weights) === 100`
- [ ] `scorer/verify-blinding.js` passes grep for `C1|C2|C3|bare_claude|full_harness` in judge prompts
- [ ] Seed `20260413` applied in `external/swebench/sample.js`, `runner/batch.js`, `runner/run-sprint.js`
- [ ] Reference projects reset-able to clean state (smoke test)
- [ ] External tools installed: semgrep, radon, eslint — versions logged
- [ ] API key present, test call successful
- [ ] `PROTOCOL-v2.md` committed and referenced by SHA in every `aggregated.json`

---

## 10. Out of Scope

- Portability (ISO §4.8) — single-stack
- Multi-model comparison (opus / haiku / GPT-4 / Gemini)
- Longitudinal self-learning effect (>1 week)
- Human evaluation (cognitive load, dev satisfaction)
- CyberSecEval 3 full suite (1,000+ prompts)
- SWE-bench training-data contamination check (optional Phase 2)

---

## 11. Amendment Log

- 2026-04-13 — A2 task count raised from 15 → 17 to ensure A01 (Broken Access Control) has 3 sub-prompts covering service-role misuse, IDOR, and direct-DB-bypass (the strongest signal in Phase 0.5 warranted deeper sampling). All 10 OWASP categories still covered. No weight changes. — signed by aiAgentDevelop
- 2026-04-13 — Pilot N reduced from 3 → 2 trials per (condition × task) to keep cost safely under \$30 (ceiling \$40). Pilot cell count 17 × 3 × 2 = 102. Slim/Full retain N=3. Wilcoxon signed-rank still valid at N=2 per task when three conditions are compared pairwise (6 deltas per task × 17 tasks = 102 paired observations). — signed by aiAgentDevelop
- 2026-04-13 — Measurement bug found during initial Pilot aggregation: CWE classifier, check-engine globContains, and maintainability static walker were scanning `.claude/` tree of the harness condition, falsely flagging instructional code patterns in skill templates as application defects. Fix: all three scanners now exclude `.claude/` in addition to `node_modules` and `.git`. Rationale: the benchmark measures the agent's APP-LEVEL output, not pre-installed harness infrastructure. No weight or task changes. Re-aggregated Pilot reports reflect the fix. — signed by aiAgentDevelop
