#!/usr/bin/env node
/**
 * Shared wrapper for `claude -p` invocation with stream-json output parsing.
 *
 * Captures per-invocation:
 *   - tokens_in, tokens_out, cost_usd (from final result event)
 *   - tool_calls (count + by_name)
 *   - hook_events (with --include-hook-events)
 *   - elapsed_ms
 *   - exit_code, stdout, stderr
 *
 * Also appends raw newline-delimited JSON events to logPath for forensic replay.
 */

import { spawn } from 'node:child_process';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * @param {object} opts
 * @param {string} opts.cwd - working directory
 * @param {string} opts.prompt - prompt body (may start with /skill-name)
 * @param {string} [opts.model='sonnet']
 * @param {number} [opts.maxBudgetUsd]
 * @param {number} [opts.timeoutMs=600000]
 * @param {string} [opts.logPath] - absolute path to append jsonl events
 * @param {boolean} [opts.includeHookEvents=true]
 * @returns {Promise<{exitCode, stdout, stderr, metrics, events}>}
 */
export async function invokeClaude(opts) {
  const {
    cwd,
    prompt,
    model = 'sonnet',
    maxBudgetUsd = null,
    timeoutMs = 600_000,
    logPath = null,
    includeHookEvents = true,
  } = opts;

  const args = [
    '-p',
    '--model', model,
    '--output-format', 'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
  ];
  if (includeHookEvents) args.push('--include-hook-events');
  if (maxBudgetUsd != null) args.push('--max-budget-usd', String(maxBudgetUsd));

  // Ensure log dir exists
  if (logPath) {
    await mkdir(path.dirname(logPath), { recursive: true });
  }

  const startTs = Date.now();
  return new Promise((resolve) => {
    const child = spawn('claude', args, {
      cwd,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const events = [];
    const hookEvents = [];
    const toolCalls = [];
    let tokensIn = 0;
    let tokensOut = 0;
    let costUsd = 0;
    let textOut = '';
    let errChunks = [];
    let buffer = '';
    let killedByTimeout = false;

    const timer = setTimeout(() => {
      killedByTimeout = true;
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
    }, timeoutMs);

    child.stdout.on('data', async (chunk) => {
      buffer += chunk.toString('utf8');
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (!line.trim()) continue;
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          // Not JSON — might be plain-text tail. Append to textOut.
          textOut += line + '\n';
          continue;
        }
        events.push(event);
        if (logPath) {
          try { await appendFile(logPath, line + '\n'); } catch { /* ignore */ }
        }

        // Classify events
        // Actual stream-json event types: "system" (includes subtypes: init, hook_started,
        // hook_response, hook_completed), "assistant", "user", "result", plus nested "tool_use"/
        // "thinking"/"text" blocks inside assistant.message.content.
        // Hook events: type="system" with subtype starting with "hook_", carrying hook_name
        // ("Event:Matcher" format), hook_event, and (on hook_response) exit_code, outcome, stderr.
        if (event.type === 'result') {
          // Final result event contains usage, cost, result text
          if (event.usage) {
            tokensIn = event.usage.input_tokens ?? event.usage.prompt_tokens ?? 0;
            tokensOut = event.usage.output_tokens ?? event.usage.completion_tokens ?? 0;
          }
          if (typeof event.total_cost_usd === 'number') costUsd = event.total_cost_usd;
          else if (typeof event.cost_usd === 'number') costUsd = event.cost_usd;
          if (typeof event.result === 'string') textOut += event.result;
        } else if (event.type === 'assistant' && event.message?.content) {
          // assistant messages — extract tool_use and text
          const content = Array.isArray(event.message.content) ? event.message.content : [event.message.content];
          for (const part of content) {
            if (part.type === 'tool_use') {
              toolCalls.push({ name: part.name, id: part.id });
            } else if (part.type === 'text' && typeof part.text === 'string') {
              textOut += part.text;
            }
          }
        } else if (
          (event.type === 'system' && typeof event.subtype === 'string' && event.subtype.startsWith('hook_')) ||
          event.type === 'hook' ||
          event.hook_event_name ||
          event.hook_name
        ) {
          hookEvents.push(event);
        }
      }
    });

    child.stderr.on('data', (d) => errChunks.push(d));
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        exitCode: -1,
        stdout: textOut,
        stderr: `spawn error: ${err.message}`,
        metrics: { elapsed_ms: Date.now() - startTs, tokens_in: 0, tokens_out: 0, cost_usd: 0, tool_calls: 0 },
        events: [],
        hookEvents: [],
        toolCalls: [],
        killedByTimeout: false,
      });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: killedByTimeout ? 124 : (code ?? -1),
        stdout: textOut,
        stderr: Buffer.concat(errChunks).toString('utf8'),
        metrics: {
          elapsed_ms: Date.now() - startTs,
          tokens_in: tokensIn,
          tokens_out: tokensOut,
          cost_usd: costUsd,
          tool_calls: toolCalls.length,
        },
        events,
        hookEvents,
        toolCalls,
        killedByTimeout,
      });
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

/**
 * Map stderr tag (e.g. "[PROTECTED]", "[SECRET-GUARD]") to our hook-script names.
 * The bash scripts emit these tags; the tag is the most reliable way to identify
 * which specific guard fired, since hook_name only gives "Event:Matcher".
 */
const STDERR_TAG_TO_HOOK = {
  PROTECTED: 'protected-files',
  'SECRET-GUARD': 'secret-guard',
  PATTERN: 'pattern-guard',
  'DB-SAFETY': 'db-safety',
  LINT: 'post-edit-lint',
  TYPECHECK: 'post-edit-typecheck',
};

function hookNameFromStderr(stderr) {
  if (!stderr || typeof stderr !== 'string') return null;
  const m = stderr.match(/\[([A-Z][A-Z-]*)\]/);
  if (!m) return null;
  return STDERR_TAG_TO_HOOK[m[1]] ?? null;
}

function parseHookEventName(raw) {
  // hook_name format: "PreToolUse:Bash" or "PostToolUse:Edit"
  if (!raw || typeof raw !== 'string') return { event: null, matcher: null };
  const idx = raw.indexOf(':');
  if (idx < 0) return { event: raw, matcher: null };
  return { event: raw.slice(0, idx), matcher: raw.slice(idx + 1) };
}

/**
 * Summarize hook events from stream-json into aggregate counts.
 * Handles three shapes:
 *   1. type:"system" subtype:"hook_started"|"hook_response"|"hook_completed"
 *      with hook_name="Event:Matcher", hook_event, exit_code, outcome, stderr
 *   2. Legacy type:"hook" shape (kept for forward-compat; none seen in practice)
 *   3. Events carrying hook_event_name directly
 *
 * Returns { total, by_hook: {name: count}, blocks: [{hook, event, detail}] }.
 * Counts each hook_started (not hook_response) to avoid double-counting the same
 * invocation. `by_hook` keys are specific-guard names parsed from stderr when
 * available, else "Event:Matcher" as a fallback.
 */
export function summarizeHookEvents(hookEvents) {
  const byHook = {};
  const blocks = [];
  // Correlate responses with their started-event id to get block info
  const responseById = new Map();
  for (const ev of hookEvents) {
    if (ev.subtype === 'hook_response' && ev.hook_id) {
      responseById.set(ev.hook_id, ev);
    }
  }
  for (const ev of hookEvents) {
    // Count one per invocation — use hook_started events as the canonical counter.
    // For legacy shapes (no subtype), count any event once.
    const isStarted = ev.subtype === 'hook_started';
    const isLegacy = !ev.subtype && (ev.type === 'hook' || ev.hook_event_name);
    if (!isStarted && !isLegacy) continue;

    const rawName = ev.hook_name ?? ev.name ?? ev.hook?.name ?? null;
    const { event: eventName, matcher } = parseHookEventName(rawName);

    // Look up paired response (if any) to get outcome + stderr
    const resp = ev.hook_id ? responseById.get(ev.hook_id) : null;
    const specificHook = hookNameFromStderr(resp?.stderr);
    const name = specificHook ?? (rawName ?? 'unknown');

    byHook[name] = (byHook[name] || 0) + 1;

    const blocked =
      (resp && (resp.outcome === 'blocked' || (typeof resp.exit_code === 'number' && resp.exit_code !== 0))) ||
      ev.decision === 'block' ||
      ev.decision === 'deny';

    if (blocked) {
      blocks.push({
        hook: name,
        event: eventName ?? ev.hook_event ?? ev.hook_event_name ?? null,
        matcher,
        exit_code: resp?.exit_code ?? null,
        stderr_snippet: resp?.stderr ? String(resp.stderr).slice(0, 300) : null,
      });
    }
  }
  return { total: Object.values(byHook).reduce((s, n) => s + n, 0), by_hook: byHook, blocks };
}
