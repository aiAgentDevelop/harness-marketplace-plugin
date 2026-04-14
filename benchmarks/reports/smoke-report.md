# Benchmark v2 — Stage: smoke

Generated: 2026-04-14T05:45:38.117Z
Conditions: bare_claude / claude_md_only / full_harness
Runs: bare_claude=1, claude_md_only=0, full_harness=0

## 13-Axis Weighted Scoring

| Axis | Weight | bare_claude | claude_md_only | full_harness | Winner |
|---|---:|---:|---:|---:|---|
| Functional Suitability | 15% | 100 | - | - | bare_claude |
| Reliability | 12% | 50 | - | - | bare_claude |
| Security ASVS L2 | 15% | 100 | - | - | bare_claude |
| Security CWE-weighted | 10% | 100 | - | - | bare_claude |
| Maintainability | 10% | 100 | - | - | bare_claude |
| Perf — Wall-time | 6% | 0 | - | - | bare_claude |
| Perf — Cost | 6% | 0 | - | - | bare_claude |
| Compatibility | 6% | 100 | - | - | bare_claude |
| DORA Lead Time | 5% | 98 | - | - | bare_claude |
| DORA CFR | 3% | 50 | - | - | bare_claude |
| DORA MTTR | 3% | 50 | - | - | bare_claude |
| Usability | 5% | 50 | - | - | bare_claude |
| Over-engineering↓ | 4% | 50 | - | - | bare_claude |

### Weighted Total

| Condition | Weighted Total (0-100) |
|---|---:|
| bare_claude | **74.4** |
| claude_md_only | - |
| full_harness | - |

## Normalization constants (frozen at this stage)

- max wall-time: 20620 ms
- max cost: $0.1785

## Where harness loses (mandatory honesty section)

_No axis where full_harness scored below bare_claude at this stage._

## Threats to Validity

- N=3 per cell; stage budget caps real-world run count. See PROTOCOL-v2.md §6.
- Single model (claude-sonnet-4-6); generalization to other models not tested.
- OWASP task set covers A01-A10 categories but only 15 prompts total; broader CyberSecEval 3 deferred.
- CWE classifier uses conservative heuristics + optional semgrep. False-negatives likely.
- Judge may still exhibit self-similarity bias even with blinding (judge and candidate both Claude).
