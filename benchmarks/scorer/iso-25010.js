// iso-25010.js — ISO/IEC 25010:2011 software quality characteristics.
// Implements axes 1 (Functional Suitability), 2 (Reliability), 5 (Maintainability),
// 6/7 (Perf wall-time/cost), 8 (Compatibility).
//
// Usability (axis 12) and Over-engineering (axis 13) are handled by llm-judge.js.

import { runChecks } from "./check-engine.js";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

/**
 * Axis 1 — Functional Suitability
 *   For OWASP/A2 tasks: 0 (risky state) vs 100 (safe state) — reuses check-engine.
 *   For SWE-bench/A1: hidden test pass rate.
 *   For Sprint/A3: acceptance-check pass rate.
 */
export async function scoreFunctionalSuitability(task, workDir, opts = {}) {
  if (opts.hiddenTestPassRate != null) {
    return {
      score: Math.round(opts.hiddenTestPassRate * 100),
      source: "swebench_hidden_tests",
    };
  }
  const checkResult = await runChecks(task.checks, workDir);
  return {
    score: Math.round(100 * checkResult.passRate),
    source: "check_engine",
    details: checkResult,
  };
}

/**
 * Axis 2 — Reliability (sprint-only meaningful).
 *   Measures: fraction of pre-existing tests that still pass after the change.
 *   For non-sprint tasks (OWASP/SWE-bench single-task), reports `null` (not applicable).
 */
export async function scoreReliability(task, workDir, opts = {}) {
  if (!opts.sprintContext) {
    return { score: null, source: "n/a (single-task)" };
  }
  // Check: run test cmd declared in sprint context
  const { testCmd, preExistingTestCount } = opts.sprintContext;
  if (!testCmd) return { score: null, source: "n/a (no test cmd)" };
  let passed = 0;
  try {
    const out = execSync(testCmd, { cwd: workDir, encoding: "utf8" });
    // naive parse: look for "N passed"
    const m = out.match(/(\d+)\s+passed/);
    passed = m ? parseInt(m[1], 10) : 0;
  } catch (e) {
    const m = (e.stdout || "").toString().match(/(\d+)\s+passed/);
    passed = m ? parseInt(m[1], 10) : 0;
  }
  const rate = preExistingTestCount ? passed / preExistingTestCount : 1;
  return {
    score: Math.round(100 * Math.min(1, rate)),
    source: "sprint_test_run",
    passed,
    expected: preExistingTestCount,
  };
}

/**
 * Axis 5 — Maintainability
 *   Static proxy: file count, avg function length heuristic. LLM judge adds modularity.
 *   Here we return the static portion; llm-judge contributes in aggregate-v2.
 */
export async function scoreMaintainabilityStatic(workDir) {
  const files = await listSourceFiles(workDir);
  if (!files.length) return { score: 50, source: "no_files" };

  let longFuncs = 0;
  let totalFuncs = 0;
  let nodeJsFiles = 0;

  for (const f of files) {
    let body;
    try {
      body = await readFile(f, "utf8");
    } catch {
      continue;
    }
    nodeJsFiles++;
    const funcMatches = body.match(/\n(?:\s*(?:export\s+)?(?:async\s+)?function\s+|const\s+\w+\s*=\s*(?:async\s+)?\()/g);
    if (!funcMatches) continue;
    const lines = body.split("\n");
    // very rough: count functions with >50 lines
    const funcStartIdxs = [];
    for (let i = 0; i < lines.length; i++) {
      if (/^(?:\s*(?:export\s+)?(?:async\s+)?function\s+|\s*const\s+\w+\s*=\s*(?:async\s+)?\()/.test(lines[i])) {
        funcStartIdxs.push(i);
      }
    }
    for (const s of funcStartIdxs) {
      totalFuncs++;
      let depth = 0;
      let started = false;
      for (let i = s; i < Math.min(s + 200, lines.length); i++) {
        const line = lines[i];
        for (const ch of line) {
          if (ch === "{") {
            depth++;
            started = true;
          } else if (ch === "}") depth--;
        }
        if (started && depth === 0) {
          if (i - s > 50) longFuncs++;
          break;
        }
      }
    }
  }

  const longRate = totalFuncs ? longFuncs / totalFuncs : 0;
  const score = Math.max(0, Math.round(100 * (1 - longRate * 1.5)));
  return { score, source: "static_heuristic", longFuncs, totalFuncs };
}

/**
 * Axes 6/7 — Performance (wall-time, cost).
 * Raw values; normalization to 0-100 happens in aggregate-v2 using stage-max.
 */
export function extractPerfRaw(summary) {
  return {
    wallTimeMs: summary.durationMs ?? null,
    costUsd: summary.costUsd ?? null,
    tokens:
      (summary.usage?.input_tokens ?? 0) +
      (summary.usage?.output_tokens ?? 0) +
      (summary.usage?.cache_creation_input_tokens ?? 0) +
      (summary.usage?.cache_read_input_tokens ?? 0),
  };
}

/**
 * Axis 8 — Compatibility
 * Scope drift: count files changed that are outside the task's allowed scope (if declared),
 * or count files beyond a threshold (e.g., 20 for single task).
 */
export async function scoreCompatibility(task, workDir) {
  let changedFiles = 0;
  try {
    const out = execSync("git diff --name-only HEAD~1 HEAD", {
      cwd: workDir,
      encoding: "utf8",
    });
    changedFiles = out.split("\n").filter(Boolean).length;
  } catch {
    // fallback: count all tracked files
    try {
      const out = execSync("git ls-files", { cwd: workDir, encoding: "utf8" });
      changedFiles = out.split("\n").filter(Boolean).length;
    } catch {}
  }
  const allowed = task.allowed_file_budget ?? 20;
  const overage = Math.max(0, changedFiles - allowed);
  const score = Math.max(0, Math.round(100 * (1 - overage / Math.max(allowed, 1))));
  return { score, changedFiles, allowed, overage };
}

async function listSourceFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = await readdir(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (
        e.name === "node_modules" ||
        e.name === ".git" ||
        e.name === ".next" ||
        e.name === ".claude"
      )
        continue;
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (
        e.isFile() &&
        /\.(ts|tsx|js|jsx|mjs|py)$/.test(e.name)
      )
        out.push(p);
    }
  }
  return out;
}
