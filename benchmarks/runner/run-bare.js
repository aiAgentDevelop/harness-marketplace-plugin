// run-bare.js — Condition C1: plain claude -p in empty git repo, no seed, no CLAUDE.md, no skills.
// Used as the baseline reference. If full_harness doesn't beat this, the plugin has no value.

import { invokeClaude } from "./invoke.js";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

/**
 * Run a single task in the bare_claude condition.
 * @param {Object} task   - Parsed task def (see tasks/*.md frontmatter).
 * @param {Object} opts
 * @param {string} opts.outDir - Where per-run artifacts go.
 * @param {string} [opts.seedRepoPath] - If set, copy this dir as starting state (otherwise empty).
 * @param {number} [opts.timeoutMs]
 */
export async function runBare(task, opts) {
  const { outDir, seedRepoPath = null, timeoutMs = 900_000 } = opts;
  await mkdir(outDir, { recursive: true });

  // Build a clean per-run working copy. On Windows, file handles may still be
  // held by a previously-killed child process — fall back to a timestamped dir.
  let workDir = path.join(outDir, "workdir");
  if (existsSync(workDir)) {
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch {
      workDir = path.join(outDir, "workdir_" + Date.now());
    }
  }
  await mkdir(workDir, { recursive: true });

  if (seedRepoPath && existsSync(seedRepoPath)) {
    // Copy seed as starting state
    copyDir(seedRepoPath, workDir);
  }

  // Initialize git for diff analysis
  try {
    execSync("git init -q", { cwd: workDir });
    execSync('git config user.email "benchmark@local"', { cwd: workDir });
    execSync('git config user.name "benchmark"', { cwd: workDir });
    execSync('git add -A && git commit -q --allow-empty -m "baseline"', {
      cwd: workDir,
    });
  } catch {}

  // Hard guard: refuse to proceed if workDir/.git wasn't created. Otherwise
  // subsequent git ops walk up and contaminate the outer repository.
  if (!existsSync(path.join(workDir, ".git"))) {
    throw new Error("git init failed in " + workDir);
  }

  const beforeSha = safeExec("git rev-parse HEAD", workDir);

  const prompt = task.prompt;
  const { summary, timedOut } = await invokeClaude({
    prompt,
    cwd: workDir,
    outDir,
    timeoutMs,
  });

  // Commit final state so diff is inspectable
  try {
    execSync("git add -A", { cwd: workDir });
    execSync('git commit -q --allow-empty -m "post-run final state"', {
      cwd: workDir,
    });
  } catch {}

  const afterSha = safeExec("git rev-parse HEAD", workDir);
  const diff = safeExec(`git diff --stat ${beforeSha} ${afterSha}`, workDir);

  await writeFile(
    path.join(outDir, "condition.json"),
    JSON.stringify(
      {
        condition: "bare_claude",
        taskId: task.id,
        beforeSha,
        afterSha,
        diffStat: diff,
      },
      null,
      2,
    ),
    "utf8",
  );

  return { summary, workDir, timedOut };
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
    // Use robocopy for reliability on Windows
    execSync(`xcopy "${src}" "${dst}" /E /I /H /Y >NUL`, { shell: true });
  } else {
    execSync(`cp -R "${src}"/. "${dst}"`, { shell: true });
  }
}

// CLI
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`) {
  const [, , taskPath, outDir] = process.argv;
  if (!taskPath || !outDir) {
    console.error("usage: node run-bare.js <task.md> <outDir>");
    process.exit(1);
  }
  const { parseTask } = await import("./task-parser.js");
  const task = await parseTask(taskPath);
  await runBare(task, { outDir });
  console.log("done:", outDir);
}
