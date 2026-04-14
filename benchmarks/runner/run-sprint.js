// run-sprint.js — Sequential 8-step sprint runner with state carry-over.
//
// Each sprint is a directory of step-NN-*.md tasks. The runner:
// 1. Initializes a workdir from the seed (per condition)
// 2. For each step in order:
//    - Reads task markdown via parseTask
//    - Invokes the same condition-specific runner (bare/cmo/harness)
//    - Captures step-level summary + check results + git state
//    - Carries the workdir forward to the next step
// 3. Writes per-step subdirs under outDir/step-NN/ and a top-level sprint-summary.json
//
// Design: regression-loop measurement. Step K may modify files created in step <K.
// If step K's check fails on a file from step <K (regression), DORA CFR registers it.
// MTTR is measured if the next step recovers (its check passes).

import { invokeClaude } from "./invoke.js";
import { parseTask } from "./task-parser.js";
import { mkdir, writeFile, rm, readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BENCHMARKS_ROOT = path.resolve(__dirname, "..");

/**
 * @param {Object} opts
 * @param {string} opts.sprintDir   - path to a tasks/sprint-{name} directory
 * @param {string} opts.condition   - "bare_claude" | "claude_md_only" | "full_harness"
 * @param {string} opts.outDir      - per-sprint-run output dir
 * @param {string} [opts.seedRepoPath] - reference-projects directory (null for bare_claude)
 * @param {number} [opts.timeoutMs]
 */
export async function runSprint(opts) {
  const { sprintDir, condition, outDir, seedRepoPath, timeoutMs = 900_000 } = opts;
  await mkdir(outDir, { recursive: true });

  // Build initial workdir
  let workDir = path.join(outDir, "workdir");
  if (existsSync(workDir)) {
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch {
      workDir = path.join(outDir, "workdir_" + Date.now());
    }
  }
  await mkdir(workDir, { recursive: true });
  if (seedRepoPath) {
    if (!existsSync(seedRepoPath))
      throw new Error("seed missing: " + seedRepoPath);
    copyDir(seedRepoPath, workDir);
  }

  // Init git
  try {
    execSync("git init -q", { cwd: workDir });
    execSync('git config user.email "benchmark@local"', { cwd: workDir });
    execSync('git config user.name "benchmark"', { cwd: workDir });
    execSync('git add -A && git commit -q --allow-empty -m "sprint seed"', {
      cwd: workDir,
    });
  } catch {}
  if (!existsSync(path.join(workDir, ".git"))) {
    throw new Error("sprint git init failed in " + workDir);
  }

  // Discover steps
  const stepFiles = (await readdir(sprintDir))
    .filter((f) => /^step-\d{2}-.*\.md$/.test(f))
    .sort();

  const stepResults = [];
  let cumulativeCost = 0;
  for (const stepFile of stepFiles) {
    const step = parseInt(stepFile.match(/^step-(\d{2})/)[1], 10);
    const task = await parseTask(path.join(sprintDir, stepFile));
    const stepOut = path.join(outDir, `step-${String(step).padStart(2, "0")}`);
    await mkdir(stepOut, { recursive: true });

    const beforeSha = safeExec("git rev-parse HEAD", workDir);
    const t0 = Date.now();
    const { summary, timedOut } = await invokeClaude({
      prompt: task.prompt,
      cwd: workDir,
      outDir: stepOut,
      timeoutMs,
    });
    const stepWall = Date.now() - t0;

    // Commit final state for diff inspection
    try {
      execSync("git add -A", { cwd: workDir });
      execSync(
        `git commit -q --allow-empty -m "post-step-${step}"`,
        { cwd: workDir },
      );
    } catch {}
    const afterSha = safeExec("git rev-parse HEAD", workDir);
    const filesChanged = safeExec(
      `git diff --name-only ${beforeSha} ${afterSha}`,
      workDir,
    )
      .split("\n")
      .filter(Boolean);
    cumulativeCost += summary.costUsd ?? 0;

    // Run THIS step's checks
    const { runChecks } = await import("../scorer/check-engine.js");
    const checkResult = await runChecks(task.checks, workDir);

    // Regression detection: re-run all PRIOR steps' checks on current workdir.
    // If a previously-passing step now fails any of its checks, that's a regression.
    let regressionDetected = false;
    let regressionStep = null;
    for (const prior of stepResults) {
      if (!prior.checkResult) continue;
      // Re-evaluate prior step's checks against CURRENT workdir state
      const reCheck = await runChecks(prior.task.checks, workDir);
      if (reCheck.passRate < prior.checkResult.passRate - 0.01) {
        regressionDetected = true;
        regressionStep = prior.step;
        break;
      }
    }

    stepResults.push({
      step,
      taskId: task.id,
      task,
      durationMs: stepWall,
      costUsd: summary.costUsd ?? 0,
      timedOut,
      hookEventsTotal: summary.hookEventsTotal ?? 0,
      hookBlockCount: summary.hookBlockCount ?? 0,
      toolCallsTotal: summary.toolCallsTotal ?? 0,
      filesChanged,
      checkResult,
      regressionObserved: regressionDetected,
      regressionAgainstStep: regressionStep,
      // Recovery: if PREVIOUS step had a regression, did THIS step recover it?
      recoveryMs:
        stepResults.length &&
        stepResults[stepResults.length - 1].regressionObserved &&
        !regressionDetected
          ? stepWall
          : null,
    });

    await writeFile(
      path.join(stepOut, "step.json"),
      JSON.stringify(stepResults[stepResults.length - 1], null, 2),
      "utf8",
    );

    console.log(
      `[sprint ${condition}] step ${step}/${stepFiles.length}: ${task.id} ` +
        `wall=${(stepWall / 1000).toFixed(1)}s cost=$${(summary.costUsd ?? 0).toFixed(3)} ` +
        `checks=${checkResult.pass}/${checkResult.total} ` +
        `regression=${regressionDetected} hooks=${summary.hookBlockCount ?? 0}b`,
    );
  }

  const sprintSummary = {
    sprint: path.basename(sprintDir),
    condition,
    seedRepoPath,
    totalDurationMs: stepResults.reduce((a, s) => a + s.durationMs, 0),
    totalCostUsd: cumulativeCost,
    totalHookBlocks: stepResults.reduce((a, s) => a + (s.hookBlockCount || 0), 0),
    steps: stepResults.map((s) => ({
      step: s.step,
      taskId: s.taskId,
      durationMs: s.durationMs,
      costUsd: s.costUsd,
      checkPass: s.checkResult.pass,
      checkTotal: s.checkResult.total,
      regressionObserved: s.regressionObserved,
      regressionAgainstStep: s.regressionAgainstStep,
      recoveryMs: s.recoveryMs,
    })),
  };
  await writeFile(
    path.join(outDir, "sprint-summary.json"),
    JSON.stringify(sprintSummary, null, 2),
    "utf8",
  );
  await writeFile(
    path.join(outDir, "condition.json"),
    JSON.stringify(
      { condition, sprint: path.basename(sprintDir), kind: "sprint" },
      null,
      2,
    ),
    "utf8",
  );
  return sprintSummary;
}

function safeExec(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function copyDir(src, dst) {
  if (process.platform === "win32") {
    execSync(`xcopy "${src}" "${dst}" /E /I /H /Y >NUL`, { shell: true });
  } else {
    execSync(`cp -R "${src}"/. "${dst}"`, { shell: true });
  }
}

// CLI
if (
  process.argv[1] &&
  import.meta.url.replace(/\\/g, "/").endsWith(process.argv[1].replace(/\\/g, "/"))
) {
  const args = { sprint: null, condition: null, outDir: null };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === "--sprint") args.sprint = process.argv[++i];
    else if (a === "--condition") args.condition = process.argv[++i];
    else if (a === "--out") args.outDir = process.argv[++i];
  }
  if (!args.sprint || !args.condition || !args.outDir) {
    console.error("usage: run-sprint.js --sprint <name> --condition <c> --out <dir>");
    process.exit(1);
  }
  const sprintDir = path.join(BENCHMARKS_ROOT, "tasks", args.sprint);
  const stack = args.sprint.includes("fastapi") ? "fastapi" : "nextjs";
  let seed = null;
  if (args.condition === "claude_md_only")
    seed = path.join(BENCHMARKS_ROOT, "reference-projects", `claude-md-only-${stack}`);
  else if (args.condition === "full_harness")
    seed = path.join(BENCHMARKS_ROOT, "reference-projects", `harness-${stack}`);
  await runSprint({
    sprintDir,
    condition: args.condition,
    outDir: args.outDir,
    seedRepoPath: seed,
  });
}
