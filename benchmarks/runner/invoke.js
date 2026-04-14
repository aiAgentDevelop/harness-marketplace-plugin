// invoke.js — stream-json wrapper around `claude -p`
// Captures: assistant text, hook events (type=system, subtype=hook_*), usage/cost
//
// Key design (corrected from Phase 0.5 bug): Claude Code CLI emits hook events as
//   { type: "system", subtype: "hook_before" | "hook_after", hook_name: "Event:Matcher", ... }
// NOT as { type: "hook", hook_event_name: ... }
// This wrapper is the sole place hook-event parsing is implemented.

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Invoke Claude Code in a directory with a prompt, stream-json mode.
 * @param {Object} opts
 * @param {string} opts.prompt            - The task prompt.
 * @param {string} opts.cwd               - Working directory (must be git repo).
 * @param {string} opts.runId             - Unique run identifier.
 * @param {string} opts.outDir            - Where to write raw output.
 * @param {string} [opts.systemAppend]    - Optional system-prompt suffix.
 * @param {number} [opts.timeoutMs]       - Hard kill timeout (default 900_000).
 * @param {string} [opts.model]           - Model id (default claude-sonnet-4-6).
 * @returns {Promise<{runId, events, summary, durationMs, timedOut}>}
 */
export async function invokeClaude(opts) {
  const {
    prompt,
    cwd,
    runId = randomUUID(),
    outDir,
    systemAppend,
    timeoutMs = 900_000,
    model = "claude-sonnet-4-6",
  } = opts;

  await mkdir(outDir, { recursive: true });

  // Pipe prompt via stdin to avoid shell-arg truncation/escaping on Windows.
  const args = [
    "-p",
    "",
    "--input-format",
    "text",
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    model,
    "--permission-mode",
    "bypassPermissions",
    "--dangerously-skip-permissions",
  ];
  if (systemAppend) {
    args.push("--append-system-prompt", systemAppend);
  }

  const started = Date.now();
  const events = [];
  let stderrBuf = "";
  let timedOut = false;

  const child = spawn("claude", args, {
    cwd,
    env: process.env,
    shell: process.platform === "win32",
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdin.write(prompt);
  child.stdin.end();

  let lineBuffer = "";
  child.stdout.on("data", (chunk) => {
    lineBuffer += chunk.toString("utf8");
    let idx;
    while ((idx = lineBuffer.indexOf("\n")) >= 0) {
      const line = lineBuffer.slice(0, idx).trim();
      lineBuffer = lineBuffer.slice(idx + 1);
      if (!line) continue;
      try {
        const ev = JSON.parse(line);
        events.push(ev);
      } catch {
        // non-JSON line — capture as raw
        events.push({ type: "raw_line", line });
      }
    }
  });

  child.stderr.on("data", (chunk) => {
    stderrBuf += chunk.toString("utf8");
  });

  const timer = setTimeout(() => {
    timedOut = true;
    try {
      child.kill("SIGKILL");
    } catch {}
  }, timeoutMs);

  const exitCode = await new Promise((resolve) => {
    child.on("close", (code) => resolve(code));
    child.on("error", () => resolve(-1));
  });
  clearTimeout(timer);

  // Write raw JSONL + stderr for forensics
  const rawPath = path.join(outDir, "stream.jsonl");
  await writeFile(
    rawPath,
    events.map((e) => JSON.stringify(e)).join("\n") + "\n",
    "utf8",
  );
  if (stderrBuf) {
    await writeFile(path.join(outDir, "stderr.log"), stderrBuf, "utf8");
  }

  // Derive summary
  const summary = summarize(events);
  summary.exitCode = exitCode;
  summary.timedOut = timedOut;
  summary.durationMs = Date.now() - started;
  summary.runId = runId;

  await writeFile(
    path.join(outDir, "summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8",
  );

  return { runId, events, summary, durationMs: summary.durationMs, timedOut };
}

function summarize(events) {
  // Claude Code v2.1.105 emits hook outcomes INSIDE tool_result content as text like:
  //   "PreToolUse:Edit hook error: [.claude/hooks/protected-files.sh]: [PROTECTED] ..."
  // We detect both the older system/hook_* events AND the embedded text form.
  const hookEvents = events.filter(
    (e) =>
      e &&
      e.type === "system" &&
      typeof e.subtype === "string" &&
      e.subtype.startsWith("hook_"),
  );
  // Also: inspect all tool_result content for hook signatures
  const embeddedHooks = [];
  for (const ev of events) {
    if (ev?.type !== "user") continue;
    const content = ev?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (c?.type !== "tool_result") continue;
      let text = "";
      if (typeof c.content === "string") text = c.content;
      else if (Array.isArray(c.content)) {
        text = c.content
          .map((x) => (typeof x === "string" ? x : x?.text || ""))
          .join("\n");
      }
      const mHook = /((?:PreToolUse|PostToolUse|SessionStart|SessionEnd|UserPromptSubmit):\S+)\s+hook\s+error:\s*\[([^\]]+)\]/g;
      let match;
      while ((match = mHook.exec(text)) !== null) {
        embeddedHooks.push({
          subtype: "hook_embedded",
          hook_name: match[1],
          hook_script: match[2],
          action: "block",
          snippet: text.slice(Math.max(0, match.index), match.index + 200),
        });
      }
      // Non-blocking hook logs often appear as "[hook] <name>: success" or just entry with no error
      const mOk = /((?:PreToolUse|PostToolUse):\S+)\s+hook\s+(?:completed|ran)/g;
      while ((match = mOk.exec(text)) !== null) {
        embeddedHooks.push({
          subtype: "hook_embedded",
          hook_name: match[1],
          action: "ok",
        });
      }
    }
  }
  const allHooks = [...hookEvents, ...embeddedHooks];
  const hookBefore = allHooks.filter(
    (e) =>
      e.subtype === "hook_before" ||
      (e.hook_name && e.hook_name.startsWith("PreToolUse")),
  );
  const hookAfter = allHooks.filter(
    (e) =>
      e.subtype === "hook_after" ||
      (e.hook_name && e.hook_name.startsWith("PostToolUse")),
  );
  const toolUses = events.filter(
    (e) =>
      e &&
      e.type === "assistant" &&
      Array.isArray(e.message?.content) &&
      e.message.content.some((c) => c.type === "tool_use"),
  );
  const toolCalls = [];
  for (const ev of toolUses) {
    for (const c of ev.message.content) {
      if (c.type === "tool_use") toolCalls.push(c.name);
    }
  }
  const resultEvent = events.find((e) => e && e.type === "result");
  const usage = resultEvent?.usage || null;
  const costUsd = resultEvent?.total_cost_usd ?? null;

  // Last assistant text message (final reply)
  const assistantTexts = events.filter(
    (e) =>
      e &&
      e.type === "assistant" &&
      Array.isArray(e.message?.content) &&
      e.message.content.some((c) => c.type === "text"),
  );
  const lastText = assistantTexts.length
    ? assistantTexts[assistantTexts.length - 1].message.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n")
    : "";

  return {
    totalEvents: events.length,
    hookEventsTotal: allHooks.length,
    hookBeforeCount: hookBefore.length,
    hookAfterCount: hookAfter.length,
    hookBlockCount: allHooks.filter((e) => e.action === "block").length,
    hookNames: [...new Set(allHooks.map((e) => e.hook_name).filter(Boolean))],
    hookDetails: allHooks.slice(0, 50),
    toolCallsTotal: toolCalls.length,
    toolCallsByName: tally(toolCalls),
    usage,
    costUsd,
    finalAssistantText: lastText,
    resultSubtype: resultEvent?.subtype || null,
  };
}

function tally(xs) {
  const out = {};
  for (const x of xs) out[x] = (out[x] || 0) + 1;
  return out;
}
