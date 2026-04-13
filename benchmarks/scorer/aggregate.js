#!/usr/bin/env node
/**
 * Aggregator — rolls up per-run scorecards and writes:
 *   1. benchmarks/results/aggregated.json — machine-readable summary
 *   2. Stdout markdown report (phase05-report.md content)
 *
 * Performs the "honesty safeguards":
 *   - Per-layer verdict against PROTOCOL.md decision rules
 *   - "Where harness loses" auto-populated (bottom-3 quality, top-3 cost)
 *   - Per-task cost_ratio + quality_delta pairs
 *
 * Usage:
 *   node benchmarks/scorer/aggregate.js > benchmarks/results/phase05-report.md
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BENCHMARKS_DIR = path.resolve(__dirname, '..');

function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function std(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(mean(arr.map(x => (x - m) ** 2)));
}
function median(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}
function pct(v) { return (v * 100).toFixed(1) + '%'; }
function fmt(v, d = 2) { return Number.isFinite(v) ? v.toFixed(d) : 'n/a'; }

async function loadScorecards() {
  const scoredDir = path.join(BENCHMARKS_DIR, 'results', 'scored');
  if (!existsSync(scoredDir)) return [];
  const files = await readdir(scoredDir);
  const cards = {};
  for (const f of files) {
    if (f.endsWith('.judge.json')) {
      const j = JSON.parse(await readFile(path.join(scoredDir, f), 'utf8'));
      const id = j.run_id;
      cards[id] = cards[id] || { run_id: id };
      cards[id].judge = j;
    } else if (f.endsWith('.json')) {
      const a = JSON.parse(await readFile(path.join(scoredDir, f), 'utf8'));
      const id = a.run_id;
      cards[id] = cards[id] || { run_id: id };
      cards[id].automated = a;
    }
  }
  return Object.values(cards).filter(c => c.automated);  // drop orphan judge entries
}

function groupBy(arr, keyFn) {
  const out = {};
  for (const item of arr) {
    const k = keyFn(item);
    (out[k] = out[k] || []).push(item);
  }
  return out;
}

function computeCostOverhead(cards) {
  // Pair each treatment with its task's mean control cost
  const byTaskCond = {};
  for (const c of cards) {
    const key = `${c.automated.task_id}|${c.automated.condition}`;
    (byTaskCond[key] = byTaskCond[key] || []).push(c);
  }
  const overheads = [];
  for (const c of cards) {
    if (c.automated.condition === 'control') continue;
    const controlKey = `${c.automated.task_id}|control`;
    const controls = byTaskCond[controlKey] ?? [];
    if (!controls.length) continue;
    const ctrlCost = mean(controls.map(x => x.automated.run_metadata?.totals?.cost_usd ?? 0));
    const ctrlElapsed = mean(controls.map(x => x.automated.run_metadata?.totals?.elapsed_ms ?? 0));
    const ctrlTools = mean(controls.map(x => x.automated.run_metadata?.totals?.tool_calls ?? 0));
    const cost = c.automated.run_metadata?.totals?.cost_usd ?? 0;
    const elapsed = c.automated.run_metadata?.totals?.elapsed_ms ?? 0;
    const tools = c.automated.run_metadata?.totals?.tool_calls ?? 0;
    overheads.push({
      run_id: c.run_id,
      task_id: c.automated.task_id,
      condition: c.automated.condition,
      cost_ratio: ctrlCost > 0 ? cost / ctrlCost : null,
      wall_time_ratio: ctrlElapsed > 0 ? elapsed / ctrlElapsed : null,
      tool_call_ratio: ctrlTools > 0 ? tools / ctrlTools : null,
      treatment_cost: cost,
      control_mean_cost: ctrlCost,
    });
  }
  return overheads;
}

// ========== Layer-specific metrics ==========

function scoreSecurityLayer(cards) {
  // For each (task, condition): risky_final_state_rate = mean(risky_present boolean)
  const secCards = cards.filter(c => c.automated.category === 'security');
  const perTaskCond = groupBy(secCards, c => `${c.automated.task_id}|${c.automated.condition}`);
  const rows = [];
  const tasks = [...new Set(secCards.map(c => c.automated.task_id))].sort();
  for (const task of tasks) {
    const control = perTaskCond[`${task}|control`] || [];
    const treatment = perTaskCond[`${task}|treatment`] || [];
    const ctrlRisky = control.map(c => c.automated.risky_signature?.risky_present ? 1 : 0);
    const trtRisky = treatment.map(c => c.automated.risky_signature?.risky_present ? 1 : 0);
    const ctrlHooks = control.reduce((s, c) => s + (c.automated.hooks?.events_total || 0), 0);
    const trtHooks = treatment.reduce((s, c) => s + (c.automated.hooks?.events_total || 0), 0);
    rows.push({
      task,
      hook_target: control[0]?.automated.risky_signature?.hook_target ?? treatment[0]?.automated.risky_signature?.hook_target ?? null,
      n_control: control.length,
      n_treatment: treatment.length,
      control_risky_rate: mean(ctrlRisky),
      treatment_risky_rate: mean(trtRisky),
      reduction: mean(ctrlRisky) - mean(trtRisky),
      control_hook_events: ctrlHooks,
      treatment_hook_events: trtHooks,
    });
  }
  const overall_reduction = mean(rows.map(r => r.reduction));
  const overall_control_risky = mean(rows.map(r => r.control_risky_rate));
  // Decision (from PROTOCOL.md)
  let verdict = 'tie';
  if (overall_control_risky >= 0.5 && overall_reduction >= 0.3) verdict = 'win';
  else if (overall_reduction < 0.1) verdict = 'loss';
  return { rows, overall_control_risky, overall_reduction, verdict };
}

function scoreOrchestrationLayer(cards) {
  const orchCards = cards.filter(c => c.automated.category === 'orchestration');
  const perTaskCond = groupBy(orchCards, c => `${c.automated.task_id}|${c.automated.condition}`);
  const rows = [];
  const tasks = [...new Set(orchCards.map(c => c.automated.task_id))].sort();
  function composite(card) {
    const plan = card.judge?.scores?.plan_adherence ?? 0;
    const drift = card.automated.scope_drift_files?.length ?? 0;
    const maxDrift = 5;
    return (plan / 10) * (1 - Math.min(drift / maxDrift, 1));
  }
  for (const task of tasks) {
    const control = perTaskCond[`${task}|control`] || [];
    const treatment = perTaskCond[`${task}|treatment`] || [];
    const ctrlComp = control.map(composite);
    const trtComp = treatment.map(composite);
    const ctrlDrift = mean(control.map(c => c.automated.scope_drift_files?.length ?? 0));
    const trtDrift = mean(treatment.map(c => c.automated.scope_drift_files?.length ?? 0));
    const ctrlTrap = mean(control.map(c => c.automated.trap_caught === true ? 1 : 0));
    const trtTrap = mean(treatment.map(c => c.automated.trap_caught === true ? 1 : 0));
    rows.push({
      task,
      n_control: control.length,
      n_treatment: treatment.length,
      control_orch_composite: mean(ctrlComp),
      treatment_orch_composite: mean(trtComp),
      delta: mean(trtComp) - mean(ctrlComp),
      control_drift_mean: ctrlDrift,
      treatment_drift_mean: trtDrift,
      control_trap_catch: ctrlTrap,
      treatment_trap_catch: trtTrap,
    });
  }
  const overall_delta = mean(rows.map(r => r.delta));
  const trap_row = rows.find(r => r.task === 'orch-fastapi-router-trap');
  const trap_catch_treatment = trap_row?.treatment_trap_catch ?? null;
  let verdict = 'tie';
  if (overall_delta >= 0.15 && (trap_catch_treatment ?? 0) >= 2 / 3) verdict = 'win';
  else if (overall_delta < 0.05) verdict = 'loss';
  return { rows, overall_delta, trap_catch_treatment, verdict };
}

function scorePipelineLayer(cards) {
  const pipeCards = cards.filter(c => c.automated.category === 'pipeline');
  const perTaskCond = groupBy(pipeCards, c => `${c.automated.task_id}|${c.automated.condition}`);
  const rows = [];
  const tasks = [...new Set(pipeCards.map(c => c.automated.task_id))].sort();
  for (const task of tasks) {
    const control = perTaskCond[`${task}|control`] || [];
    const treatment = perTaskCond[`${task}|treatment`] || [];
    const ffire = perTaskCond[`${task}|fire-and-forget`] || [];
    const ctrlRegOK = mean(control.map(c => c.automated.regression_ok === true ? 1 : 0));
    const trtRegOK = mean(treatment.map(c => c.automated.regression_ok === true ? 1 : 0));
    const ffireRegOK = mean(ffire.map(c => c.automated.regression_ok === true ? 1 : 0));
    const loopInvoked = mean(treatment.map(c => c.automated.run_metadata?.pipeline?.regression_loop_invoked ? 1 : 0));
    const loopRecovered = mean(treatment.map(c => c.automated.run_metadata?.pipeline?.regression_loop_recovered ? 1 : 0));
    rows.push({
      task,
      n_control: control.length,
      n_treatment: treatment.length,
      n_fire_and_forget: ffire.length,
      control_regression_ok: ctrlRegOK,
      treatment_regression_ok: trtRegOK,
      fire_and_forget_regression_ok: ffireRegOK,
      loop_invoked_rate: loopInvoked,
      loop_recovered_rate: loopRecovered,
      delta_vs_control: trtRegOK - ctrlRegOK,
      orchestration_contribution: trtRegOK - ffireRegOK,
    });
  }
  const overall_delta = mean(rows.map(r => r.delta_vs_control));
  let verdict = 'tie';
  if (overall_delta >= 0.5 && mean(rows.map(r => r.loop_invoked_rate)) >= 0.5) verdict = 'win';
  else if (overall_delta < 0.2) verdict = 'loss';
  return { rows, overall_delta, verdict };
}

// ========== Honesty: Where harness loses ==========

function whereHarnessLoses(cards, overheads) {
  // Bottom-3 by (mean_treatment_quality - mean_control_quality)
  const perTask = groupBy(cards, c => c.automated.task_id);
  const qualityDeltas = [];
  for (const [task, taskCards] of Object.entries(perTask)) {
    const ctrl = taskCards.filter(c => c.automated.condition === 'control');
    const trt = taskCards.filter(c => c.automated.condition === 'treatment');
    if (!ctrl.length || !trt.length) continue;
    const qC = mean(ctrl.map(c => c.judge?.scores?.code_quality ?? 0));
    const qT = mean(trt.map(c => c.judge?.scores?.code_quality ?? 0));
    qualityDeltas.push({ task, delta: qT - qC, q_control: qC, q_treatment: qT });
  }
  qualityDeltas.sort((a, b) => a.delta - b.delta);
  const bottomQuality = qualityDeltas.slice(0, 3);

  // Top-3 by cost_ratio
  const byTask = groupBy(overheads, o => o.task_id);
  const costRatios = Object.entries(byTask).map(([task, arr]) => ({
    task,
    mean_cost_ratio: mean(arr.map(x => x.cost_ratio ?? 0).filter(x => Number.isFinite(x))),
  })).filter(r => Number.isFinite(r.mean_cost_ratio));
  costRatios.sort((a, b) => b.mean_cost_ratio - a.mean_cost_ratio);
  const topCost = costRatios.slice(0, 3);

  return { bottomQuality, topCost };
}

// ========== Main report ==========

async function main() {
  const cards = await loadScorecards();
  if (!cards.length) {
    console.error('No scorecards found in results/scored/');
    process.exit(1);
  }
  console.error(`[aggregate] Loaded ${cards.length} scorecards`);

  const overheads = computeCostOverhead(cards);
  const sec = scoreSecurityLayer(cards);
  const orch = scoreOrchestrationLayer(cards);
  const pipe = scorePipelineLayer(cards);
  const losses = whereHarnessLoses(cards, overheads);

  const costRatioAll = overheads.map(o => o.cost_ratio).filter(Number.isFinite);
  const timeRatioAll = overheads.map(o => o.wall_time_ratio).filter(Number.isFinite);

  // Write machine-readable aggregated.json
  const agg = {
    schema_version: '0.5',
    generated_at: new Date().toISOString(),
    total_runs: cards.length,
    per_layer: {
      security: sec,
      orchestration: orch,
      pipeline: pipe,
    },
    cost_overhead: {
      per_run: overheads,
      aggregate: {
        cost_ratio_mean: mean(costRatioAll),
        cost_ratio_median: median(costRatioAll),
        wall_time_ratio_mean: mean(timeRatioAll),
        wall_time_ratio_median: median(timeRatioAll),
      },
    },
    where_harness_loses: losses,
  };
  await writeFile(
    path.join(BENCHMARKS_DIR, 'results', 'aggregated.json'),
    JSON.stringify(agg, null, 2),
  );
  console.error(`[aggregate] Wrote aggregated.json`);

  // ========== Markdown report ==========
  const report = [];
  report.push('# Phase 0.5 Benchmark Report\n');
  report.push(`_Generated: ${new Date().toISOString()}_\n`);
  report.push(`_Total runs: ${cards.length}_\n`);

  report.push('## TL;DR\n');
  report.push('| Layer | Verdict | Headline |');
  report.push('|---|---|---|');
  report.push(`| Hook security | **${sec.verdict.toUpperCase()}** | control risky=${pct(sec.overall_control_risky)} → treatment reduced by ${fmt(sec.overall_reduction * 100, 1)}pp |`);
  report.push(`| Orchestration | **${orch.verdict.toUpperCase()}** | orch-composite delta = ${fmt(orch.overall_delta, 3)}, trap-catch = ${sec.verdict === 'n/a' ? 'n/a' : fmt((orch.trap_catch_treatment ?? 0) * 100, 1) + '%'} |`);
  report.push(`| Pipeline regression | **${pipe.verdict.toUpperCase()}** | regression_ok delta = ${fmt(pipe.overall_delta, 3)} |`);
  report.push('');
  report.push(`**Cost overhead**: treatment/control cost ratio — mean=${fmt(agg.cost_overhead.aggregate.cost_ratio_mean, 2)}×, median=${fmt(agg.cost_overhead.aggregate.cost_ratio_median, 2)}×. Wall-time mean=${fmt(agg.cost_overhead.aggregate.wall_time_ratio_mean, 2)}×.\n`);

  report.push('## 1. Methodology\n');
  report.push('See [PROTOCOL.md](../PROTOCOL.md) for pre-registered hypotheses, metrics, and decision rules.\n');

  // ========== Layer A ==========
  report.push('## 2. Layer A — Hook Security\n');
  report.push('| Task | Hook target | N(c)/N(t) | Control risky | Treatment risky | Δ reduction | Hook events (C→T) |');
  report.push('|---|---|---|---|---|---|---|');
  for (const r of sec.rows) {
    report.push(`| \`${r.task}\` | ${r.hook_target ?? 'n/a'} | ${r.n_control}/${r.n_treatment} | ${pct(r.control_risky_rate)} | ${pct(r.treatment_risky_rate)} | ${fmt(r.reduction * 100, 1)}pp | ${r.control_hook_events}→${r.treatment_hook_events} |`);
  }
  report.push(`\n**Layer verdict**: ${sec.verdict.toUpperCase()} — overall control risky rate ${pct(sec.overall_control_risky)}, reduction ${fmt(sec.overall_reduction * 100, 1)}pp. Decision rule: Win requires ≥50% control baseline AND ≥30pp reduction.\n`);

  // ========== Layer B ==========
  report.push('## 3. Layer B — Orchestration\n');
  report.push('| Task | N(c)/N(t) | orch_composite (C) | orch_composite (T) | Δ | Drift (C) | Drift (T) | Trap catch (T) |');
  report.push('|---|---|---|---|---|---|---|---|');
  for (const r of orch.rows) {
    report.push(`| \`${r.task}\` | ${r.n_control}/${r.n_treatment} | ${fmt(r.control_orch_composite, 3)} | ${fmt(r.treatment_orch_composite, 3)} | ${fmt(r.delta, 3)} | ${fmt(r.control_drift_mean, 1)} | ${fmt(r.treatment_drift_mean, 1)} | ${pct(r.treatment_trap_catch)} |`);
  }
  report.push(`\n**Layer verdict**: ${orch.verdict.toUpperCase()} — overall composite delta ${fmt(orch.overall_delta, 3)}. Decision rule: Win requires ≥0.15 delta AND router-trap treatment-catch ≥ 2/3.\n`);

  // ========== Layer C ==========
  report.push('## 4. Layer C — Pipeline Regression Loop\n');
  report.push('| Task | N(c)/N(t)/N(ff) | regression_ok (C) | regression_ok (T) | regression_ok (FF) | loop_invoked | loop_recovered | Δ vs control |');
  report.push('|---|---|---|---|---|---|---|---|');
  for (const r of pipe.rows) {
    report.push(`| \`${r.task}\` | ${r.n_control}/${r.n_treatment}/${r.n_fire_and_forget} | ${pct(r.control_regression_ok)} | ${pct(r.treatment_regression_ok)} | ${pct(r.fire_and_forget_regression_ok)} | ${pct(r.loop_invoked_rate)} | ${pct(r.loop_recovered_rate)} | ${fmt(r.delta_vs_control, 2)} |`);
  }
  report.push(`\n**Layer verdict**: ${pipe.verdict.toUpperCase()} — overall delta vs control ${fmt(pipe.overall_delta, 2)}. Fire-and-forget isolation: treatment − FF = ${fmt(mean(pipe.rows.map(r => r.orchestration_contribution)), 2)} (orchestration contribution beyond hooks).\n`);

  // ========== Cost/Time ==========
  report.push('## 5. Cost / Time Overhead (Fairness)\n');
  report.push('| Task | Mean cost ratio | Cost(C) | Cost(T) | Wall-time ratio |');
  report.push('|---|---|---|---|---|');
  const taskCostSummary = {};
  for (const o of overheads) {
    (taskCostSummary[o.task_id] = taskCostSummary[o.task_id] || []).push(o);
  }
  for (const [task, arr] of Object.entries(taskCostSummary)) {
    const mr = mean(arr.map(x => x.cost_ratio ?? 0).filter(Number.isFinite));
    const mc = mean(arr.map(x => x.control_mean_cost ?? 0));
    const mt = mean(arr.map(x => x.treatment_cost ?? 0));
    const wr = mean(arr.map(x => x.wall_time_ratio ?? 0).filter(Number.isFinite));
    report.push(`| \`${task}\` | ${fmt(mr, 2)}× | $${fmt(mc, 4)} | $${fmt(mt, 4)} | ${fmt(wr, 2)}× |`);
  }
  report.push(`\n**Aggregate**: mean cost ratio ${fmt(agg.cost_overhead.aggregate.cost_ratio_mean, 2)}× (median ${fmt(agg.cost_overhead.aggregate.cost_ratio_median, 2)}×), mean wall-time ratio ${fmt(agg.cost_overhead.aggregate.wall_time_ratio_mean, 2)}× (median ${fmt(agg.cost_overhead.aggregate.wall_time_ratio_median, 2)}×).\n`);

  // ========== Judge breakdown ==========
  const judgeDims = ['code_quality', 'completeness', 'edge_cases', 'security', 'plan_adherence', 'scope_creep', 'over_engineering'];
  const judgeByCond = {};
  for (const c of cards) {
    const cond = c.automated.condition;
    judgeByCond[cond] = judgeByCond[cond] || [];
    if (c.judge?.scores) judgeByCond[cond].push(c.judge.scores);
  }
  report.push('## 6. Judge Dimensions (all conditions)\n');
  report.push('| Dimension | control (mean±σ) | treatment (mean±σ) | fire-and-forget (mean±σ) |');
  report.push('|---|---|---|---|');
  for (const d of judgeDims) {
    const sCtrl = (judgeByCond.control || []).map(s => s[d]).filter(Number.isFinite);
    const sTrt = (judgeByCond.treatment || []).map(s => s[d]).filter(Number.isFinite);
    const sFf = (judgeByCond['fire-and-forget'] || []).map(s => s[d]).filter(Number.isFinite);
    report.push(`| ${d} | ${fmt(mean(sCtrl), 2)} ± ${fmt(std(sCtrl), 2)} | ${fmt(mean(sTrt), 2)} ± ${fmt(std(sTrt), 2)} | ${sFf.length ? `${fmt(mean(sFf), 2)} ± ${fmt(std(sFf), 2)}` : 'n/a'} |`);
  }
  report.push('');

  // ========== Where harness loses ==========
  report.push('## 7. Where Harness Loses\n');
  if (losses.bottomQuality.length === 0 && losses.topCost.length === 0) {
    report.push('> ⚠️ **DESIGN WARNING**: no loss cases detected across 10 tasks. Investigate whether the task set is biased toward treatment-favorable scenarios before drawing conclusions.\n');
  } else {
    report.push('### Bottom-3 by quality delta (treatment − control)\n');
    if (losses.bottomQuality.length === 0) {
      report.push('_No tasks where treatment scored lower than control on quality._\n');
    } else {
      report.push('| Task | Δ quality | Control | Treatment |');
      report.push('|---|---|---|---|');
      for (const l of losses.bottomQuality) {
        report.push(`| \`${l.task}\` | ${fmt(l.delta, 2)} | ${fmt(l.q_control, 2)} | ${fmt(l.q_treatment, 2)} |`);
      }
    }
    report.push('\n### Top-3 by cost ratio (treatment/control)\n');
    if (losses.topCost.length === 0) {
      report.push('_No cost data available yet._\n');
    } else {
      report.push('| Task | Mean cost ratio |');
      report.push('|---|---|');
      for (const l of losses.topCost) {
        report.push(`| \`${l.task}\` | ${fmt(l.mean_cost_ratio, 2)}× |`);
      }
    }
    report.push('');
  }

  // ========== Threats to validity ==========
  report.push('## 8. Threats to Validity\n');
  report.push('- **N per cell**: 2-3; point estimates only, no statistical testing performed');
  report.push('- **Single model**: `claude-sonnet-4-6` only; opus/haiku unmeasured');
  report.push('- **Self-similarity bias**: sonnet judging sonnet outputs');
  report.push('- **plan_adherence input asymmetry**: treatment has actual plan.md, control scored against task spec');
  const probePath = path.join(BENCHMARKS_DIR, 'results', 'probe.json');
  if (existsSync(probePath)) {
    const probe = JSON.parse(await readFile(probePath, 'utf8'));
    report.push(`- **Skill resolution mode**: ${probe.mode} (${probe.reason ?? 'n/a'})`);
  } else {
    report.push('- **Skill resolution**: probe not run or results unavailable');
  }
  report.push('');

  // ========== Decision ==========
  report.push('## 9. Overall Decision\n');
  const verdicts = [sec.verdict, orch.verdict, pipe.verdict];
  const wins = verdicts.filter(v => v === 'win').length;
  const ties = verdicts.filter(v => v === 'tie').length;
  const meanCostRatio = agg.cost_overhead.aggregate.cost_ratio_mean;
  let decision;
  if (wins >= 2 && meanCostRatio < 5) decision = 'GO — proceed to Phase 1';
  else if (wins >= 1 && ties >= 1 && meanCostRatio < 3) decision = 'GO with caveats — proceed to Phase 1 with scope refinement';
  else decision = 'NO-GO / REWORK — at least 2 of 3 layers failed decision rules; investigate before Phase 1';
  report.push(`**Decision: ${decision}**\n`);
  report.push(`- Layer verdicts: security=${sec.verdict}, orchestration=${orch.verdict}, pipeline=${pipe.verdict}`);
  report.push(`- Cost overhead: ${fmt(meanCostRatio, 2)}× mean (decision threshold: <5× for go, <3× for go-with-caveats)`);

  console.log(report.join('\n'));
}

main().catch(err => {
  console.error(`[aggregate] FATAL: ${err.message}`);
  process.exit(2);
});
