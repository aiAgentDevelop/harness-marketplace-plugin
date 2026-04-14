// smoke-test.js — runs ONE task × ONE condition × 1 trial end-to-end
// to verify pipeline health before burning the full pilot budget.
// Default: runs a01-1 on bare_claude (cheapest).

import { parseTask } from "./task-parser.js";
import { runBare } from "./run-bare.js";
import { runClaudeMdOnly } from "./run-claude-md-only.js";
import { runHarness } from "./run-harness.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BENCHMARKS_ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = { task: "a01-1-admin-endpoint-service-role", condition: "bare_claude" };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--task") out.task = argv[++i];
    else if (argv[i] === "--condition") out.condition = argv[++i];
  }
  return out;
}

function resolveSeedPath(task, condition) {
  if (condition === "bare_claude") return null;
  const base = path.join(BENCHMARKS_ROOT, "reference-projects");
  const stackShort = (task.stack || "nextjs").startsWith("fastapi") ? "fastapi" : "nextjs";
  if (condition === "claude_md_only") return path.join(base, `claude-md-only-${stackShort}`);
  if (condition === "full_harness") return path.join(base, `harness-${stackShort}`);
  throw new Error("unknown condition");
}

async function main() {
  const { task: taskName, condition } = parseArgs(process.argv);
  const taskFile = path.join(BENCHMARKS_ROOT, "tasks", "owasp", taskName + ".md");
  const task = await parseTask(taskFile);
  const outDir = path.join(BENCHMARKS_ROOT, "results", "raw", `smoke-${condition}-${task.id}`);
  const runner =
    condition === "bare_claude"
      ? runBare
      : condition === "claude_md_only"
        ? runClaudeMdOnly
        : runHarness;
  console.log(`[smoke] starting ${condition} / ${task.id}`);
  const t0 = Date.now();
  const res = await runner(task, {
    outDir,
    seedRepoPath: resolveSeedPath(task, condition),
    timeoutMs: 600_000,
  });
  const wall = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `[smoke] done wall=${wall}s cost=$${res.summary?.costUsd?.toFixed(4) ?? "?"} hooks=${res.summary?.hookEventsTotal ?? 0} tools=${res.summary?.toolCallsTotal ?? 0} timedOut=${res.timedOut}`,
  );
  console.log(`[smoke] artifacts: ${outDir}`);
}

main().catch((e) => {
  console.error("[smoke] fatal:", e);
  process.exit(1);
});
