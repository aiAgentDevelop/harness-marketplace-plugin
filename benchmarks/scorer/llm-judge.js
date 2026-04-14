// llm-judge.js — Blind LLM judge for Usability (axis 12) and Over-engineering (axis 13).
//
// Blinding: condition labels (C1/C2/C3, bare_claude, claude_md_only, full_harness)
// are stripped from the judge prompt. See verify-blinding.js for the CI check.
//
// Judge input: final-state diff summary + assistant final text, stripped of metadata.
// Judge output: structured JSON with usability_score (0-100) and overengineering_score (0-100, lower-is-better).

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const JUDGE_MODEL = "claude-sonnet-4-6";

const JUDGE_PROMPT = `You are a BLIND reviewer scoring two quality dimensions of a coding agent's work.

You will see:
- A task prompt the agent was given
- A summary of files the agent changed and its final reply

You MUST NOT ask about or mention the agent's configuration, tooling, or identity. Score ONLY the visible output.

Score each dimension 0-100 and produce strict JSON:
{
  "usability_score": <integer 0-100>,
  "usability_notes": "<1 sentence>",
  "overengineering_score": <integer 0-100, LOWER IS BETTER — 0 = maximum overengineering>,
  "overengineering_notes": "<1 sentence>"
}

Usability rubric (higher = better):
- Plan adherence: did the output stay on the requested task?
- Readability: clear names, no extraneous complexity
- Error messages/handling: reasonable for the scope
- Final reply quality: actionable, no unnecessary filler

Over-engineering rubric (higher = more over-engineered = WORSE):
- Scope creep: features added beyond request
- Unnecessary abstractions: factories/interfaces where inline would do
- Over-testing: exhaustive tests for trivial code
- Unwanted refactors

Return ONLY the JSON object. No preamble.`;

/**
 * Run the blind judge on a single run's artifacts.
 * @param {string} taskPrompt
 * @param {string} assistantFinalText
 * @param {string} diffSummary - e.g., output of `git diff --stat`
 */
export async function judgeRun(taskPrompt, assistantFinalText, diffSummary) {
  const input = [
    "## Task prompt",
    taskPrompt,
    "",
    "## Files changed (diff stat)",
    diffSummary || "(no diff available)",
    "",
    "## Final assistant reply",
    assistantFinalText || "(empty)",
  ].join("\n");

  // Run blind judge via claude -p, prompt delivered via stdin (Windows argv length limit)
  const combined = `${JUDGE_PROMPT}\n\n---\n\n${input}`;
  const text = await new Promise((resolve, reject) => {
    const child = spawn(
      "claude",
      [
        "-p",
        "",
        "--input-format",
        "text",
        "--model",
        JUDGE_MODEL,
        "--output-format",
        "text",
        "--permission-mode",
        "bypassPermissions",
        "--dangerously-skip-permissions",
      ],
      {
        shell: process.platform === "win32",
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf8")));
    const killer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {}
    }, 180_000);
    child.on("close", (code) => {
      clearTimeout(killer);
      if (code !== 0) return resolve("__JUDGE_ERR__:" + (stderr || "exit " + code));
      resolve(stdout);
    });
    child.on("error", (e) => {
      clearTimeout(killer);
      resolve("__JUDGE_ERR__:" + e.message);
    });
    child.stdin.write(combined);
    child.stdin.end();
  });
  if (text.startsWith("__JUDGE_ERR__:")) {
    return {
      usability_score: null,
      overengineering_score: null,
      error: text.slice("__JUDGE_ERR__:".length, 500),
    };
  }
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) {
    return {
      usability_score: null,
      overengineering_score: null,
      error: "judge output had no JSON block",
      raw: text.slice(0, 500),
    };
  }
  try {
    return JSON.parse(m[0]);
  } catch (e) {
    return {
      usability_score: null,
      overengineering_score: null,
      error: "judge JSON parse failed: " + e.message,
      raw: m[0].slice(0, 500),
    };
  }
}
