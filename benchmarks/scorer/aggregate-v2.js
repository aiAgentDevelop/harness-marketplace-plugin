// aggregate-v2.js — 13-axis weighted total with pre-registered weights.
// Produces per-condition scores, weighted total, winner table, and radar data.

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreAsvs, aggregateAsvs } from "./asvs-mapper.js";
import { scoreCwe } from "./cwe-classifier.js";
import {
  scoreFunctionalSuitability,
  scoreMaintainabilityStatic,
  extractPerfRaw,
  scoreCompatibility,
  scoreReliability,
} from "./iso-25010.js";
import { leadTime, changeFailureRate, mttr } from "./dora-metrics.js";
import { judgeRun } from "./llm-judge.js";
import { parseTask } from "../runner/task-parser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BENCHMARKS_ROOT = path.resolve(__dirname, "..");

// PRE-REGISTERED weights (PROTOCOL-v2.md) — sum MUST equal 100
export const WEIGHTS = Object.freeze({
  functional_suitability: 15,
  reliability: 12,
  security_asvs: 15,
  security_cwe: 10,
  maintainability: 10,
  perf_walltime: 6,
  perf_cost: 6,
  compatibility: 6,
  dora_lead_time: 5,
  dora_cfr: 3,
  dora_mttr: 3,
  usability: 5,
  over_engineering: 4,
});

export function verifyWeights() {
  const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  if (sum !== 100) {
    console.error(`[verify-weights] FAIL: sum=${sum}, expected 100`);
    console.error(JSON.stringify(WEIGHTS, null, 2));
    process.exit(1);
  }
  console.log("[verify-weights] PASS — 13 axes, weights total 100");
  return true;
}

function parseArgs(argv) {
  const out = { stage: "pilot", out: null, skipJudge: false, verify: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--verify-weights") out.verify = true;
    else if (a === "--stage") out.stage = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--skip-judge") out.skipJudge = true;
  }
  return out;
}

async function discoverRuns(stage) {
  const dir = path.join(BENCHMARKS_ROOT, "results", "raw");
  if (!existsSync(dir)) return [];
  const all = await readdir(dir);
  return all.filter((name) => name.startsWith(`${stage}-`));
}

async function loadRun(runDir) {
  const summaryPath = path.join(runDir, "summary.json");
  const condPath = path.join(runDir, "condition.json");
  if (!existsSync(summaryPath) || !existsSync(condPath)) return null;
  const summary = JSON.parse(await readFile(summaryPath, "utf8"));
  const condition = JSON.parse(await readFile(condPath, "utf8"));
  return { summary, condition, workDir: path.join(runDir, "workdir") };
}

async function scoreSingleRun(run, taskById, { skipJudge }) {
  const { summary, condition, workDir } = run;
  const task = taskById[condition.taskId];
  if (!task) {
    return { error: `task ${condition.taskId} not found` };
  }
  const axes = {};

  // Axes 1 / 3 / 4 / 5 / 8
  const funcSuit = await scoreFunctionalSuitability(task, workDir);
  axes.functional_suitability = funcSuit.score;

  const asvs = await scoreAsvs(task, workDir);
  axes.security_asvs = asvs.score;

  const cwe = await scoreCwe(workDir);
  axes.security_cwe = cwe.score;

  const maintain = await scoreMaintainabilityStatic(workDir);
  axes.maintainability = maintain.score;

  const compat = await scoreCompatibility(task, workDir);
  axes.compatibility = compat.score;

  // Axis 2 — Reliability: single tasks set to neutral 50 (not meaningful here).
  const rel = await scoreReliability(task, workDir);
  axes.reliability = rel.score ?? 50;

  // Axes 6/7 — raw perf values; normalization post-aggregation.
  const perf = extractPerfRaw(summary);

  // Axis 9 — Lead time
  const lt = leadTime(summary);
  axes.dora_lead_time = lt.score;

  // Axes 10/11 — sprint-only → neutral 50 for single task.
  axes.dora_cfr = 50;
  axes.dora_mttr = 50;

  // Axes 12/13 — LLM judge (optional, cached per run)
  let judge = { usability_score: 50, overengineering_score: 50 };
  if (!skipJudge) {
    const runDir = path.dirname(workDir);
    const cachePath = path.join(runDir, "judge.json");
    if (existsSync(cachePath)) {
      try {
        judge = JSON.parse(await readFile(cachePath, "utf8"));
      } catch {}
    } else {
      try {
        judge = await judgeRun(
          task.prompt,
          summary.finalAssistantText || "",
          summary.diffStat || "",
        );
        await writeFile(cachePath, JSON.stringify(judge, null, 2), "utf8");
      } catch (e) {
        judge = { usability_score: null, overengineering_score: null, error: String(e) };
      }
    }
  }
  axes.usability = judge.usability_score ?? 50;
  // Over-engineering is lower-is-better; invert so higher = better (consistent with other axes)
  axes.over_engineering = 100 - (judge.overengineering_score ?? 50);

  return {
    axes,
    perf,
    asvs,
    cwe,
    judge,
    compat,
    maintain,
    funcSuit,
    rel,
  };
}

function normalizePerfAxes(allRuns) {
  // For perf_walltime and perf_cost, lower is better → inverse-normalize against stage-max
  const validTimes = allRuns
    .map((r) => r.perf?.wallTimeMs)
    .filter((x) => x != null && x > 0);
  const validCosts = allRuns
    .map((r) => r.perf?.costUsd)
    .filter((x) => x != null && x > 0);
  const maxTime = validTimes.length ? Math.max(...validTimes) : 1;
  const maxCost = validCosts.length ? Math.max(...validCosts) : 1;
  for (const r of allRuns) {
    r.axes.perf_walltime = Math.max(
      0,
      Math.round(100 * (1 - Math.min(r.perf?.wallTimeMs ?? maxTime, maxTime) / maxTime)),
    );
    r.axes.perf_cost = Math.max(
      0,
      Math.round(100 * (1 - Math.min(r.perf?.costUsd ?? maxCost, maxCost) / maxCost)),
    );
  }
  return { maxTime, maxCost };
}

function weightedTotal(axes) {
  let sum = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) {
    sum += (axes[k] ?? 50) * (w / 100);
  }
  return Math.round(sum * 10) / 10;
}

function groupByCondition(runs) {
  const byCond = { bare_claude: [], claude_md_only: [], full_harness: [] };
  for (const r of runs) {
    if (r.condition && byCond[r.condition]) byCond[r.condition].push(r);
  }
  return byCond;
}

function averageAxes(runs) {
  const axes = {};
  for (const k of Object.keys(WEIGHTS)) {
    const vals = runs.map((r) => r.axes[k]).filter((x) => typeof x === "number");
    axes[k] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 50;
  }
  return axes;
}

async function renderReport(stage, conditions, weighted, maxTime, maxCost) {
  const lines = [];
  lines.push(`# Benchmark v2 — Stage: ${stage}`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Conditions: ${Object.keys(conditions).join(" / ")}`);
  lines.push(`Runs: ${Object.entries(conditions).map(([k, v]) => `${k}=${v.length}`).join(", ")}`);
  lines.push("");
  lines.push("## 13-Axis Weighted Scoring");
  lines.push("");
  lines.push(
    "| Axis | Weight | bare_claude | claude_md_only | full_harness | Winner |",
  );
  lines.push("|---|---:|---:|---:|---:|---|");

  const order = [
    ["functional_suitability", "Functional Suitability"],
    ["reliability", "Reliability"],
    ["security_asvs", "Security ASVS L2"],
    ["security_cwe", "Security CWE-weighted"],
    ["maintainability", "Maintainability"],
    ["perf_walltime", "Perf — Wall-time"],
    ["perf_cost", "Perf — Cost"],
    ["compatibility", "Compatibility"],
    ["dora_lead_time", "DORA Lead Time"],
    ["dora_cfr", "DORA CFR"],
    ["dora_mttr", "DORA MTTR"],
    ["usability", "Usability"],
    ["over_engineering", "Over-engineering↓"],
  ];
  for (const [key, label] of order) {
    const bc = conditions.bare_claude.length ? averageAxes(conditions.bare_claude)[key] : "-";
    const cmo = conditions.claude_md_only.length ? averageAxes(conditions.claude_md_only)[key] : "-";
    const fh = conditions.full_harness.length ? averageAxes(conditions.full_harness)[key] : "-";
    const vals = [
      ["bare_claude", bc],
      ["claude_md_only", cmo],
      ["full_harness", fh],
    ].filter(([, v]) => typeof v === "number");
    const winner = vals.length
      ? vals.reduce((a, b) => (b[1] > a[1] ? b : a))[0]
      : "-";
    lines.push(
      `| ${label} | ${WEIGHTS[key]}% | ${fmt(bc)} | ${fmt(cmo)} | ${fmt(fh)} | ${winner} |`,
    );
  }
  lines.push("");
  lines.push("### Weighted Total");
  lines.push("");
  lines.push("| Condition | Weighted Total (0-100) |");
  lines.push("|---|---:|");
  for (const [c, runs] of Object.entries(conditions)) {
    if (!runs.length) {
      lines.push(`| ${c} | - |`);
    } else {
      const axes = averageAxes(runs);
      lines.push(`| ${c} | **${weightedTotal(axes).toFixed(1)}** |`);
    }
  }
  lines.push("");
  lines.push("## Normalization constants (frozen at this stage)");
  lines.push("");
  lines.push(`- max wall-time: ${maxTime} ms`);
  lines.push(`- max cost: $${(maxCost || 0).toFixed(4)}`);
  lines.push("");
  lines.push("## Where harness loses (mandatory honesty section)");
  lines.push("");
  const losses = findLosses(conditions);
  if (!losses.length) {
    lines.push("_No axis where full_harness scored below bare_claude at this stage._");
  } else {
    lines.push("| Axis | bare_claude | full_harness | Delta |");
    lines.push("|---|---:|---:|---:|");
    for (const l of losses) {
      lines.push(`| ${l.label} | ${l.bc} | ${l.fh} | ${l.delta > 0 ? "+" : ""}${l.delta} |`);
    }
  }
  lines.push("");
  lines.push("## Per-Task ASVS Safety (per OWASP category)");
  lines.push("");
  lines.push("Each cell shows the mean safe-rate (0-100) across N trials per condition.");
  lines.push("");
  lines.push("| Task | OWASP | bare | cmo | harness | Δ(h-b) | Δ(h-c) |");
  lines.push("|---|---|---:|---:|---:|---:|---:|");
  const byTask = {};
  for (const c of Object.keys(conditions)) {
    for (const r of conditions[c]) {
      if (!byTask[r.taskId]) byTask[r.taskId] = {};
      if (!byTask[r.taskId][c]) byTask[r.taskId][c] = [];
      byTask[r.taskId][c].push(r.asvs?.score ?? 0);
    }
  }
  const taskKeys = Object.keys(byTask).sort();
  for (const tid of taskKeys) {
    const row = byTask[tid];
    const avg = (a) => (a && a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
    const b = avg(row.bare_claude);
    const c = avg(row.claude_md_only);
    const h = avg(row.full_harness);
    const dhb = b != null && h != null ? h - b : "-";
    const dhc = c != null && h != null ? h - c : "-";
    const owasp = tid.match(/^owasp-(a\d+)/)?.[1]?.toUpperCase() ?? "?";
    lines.push(
      `| ${tid.replace(/^owasp-/, "")} | ${owasp} | ${b ?? "-"} | ${c ?? "-"} | ${h ?? "-"} | ${dhb} | ${dhc} |`,
    );
  }
  lines.push("");
  lines.push("## Hook firing (harness condition)");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|---|---:|");
  const harnessRuns = conditions.full_harness || [];
  const hookTotals = harnessRuns.map((r) => r.runMeta?.hookEventsTotal ?? 0);
  const hookBlocks = harnessRuns.map((r) => r.runMeta?.hookBlockCount ?? 0);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  lines.push(`| runs sampled | ${harnessRuns.length} |`);
  lines.push(
    `| total hook invocations | ${sum(hookTotals)} (avg ${harnessRuns.length ? (sum(hookTotals) / harnessRuns.length).toFixed(1) : 0}/run) |`,
  );
  lines.push(
    `| hook BLOCK actions | ${sum(hookBlocks)} (avg ${harnessRuns.length ? (sum(hookBlocks) / harnessRuns.length).toFixed(1) : 0}/run) |`,
  );
  lines.push("");
  lines.push("## Decision evaluation against PROTOCOL-v2 §7");
  lines.push("");
  const bcAxes = conditions.bare_claude.length ? averageAxes(conditions.bare_claude) : null;
  const cmoAxes = conditions.claude_md_only.length ? averageAxes(conditions.claude_md_only) : null;
  const fhAxes = conditions.full_harness.length ? averageAxes(conditions.full_harness) : null;
  if (bcAxes && fhAxes) {
    const totalGap = weightedTotal(fhAxes) - weightedTotal(bcAxes);
    const asvsGap = fhAxes.security_asvs - bcAxes.security_asvs;
    lines.push(
      `- **H1 (Security ASVS gap ≥ 15)**: full_harness − bare_claude = ${asvsGap.toFixed(0)} → ${asvsGap >= 15 ? "✅ MET" : "❌ NOT met"}`,
    );
    lines.push(
      `- **H3 (Weighted total gap ≥ 5)**: full_harness − bare_claude = ${totalGap.toFixed(1)} → ${totalGap >= 5 ? "✅ MET" : "❌ NOT met"}`,
    );
    if (cmoAxes) {
      const cmoTotal = weightedTotal(cmoAxes);
      const fhTotal = weightedTotal(fhAxes);
      const bcTotal = weightedTotal(bcAxes);
      const h5 = cmoTotal > bcTotal && cmoTotal < fhTotal;
      lines.push(
        `- **H5 (claude_md_only between bare and harness)**: bare=${bcTotal.toFixed(1)}, cmo=${cmoTotal.toFixed(1)}, harness=${fhTotal.toFixed(1)} → ${h5 ? "✅ MET" : "❌ INVERTED — cmo " + (cmoTotal > fhTotal ? "ABOVE" : "BELOW") + " harness"}`,
      );
    }
    const recommend = (() => {
      if (asvsGap >= 15 && totalGap >= 5) return "Ship full_harness as recommended default";
      if (asvsGap >= 15) return "Document harness as 'security-focused, cost-heavy (mixed)'";
      if (asvsGap < 0 && totalGap < 0) return "Deprecate harness — actively worse than bare_claude";
      return "Mixed signal — escalate to Slim stage with deeper investigation per §7";
    })();
    lines.push("");
    lines.push(`### Recommendation: **${recommend}**`);
    lines.push("");
  }
  lines.push("## Threats to Validity");
  lines.push("");
  lines.push(
    "- N=3 per cell; stage budget caps real-world run count. See PROTOCOL-v2.md §6.",
  );
  lines.push(
    "- Single model (claude-sonnet-4-6); generalization to other models not tested.",
  );
  lines.push(
    "- OWASP task set covers A01-A10 categories but only 15 prompts total; broader CyberSecEval 3 deferred.",
  );
  lines.push(
    "- CWE classifier uses conservative heuristics + optional semgrep. False-negatives likely.",
  );
  lines.push(
    "- Judge may still exhibit self-similarity bias even with blinding (judge and candidate both Claude).",
  );
  lines.push("");
  return lines.join("\n");
}

function fmt(v) {
  return typeof v === "number" ? String(v) : String(v);
}

function findLosses(conditions) {
  const bc = conditions.bare_claude.length ? averageAxes(conditions.bare_claude) : null;
  const fh = conditions.full_harness.length ? averageAxes(conditions.full_harness) : null;
  if (!bc || !fh) return [];
  const order = [
    ["functional_suitability", "Functional Suitability"],
    ["reliability", "Reliability"],
    ["security_asvs", "Security ASVS L2"],
    ["security_cwe", "Security CWE-weighted"],
    ["maintainability", "Maintainability"],
    ["perf_walltime", "Perf — Wall-time"],
    ["perf_cost", "Perf — Cost"],
    ["compatibility", "Compatibility"],
    ["dora_lead_time", "DORA Lead Time"],
    ["dora_cfr", "DORA CFR"],
    ["dora_mttr", "DORA MTTR"],
    ["usability", "Usability"],
    ["over_engineering", "Over-engineering↓"],
  ];
  const out = [];
  for (const [key, label] of order) {
    const d = fh[key] - bc[key];
    if (d < 0) out.push({ label, bc: bc[key], fh: fh[key], delta: d });
  }
  out.sort((a, b) => a.delta - b.delta);
  return out;
}

async function tryReadFile(p) {
  try {
    return await readFile(p, "utf8");
  } catch {
    return null;
  }
}

async function loadTasks() {
  const dir = path.join(BENCHMARKS_ROOT, "tasks", "owasp");
  const out = {};
  if (!existsSync(dir)) return out;
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md"));
  for (const f of files) {
    const t = await parseTask(path.join(dir, f));
    out[t.id] = t;
  }
  return out;
}

async function main() {
  const { verify, stage, out, skipJudge } = parseArgs(process.argv);
  if (verify) {
    verifyWeights();
    return;
  }

  verifyWeights();
  const runIds = await discoverRuns(stage);
  if (!runIds.length) {
    console.error(`[aggregate] no runs found for stage=${stage}`);
    process.exit(1);
  }
  const tasks = await loadTasks();

  const scored = [];
  for (const runId of runIds) {
    const runDir = path.join(BENCHMARKS_ROOT, "results", "raw", runId);
    const run = await loadRun(runDir);
    if (!run) continue;
    const s = await scoreSingleRun(run, tasks, { skipJudge });
    if (s.error) continue;
    scored.push({
      ...s,
      condition: run.condition.condition,
      taskId: run.condition.taskId,
      runMeta: {
        hookEventsTotal: run.summary.hookEventsTotal,
        hookBlockCount: run.summary.hookBlockCount,
        costUsd: run.summary.costUsd,
      },
    });
  }
  const { maxTime, maxCost } = normalizePerfAxes(scored);
  const conditions = groupByCondition(scored);
  const report = await renderReport(stage, conditions, null, maxTime, maxCost);
  const outPath = out || path.join(BENCHMARKS_ROOT, "reports", `${stage}-report.md`);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, report, "utf8");

  // Also write machine-readable aggregated.json
  const agg = {
    stage,
    generatedAt: new Date().toISOString(),
    normalization: { maxWallTimeMs: maxTime, maxCostUsd: maxCost },
    conditions: Object.fromEntries(
      Object.entries(conditions).map(([c, rs]) => {
        const axes = rs.length ? averageAxes(rs) : null;
        return [
          c,
          {
            n: rs.length,
            axes,
            weightedTotal: axes ? weightedTotal(axes) : null,
          },
        ];
      }),
    ),
    weights: WEIGHTS,
  };
  await writeFile(
    path.join(BENCHMARKS_ROOT, "results", `${stage}-aggregated.json`),
    JSON.stringify(agg, null, 2),
    "utf8",
  );
  console.log(`[aggregate] wrote ${outPath}`);
  console.log(JSON.stringify(agg.conditions, null, 2));
}

// CLI entry
const invokedDirect =
  process.argv[1] &&
  import.meta.url.replace(/\\/g, "/").endsWith(process.argv[1].replace(/\\/g, "/"));
if (invokedDirect) {
  main().catch((e) => {
    console.error("[aggregate] fatal:", e);
    process.exit(1);
  });
}
