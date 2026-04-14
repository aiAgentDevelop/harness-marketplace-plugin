// dora-metrics.js — Axes 9/10/11: DORA metrics.
//
// Lead Time for Changes (axis 9): task start → commit-ready timestamp (from durationMs)
// Change Failure Rate (axis 10): sprint-only — fraction of sprint commits that broke tests
// MTTR (axis 11): sprint-only — time from regression observed to resolution

/**
 * Axis 9 — Lead Time (inverse-normalized, lower is better)
 */
export function leadTime(summary, opts = {}) {
  const durationMs = summary.durationMs ?? 0;
  // Normalization cap frozen at pilot time: 900s = max expected single-task duration.
  const cap = opts.capMs ?? 900_000;
  const score = Math.max(0, Math.round(100 * (1 - Math.min(durationMs, cap) / cap)));
  return { score, durationMs };
}

/**
 * Axis 10 — Change Failure Rate (sprint-only)
 * For single tasks, returns null.
 * For sprints: 1 - (failed_steps / total_steps)
 */
export function changeFailureRate(sprintResult) {
  if (!sprintResult || !sprintResult.steps) return { score: null };
  const total = sprintResult.steps.length;
  const failed = sprintResult.steps.filter((s) => s.regressionObserved).length;
  const cfr = total ? failed / total : 0;
  return {
    score: Math.max(0, Math.round(100 * (1 - cfr))),
    cfr,
    failed,
    total,
  };
}

/**
 * Axis 11 — MTTR (sprint-only)
 * mean time to resolve regression across sprint.
 */
export function mttr(sprintResult, opts = {}) {
  if (!sprintResult || !sprintResult.steps) return { score: null };
  const regressions = sprintResult.steps.filter(
    (s) => s.regressionObserved && s.recoveryMs != null,
  );
  if (!regressions.length) {
    // No regressions observed = perfect score
    return { score: 100, meanRecoveryMs: 0, count: 0 };
  }
  const mean =
    regressions.reduce((a, s) => a + s.recoveryMs, 0) / regressions.length;
  const cap = opts.capMs ?? 600_000;
  const score = Math.max(0, Math.round(100 * (1 - Math.min(mean, cap) / cap)));
  return { score, meanRecoveryMs: mean, count: regressions.length };
}
