// judge-batch.js — Pre-compute judge.json cache files for all runs in a stage,
// with concurrency. Aggregate-v2 reads the cache files.
//
// Usage: node scorer/judge-batch.js --stage pilot --concurrency 4 --limit 200

import { judgeRun } from "./llm-judge.js";
import { parseTask } from "../runner/task-parser.js";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BENCHMARKS_ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = { stage: "pilot", concurrency: 3, limit: Infinity };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--stage") out.stage = argv[++i];
    else if (argv[i] === "--concurrency") out.concurrency = parseInt(argv[++i], 10);
    else if (argv[i] === "--limit") out.limit = parseInt(argv[++i], 10);
  }
  return out;
}

async function loadTasks() {
  const out = {};
  for (const dir of ["owasp"]) {
    const d = path.join(BENCHMARKS_ROOT, "tasks", dir);
    if (!existsSync(d)) continue;
    for (const f of (await readdir(d)).filter((f) => f.endsWith(".md"))) {
      const t = await parseTask(path.join(d, f));
      out[t.id] = t;
    }
  }
  return out;
}

async function main() {
  const { stage, concurrency, limit } = parseArgs(process.argv);
  const rawDir = path.join(BENCHMARKS_ROOT, "results", "raw");
  const tasks = await loadTasks();
  const all = (await readdir(rawDir)).filter((x) => x.startsWith(`${stage}-`));
  // Build a todo list: runs with summary.json but no judge.json
  const todo = [];
  for (const runId of all) {
    const runDir = path.join(rawDir, runId);
    if (!existsSync(path.join(runDir, "summary.json"))) continue;
    if (existsSync(path.join(runDir, "judge.json"))) continue;
    const cond = JSON.parse(await readFile(path.join(runDir, "condition.json"), "utf8"));
    const task = tasks[cond.taskId];
    if (!task) continue;
    const summary = JSON.parse(await readFile(path.join(runDir, "summary.json"), "utf8"));
    todo.push({ runId, runDir, task, summary });
  }
  const sliced = todo.slice(0, limit);
  console.log(
    `[judge-batch] stage=${stage} todo=${todo.length} running=${sliced.length} concurrency=${concurrency}`,
  );

  let done = 0;
  const queue = [...sliced];
  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      try {
        const res = await judgeRun(
          item.task.prompt,
          item.summary.finalAssistantText || "",
          item.summary.diffStat || "",
        );
        await writeFile(
          path.join(item.runDir, "judge.json"),
          JSON.stringify(res, null, 2),
          "utf8",
        );
        done++;
        const u = res.usability_score ?? "?";
        const o = res.overengineering_score ?? "?";
        console.log(
          `[${done}/${sliced.length}] ${item.runId}: u=${u} oe=${o}`,
        );
      } catch (e) {
        console.error(`[err] ${item.runId}:`, String(e).slice(0, 200));
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  console.log(`[judge-batch] done ${done}/${sliced.length}`);
}

main().catch((e) => {
  console.error("[judge-batch] fatal:", e);
  process.exit(1);
});
