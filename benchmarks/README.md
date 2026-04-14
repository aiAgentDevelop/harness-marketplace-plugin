# benchmarks/ — Phase 1 v2 (ISO 25010 + OWASP ASVS + DORA, 13-axis)

End-to-end benchmark comparing **Plain Claude Code** vs **project-harness** (v0.6.0 full wizard output) across the full development lifecycle, grounded in international standards.

> **Phase 0.5 note**: The previous benchmark (single-task, 10 tasks, N=2-3) was **deleted** in commit `0bc1940` per user decision (2026-04-13). To inspect historical Phase 0.5 artifacts, use `git show a455abe -- benchmarks/`.

## Directory Layout

```
benchmarks/
├── PROTOCOL-v2.md               # Pre-registered hypotheses + 13-axis weights + decision rules (FROZEN)
├── package.json                 # Node deps for runners + scorers
├── runner/                      # Invocation layer
│   ├── invoke.js                # stream-json wrapper around `claude -p`
│   ├── run-bare.js              # C1: plain claude -p, no seed
│   ├── run-claude-md-only.js    # C2: seed + project-root CLAUDE.md only
│   ├── run-harness.js           # C3: full wizard-generated harness
│   ├── run-sprint.js            # Sequential 8-task sprint runner (A3)
│   └── batch.js                 # Fan-out orchestrator w/ shuffle seed 20260413
├── scorer/                      # 13-axis scoring
│   ├── iso-25010.js             # Axes 1, 2, 5, 6, 7, 8, 12 (ISO 25010 characteristics)
│   ├── asvs-mapper.js           # Axis 3 (OWASP ASVS L2 coverage)
│   ├── cwe-classifier.js        # Axis 4 (CWE-weighted defect, via semgrep + heuristics)
│   ├── dora-metrics.js          # Axes 9, 10, 11 (DORA: lead time / CFR / MTTR)
│   ├── llm-judge.js             # Axes 12 (Usability), 13 (Over-engineering) — blind
│   ├── verify-blinding.js       # CI: reject judge prompts that leak condition labels
│   └── aggregate-v2.js          # Weighted total + winner table + radar data
├── tasks/
│   ├── owasp/                   # A2: 15 adversarial tasks (OWASP Top 10 2021)
│   ├── sprint-nextjs-supabase/  # A3: Sprint 1 (8 tasks, sequential)
│   ├── sprint-fastapi-postgres/ # A3: Sprint 2 (8 tasks, sequential)
│   └── sprint-game/             # A3: Sprint 3 (8 tasks, Full stage only)
├── external/
│   └── swebench/                # A1: SWE-bench Verified subset adapter
│       ├── sample.js            # Sample 20 of 500 (stratified, seed 20260413)
│       └── run-hidden-tests.js  # Judge-free pass/fail
├── reference-projects/          # Pre-built seed repos per stack
│   ├── bare/                    # empty, for C1
│   ├── claude-md-only-nextjs/   # seed + CLAUDE.md only
│   ├── claude-md-only-fastapi/
│   ├── harness-nextjs/          # wizard-completed project-harness
│   └── harness-fastapi/
├── results/
│   ├── raw/<run-id>/            # per-run output, cost, stream-json log
│   ├── pilot/
│   ├── slim/
│   └── full/
└── reports/
    ├── pilot-report.md
    ├── slim-report.md
    └── full-report.md           # 13-axis weighted table + radar + "Where harness loses"
```

## Quick start

```bash
# S0: verify protocol + blinding
node scorer/verify-blinding.js
node scorer/aggregate-v2.js --verify-weights  # asserts sum === 100

# S6: Pilot (A2 only — 15 tasks × 3 conditions × N=3 = 135 runs)
node runner/batch.js --stage pilot --seed 20260413

# Generate report
node scorer/aggregate-v2.js --stage pilot --out reports/pilot-report.md
```

## 13-axis weights (FROZEN per PROTOCOL-v2.md)

| Axis | Weight |
|---|---|
| Functional Suitability | 15% |
| Reliability | 12% |
| Security — ASVS L2 | 15% |
| Security — CWE-weighted | 10% |
| Maintainability | 10% |
| Perf — Wall-time | 6% |
| Perf — Cost | 6% |
| Compatibility | 6% |
| DORA Lead Time | 5% |
| DORA CFR | 3% |
| DORA MTTR | 3% |
| Usability | 5% |
| Over-engineering↓ | 4% |
| **Total** | **100%** |

## Budget (pre-registered)

| Stage | Runs | Time est. | Cost est. (USD) |
|---|---|---|---|
| Pilot (A2 only) | 135 | ~6h | ~$25 (ceiling $40) |
| Slim (+A1 easy/med) | ~250 | ~12h | ~$75 (ceiling $120) |
| Full (+A3 all sprints) | ~531 | ~40h | ~$250 (ceiling $350) |

See `PROTOCOL-v2.md` for decision rules on Pilot → Slim → Full escalation.
