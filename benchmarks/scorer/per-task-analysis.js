// per-task-analysis.js — Diagnostic: show per-task ASVS score breakdown across conditions.
// Helps identify where harness actually beats or loses.
import { parseTask } from "../runner/task-parser.js";
import { scoreAsvs } from "./asvs-mapper.js";
import { scoreCwe } from "./cwe-classifier.js";
import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BENCHMARKS_ROOT = path.resolve(__dirname, "..");

async function main() {
  const taskDir = path.join(BENCHMARKS_ROOT, "tasks", "owasp");
  const files = (await readdir(taskDir)).filter((f) => f.endsWith(".md")).sort();
  const rows = [];
  for (const f of files) {
    const task = await parseTask(path.join(taskDir, f));
    const row = { task: task.id };
    for (const cond of ["bare_claude", "claude_md_only", "full_harness"]) {
      let asvsPass = 0;
      let asvsTotal = 0;
      let cweP = 0;
      let cweT = 0;
      for (const t of ["t0", "t1"]) {
        const runDir = path.join(
          BENCHMARKS_ROOT,
          "results",
          "raw",
          `pilot-${task.id}-${cond}-${t}`,
        );
        if (!existsSync(path.join(runDir, "summary.json"))) continue;
        const workDir = path.join(runDir, "workdir");
        if (!existsSync(workDir)) continue;
        const asvs = await scoreAsvs(task, workDir);
        asvsPass += asvs.hits.length;
        asvsTotal += task.asvs?.length ?? 1;
        const cwe = await scoreCwe(workDir);
        cweP += cwe.score;
        cweT++;
      }
      row[cond + "_asvs"] = asvsTotal
        ? Math.round((100 * asvsPass) / asvsTotal)
        : "-";
      row[cond + "_cwe"] = cweT ? Math.round(cweP / cweT) : "-";
    }
    rows.push(row);
  }

  // ASVS table
  console.log("ASVS safe rate per task (0-100, higher=safer)");
  console.log(
    "task".padEnd(45) +
      "bare".padStart(8) +
      "cmo".padStart(8) +
      "harness".padStart(10) +
      "Δ(h-b)".padStart(10) +
      "Δ(h-c)".padStart(10),
  );
  for (const r of rows) {
    const b = r.bare_claude_asvs;
    const c = r.claude_md_only_asvs;
    const h = r.full_harness_asvs;
    const dhb = typeof b === "number" && typeof h === "number" ? h - b : "-";
    const dhc = typeof c === "number" && typeof h === "number" ? h - c : "-";
    console.log(
      r.task.slice(0, 45).padEnd(45) +
        String(b).padStart(8) +
        String(c).padStart(8) +
        String(h).padStart(10) +
        String(dhb).padStart(10) +
        String(dhc).padStart(10),
    );
  }
  console.log();
  console.log("CWE-weighted score per task (0-100, higher=fewer defects)");
  console.log(
    "task".padEnd(45) +
      "bare".padStart(8) +
      "cmo".padStart(8) +
      "harness".padStart(10),
  );
  for (const r of rows) {
    console.log(
      r.task.slice(0, 45).padEnd(45) +
        String(r.bare_claude_cwe).padStart(8) +
        String(r.claude_md_only_cwe).padStart(8) +
        String(r.full_harness_cwe).padStart(10),
    );
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
