// batch.js — Fan-out orchestrator for pilot/slim/full stages.
// Enforces: shuffle with pre-registered seed, max 3 concurrent runs, budget ceiling, honest partial-data policy.

import { parseTask } from "./task-parser.js";
import { runBare } from "./run-bare.js";
import { runClaudeMdOnly } from "./run-claude-md-only.js";
import { runHarness } from "./run-harness.js";
import { mkdir, readdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BENCHMARKS_ROOT = path.resolve(__dirname, "..");
const RESULTS_ROOT = path.join(BENCHMARKS_ROOT, "results");

const BUDGET_USD = {
  pilot: 40,
  slim: 120,
  full: 350,
};

const STAGE_N = {
  pilot: 2, // reduced per PROTOCOL-v2 amendment 2026-04-13 (budget safety)
  slim: 3,
  full: 3,
};

function parseArgs(argv) {
  const out = {
    stage: "pilot",
    seed: "20260413",
    concurrency: 3,
    dryRun: false,
    limit: Infinity,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--stage") out.stage = argv[++i];
    else if (a === "--seed") out.seed = argv[++i];
    else if (a === "--concurrency") out.concurrency = parseInt(argv[++i], 10);
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--limit") out.limit = parseInt(argv[++i], 10);
  }
  return out;
}

// Simple deterministic shuffle (Fisher-Yates w/ seeded mulberry32)
function seededShuffle(arr, seed) {
  const a = [...arr];
  const s = hashStr(String(seed));
  const rng = mulberry32(s);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

async function loadOwaspTasks() {
  const dir = path.join(BENCHMARKS_ROOT, "tasks", "owasp");
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md"));
  const tasks = [];
  for (const f of files) {
    tasks.push(await parseTask(path.join(dir, f)));
  }
  return tasks;
}

async function loadStageTasks(stage) {
  const owasp = await loadOwaspTasks();
  if (stage === "pilot") return { A2: owasp, A1: [], A3: [] };
  // Slim/Full wiring kept minimal for now — extended in S8/S9
  return { A2: owasp, A1: [], A3: [] };
}

function resolveSeedPath(task, condition) {
  if (condition === "bare_claude") return null;
  const base = path.join(BENCHMARKS_ROOT, "reference-projects");
  // Task frontmatter uses stack names like "nextjs-supabase" / "fastapi-postgres".
  // Seed dirs use short names "nextjs" / "fastapi".
  const stackShort = (task.stack || "nextjs-supabase").startsWith("fastapi")
    ? "fastapi"
    : "nextjs";
  if (condition === "claude_md_only") {
    return path.join(base, `claude-md-only-${stackShort}`);
  }
  if (condition === "full_harness") {
    return path.join(base, `harness-${stackShort}`);
  }
  throw new Error(`unknown condition: ${condition}`);
}

async function runCell(task, condition, trialIdx, stage) {
  const runId = `${stage}-${task.id}-${condition}-t${trialIdx}`;
  const outDir = path.join(RESULTS_ROOT, "raw", runId);
  if (existsSync(path.join(outDir, "summary.json"))) {
    return { runId, skipped: true };
  }
  const opts = {
    outDir,
    seedRepoPath: resolveSeedPath(task, condition),
    timeoutMs: task.timeout_ms ?? 900_000,
  };
  const runner =
    condition === "bare_claude"
      ? runBare
      : condition === "claude_md_only"
        ? runClaudeMdOnly
        : runHarness;
  try {
    const res = await runner(task, opts);
    return { runId, summary: res.summary, timedOut: res.timedOut };
  } catch (err) {
    return { runId, error: String(err?.stack || err) };
  }
}

async function main() {
  const { stage, seed, concurrency, dryRun, limit } = parseArgs(process.argv);
  const { A2 } = await loadStageTasks(stage);
  const n = STAGE_N[stage] ?? 3;
  const conditions = ["bare_claude", "claude_md_only", "full_harness"];
  const cells = [];
  for (const task of A2) {
    for (const c of conditions) {
      for (let t = 0; t < n; t++) {
        cells.push({ task, condition: c, trialIdx: t });
      }
    }
  }
  const shuffled = seededShuffle(cells, seed);

  const budget = BUDGET_USD[stage];
  console.log(
    `[batch] stage=${stage} cells=${shuffled.length} N=${n} concurrency=${concurrency} budget_usd=${budget} seed=${seed}`,
  );

  if (dryRun) {
    const preview = shuffled.slice(0, 5).map((c) => ({
      taskId: c.task.id,
      condition: c.condition,
      trial: c.trialIdx,
    }));
    console.log("[dry-run] first 5:", preview);
    return;
  }

  // Filter to cells that don't have summary.json already — makes runs resumable
  const pending = shuffled.filter((c) => {
    const runId = `${stage}-${c.task.id}-${c.condition}-t${c.trialIdx}`;
    const existing = path.join(RESULTS_ROOT, "raw", runId, "summary.json");
    return !existsSync(existing);
  });
  console.log(
    `[batch] resumable: ${shuffled.length - pending.length} already done, ${pending.length} remaining`,
  );
  const toRun = pending.slice(0, limit);
  console.log(
    `[batch] this chunk: ${toRun.length} (limit=${limit === Infinity ? "none" : limit})`,
  );

  // Throttled parallel execution
  let totalCost = 0;
  let done = 0;
  let aborted = false;
  const results = [];

  async function worker(queue) {
    while (queue.length && !aborted) {
      const cell = queue.shift();
      const res = await runCell(cell.task, cell.condition, cell.trialIdx, stage);
      if (res.summary?.costUsd) totalCost += res.summary.costUsd;
      done++;
      const costStr = `$${totalCost.toFixed(2)}/$${budget}`;
      console.log(
        `[${done}/${shuffled.length}] ${cell.condition} ${cell.task.id} t${cell.trialIdx} cost=${costStr} ${res.error ? "ERR" : res.skipped ? "skip" : "ok"}`,
      );
      results.push({ cell, res });
      if (totalCost > budget) {
        console.error(`[ABORT] budget exceeded: ${costStr}`);
        aborted = true;
      }
    }
  }

  const queue = [...toRun];
  const workers = Array.from({ length: concurrency }, () => worker(queue));
  await Promise.all(workers);

  await writeFile(
    path.join(RESULTS_ROOT, `${stage}-manifest.json`),
    JSON.stringify(
      {
        stage,
        seed,
        cellsPlanned: shuffled.length,
        cellsCompleted: done,
        totalCostUsd: totalCost,
        budgetUsd: budget,
        aborted,
        completedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(
    `[done] stage=${stage} completed=${done}/${shuffled.length} cost=$${totalCost.toFixed(2)}`,
  );
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
