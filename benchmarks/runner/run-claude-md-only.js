// run-claude-md-only.js — Condition C2: seed project + project-root CLAUDE.md only.
// No skills/, no hooks, no agents. Isolates the orchestration-by-default effect of CLAUDE.md.

import { invokeClaude } from "./invoke.js";
import { mkdir, writeFile, rm, cp, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

/**
 * @param {Object} task
 * @param {Object} opts
 * @param {string} opts.outDir
 * @param {string} opts.seedRepoPath    - e.g., reference-projects/claude-md-only-nextjs/
 * @param {number} [opts.timeoutMs]
 */
export async function runClaudeMdOnly(task, opts) {
  const { outDir, seedRepoPath, timeoutMs = 900_000 } = opts;
  if (!seedRepoPath || !existsSync(seedRepoPath)) {
    throw new Error(
      `run-claude-md-only requires seedRepoPath (got: ${seedRepoPath})`,
    );
  }
  await mkdir(outDir, { recursive: true });

  let workDir = path.join(outDir, "workdir");
  if (existsSync(workDir)) {
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch {
      workDir = path.join(outDir, "workdir_" + Date.now());
    }
  }
  await mkdir(workDir, { recursive: true });
  copyDir(seedRepoPath, workDir);

  // Strip any .claude/skills or .claude/agents dir that may have been copied — C2 is MD only
  const skillsDir = path.join(workDir, ".claude", "skills");
  const agentsDir = path.join(workDir, ".claude", "agents");
  const hooksDir = path.join(workDir, ".claude", "hooks");
  const settingsFile = path.join(workDir, ".claude", "settings.json");
  for (const d of [skillsDir, agentsDir, hooksDir]) {
    if (existsSync(d)) await rm(d, { recursive: true, force: true });
  }
  // Neutralize settings.json (remove hook wiring) but keep the file for parity
  if (existsSync(settingsFile)) {
    await writeFile(settingsFile, "{}\n", "utf8");
  }

  try {
    execSync("git init -q", { cwd: workDir });
    execSync('git config user.email "benchmark@local"', { cwd: workDir });
    execSync('git config user.name "benchmark"', { cwd: workDir });
    execSync('git add -A && git commit -q --allow-empty -m "seed baseline"', {
      cwd: workDir,
    });
  } catch {}

  if (!existsSync(path.join(workDir, ".git"))) {
    throw new Error("git init failed in " + workDir);
  }

  const beforeSha = safeExec("git rev-parse HEAD", workDir);
  const { summary, timedOut } = await invokeClaude({
    prompt: task.prompt,
    cwd: workDir,
    outDir,
    timeoutMs,
  });

  try {
    execSync("git add -A", { cwd: workDir });
    execSync('git commit -q --allow-empty -m "post-run final state"', {
      cwd: workDir,
    });
  } catch {}
  const afterSha = safeExec("git rev-parse HEAD", workDir);

  await writeFile(
    path.join(outDir, "condition.json"),
    JSON.stringify(
      {
        condition: "claude_md_only",
        taskId: task.id,
        beforeSha,
        afterSha,
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
    execSync(`xcopy "${src}" "${dst}" /E /I /H /Y >NUL`, { shell: true });
  } else {
    execSync(`cp -R "${src}"/. "${dst}"`, { shell: true });
  }
}
