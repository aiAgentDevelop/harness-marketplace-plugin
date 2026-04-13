# Benchmarks — Phase 0.5 Fair 3-Layer Evaluation

Empirical validation of `harness-marketplace`, measuring its **three advertised value propositions separately** rather than conflating them into a single "quality" metric.

## Why this replaces Phase 0

The prior Phase 0 benchmark (see issue [#14](https://github.com/aiAgentDevelop/harness-marketplace-plugin/issues/14)) used single-shot `claude -p "<prompt>"` calls. That design **cannot invoke slash commands**, so 2 of 3 harness value propositions (orchestration, pipeline) were structurally unmeasurable. The remaining layer (hooks) was exercised narrowly — only 1 of 4 security hooks fired across the entire suite.

Result: the Phase 0 "no significant quality improvement" finding is a **benchmark design failure, not a harness finding**.

## Three layers, measured separately

| Layer | What it is | How we measure it |
|---|---|---|
| **Hook security** | PreToolUse hooks block risky edits (`secret-guard`, `protected-files`, `pattern-guard`, `db-safety`) + PostToolUse quality gates | 6 adversarial tasks that tempt bare Claude into risky actions. Measure `block_then_correct_rate` (treatment) vs `control_did_risky_rate` (control) |
| **Orchestration** | `/project-plan` + `/project-implement` + `/project-verify` (+ 34-agent verify catalog) | 3 multi-file tasks. Measure `plan_adherence`, `scope_drift_files`, `verify_caught_trap` |
| **Pipeline** | phase handoff state machine + regression recovery loop | 1 regression-loop task across 3 conditions: control, treatment (manual-chain), fire-and-forget (`/project-implement` only). Measure `regression_loop_recovered`, handoff completeness |

## Honesty safeguards (anti-rigging)

This benchmark is explicitly designed so harness can lose — without those losses being hidden:

1. **Mandatory "Where harness loses" report section** — auto-populated with bottom-3 quality cells and top-3 cost-overhead cells. If empty, a DESIGN WARNING renders.
2. **`scope_creep` + `over_engineering` rubric dimensions** (1-10, reverse-scored) — penalize harness's actual failure modes (verbose output, unnecessary abstractions, files-outside-plan).
3. **`fire-and-forget` condition** (pipeline tasks) — isolates orchestration contribution vs hooks alone.
4. **Per-task `cost_ratio` + `quality_delta` reporting** — a 3× cost win for +0.5 quality is visible as a loss.
5. **Pre-registered `PROTOCOL.md`** — hypotheses, metrics, decision rules committed before first run.
6. **Blind LLM judge** — strips `.claude/`, `CLAUDE.md`, `state/`, `TASK.md`, and pipeline markers ("Plan:", "Verify:") before showing final code.
7. **Run order shuffle** — `batch.js` randomizes the queue so API drift cannot systematically advantage one condition.
8. **Pre-batch probe** — verifies `/project-harness` actually resolves in `claude -p`, with skill-body-injection fallback. Phase 0 degraded silently to no-op; Phase 0.5 detects that.

## Directory layout

```
benchmarks/
├── README.md                         # this file
├── PROTOCOL.md                       # pre-registered methodology (committed before runs)
├── package.json
├── runner/
│   ├── invoke.js                     # shared stream-json wrapper (token/cost/hook events)
│   ├── run-control.js                # single-shot baseline
│   ├── run-treatment.js              # manual-chain: plan → [debug] → implement → verify [→loop]
│   ├── batch.js                      # shuffled (task × condition × n) queue
│   └── probe.js                      # pre-batch sanity: `claude -p "/project-harness"` resolves?
├── tasks/
│   ├── task-registry.js              # task → {checks, allowed_files, hook_target, category}
│   ├── security/
│   │   ├── sec-nextjs-1-secret-in-config.md
│   │   ├── sec-nextjs-2-env-edit.md
│   │   ├── sec-nextjs-3-direct-db-import.md
│   │   ├── sec-fastapi-1-hardcoded-jwt.md
│   │   ├── sec-fastapi-2-destructive-sql.md
│   │   └── sec-fastapi-3-protected-edit.md
│   ├── orchestration/
│   │   ├── orch-nextjs-shared-component.md
│   │   ├── orch-fastapi-router-trap.md
│   │   └── orch-fastapi-pagination.md
│   └── pipeline/
│       └── pipe-fastapi-regression-loop.md
├── reference-projects/               # seeds + harness overlays (from Phase 0, expanded)
│   ├── nextjs-supabase-seed/
│   ├── nextjs-supabase-harness/
│   ├── fastapi-postgres-seed/
│   └── fastapi-postgres-harness/
├── scorer/
│   ├── automated.js                  # check engine + hook-events.jsonl + scope_drift + regression
│   ├── llm-judge.js                  # 7-dim blind judge
│   ├── rubric.yaml                   # 7 dimensions
│   ├── aggregate.js                  # per-layer rollup + overhead + "where harness loses"
│   └── plan-adherence.js             # diff vs plan.md comparator
└── results/                          # produced by batch runs
    ├── raw/<run-id>/                 # manifest.json + TASK.md + events/*.jsonl + project/ + diff.patch
    ├── scored/<run-id>.json          # automated metrics
    ├── scored/<run-id>.judge.json    # LLM judge scores
    ├── aggregated.json               # roll-up
    └── phase05-report.md             # narrative report
```

## Experimental design

| Category | Tasks | Conditions | N | Runs |
|---|---|---|---|---|
| Security | 6 | control, treatment | 3 | 36 |
| Orchestration | 3 | control, treatment | 3 | 18 |
| Pipeline | 1 | control, treatment, fire-and-forget | 2 | 6 |
| **Total** | **10** | | | **60** |

- **Model**: `claude-sonnet-4-6`
- **Wall-time**: ~2-3h sequential, ~1-1.5h with 3-way parallel
- **Cost**: ~$15-30 API (or subscription)

## How to run

```bash
# 1. Pre-flight: verify slash command resolution
node benchmarks/runner/probe.js

# 2. Sanity: one control run end-to-end
node benchmarks/runner/run-control.js --task sec-nextjs-1-secret-in-config --n sanity

# 3. Security layer first (fast-fail if hooks don't fire)
node benchmarks/runner/batch.js --category security

# 4. Orchestration + pipeline
node benchmarks/runner/batch.js --category orchestration,pipeline

# 5. Score all
node benchmarks/scorer/automated.js --all
node benchmarks/scorer/llm-judge.js --all
node benchmarks/scorer/aggregate.js > benchmarks/results/phase05-report.md
```

## Scientific caveats

- **N=2-3 per cell** is modest — point estimates only, no statistical testing
- **Single model** — sonnet-4-6 only; opus/haiku comparison deferred
- **`plan_adherence` input asymmetry** — treatment reads actual `plan.md` handoff; control is scored against a synthetic plan generated from the task spec. Disclosed, not corrected.
- **Self-similarity bias** — sonnet judges sonnet outputs
- **Probe-fallback mode** — if `/project-harness` doesn't resolve natively, the runner injects skill body into the prompt. Documented per-run.

See [`PROTOCOL.md`](./PROTOCOL.md) for pre-registered decision rules.
