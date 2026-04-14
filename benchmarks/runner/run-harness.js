// run-harness.js — Condition C3: full wizard-generated project-harness
// Seed = reference-projects/harness-{stack}/ which is a directory-state that matches
// a post-wizard-install project (CLAUDE.md + .claude/skills/* + .claude/agents/* + .claude/hooks/* + settings.json).
//
// The prompt is sent verbatim. The harness skills/agents take over from the first message
// via CLAUDE.md's orchestration-by-default directives.

import { invokeClaude } from "./invoke.js";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

export async function runHarness(task, opts) {
  const { outDir, seedRepoPath, timeoutMs = 900_000 } = opts;
  if (!seedRepoPath || !existsSync(seedRepoPath)) {
    throw new Error(`run-harness requires seedRepoPath (got: ${seedRepoPath})`);
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

  try {
    execSync("git init -q", { cwd: workDir });
    execSync('git config user.email "benchmark@local"', { cwd: workDir });
    execSync('git config user.name "benchmark"', { cwd: workDir });
    execSync('git add -A && git commit -q --allow-empty -m "harness baseline"', {
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
        condition: "full_harness",
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
