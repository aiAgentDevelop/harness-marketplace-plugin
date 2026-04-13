#!/usr/bin/env node
/**
 * LLM Judge — blind-scores a run on 7 rubric dimensions using `claude -p`.
 *
 * Dimensions:
 *   - code_quality
 *   - completeness
 *   - edge_cases
 *   - security
 *   - plan_adherence      (NEW — delta from plan.md if available; else from task spec)
 *   - scope_creep         (REVERSE-SCORED — more files outside scope → lower)
 *   - over_engineering    (REVERSE-SCORED — unnecessary abstractions → lower)
 *
 * Blinding (stronger than Phase 0):
 *   - Hides .claude/, CLAUDE.md, TASK.md, state/ files
 *   - Strips lines starting with "Plan:", "Verify:", "Implementation:", "Phase:"
 *     from any visible markdown (these would tip off the judge)
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BENCHMARKS_DIR = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { run: null, model: 'sonnet', maxFiles: 20, all: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--run') args.run = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--max-files') args.maxFiles = parseInt(argv[++i], 10);
    else if (a === '--all') args.all = true;
  }
  if (!args.run && !args.all) {
    console.error('ERROR: --run or --all required');
    process.exit(1);
  }
  return args;
}

const SKIP_DIRS = new Set([
  'node_modules', '.next', '.venv', 'venv', '__pycache__', '.pytest_cache',
  '.ruff_cache', '.mypy_cache', '.git', 'dist', 'build',
  '.claude',       // hide harness entirely
  'state',         // hide handoff state
  'skill-state',
  'events',
]);
const SKIP_FILES = new Set(['TASK.md', 'CLAUDE.md', 'manifest.json']);
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.md', '.json', '.yaml', '.yml', '.toml', '.sh']);

/**
 * Scrub markdown content of phase markers that would tip off the judge.
 */
function scrubPhaseMarkers(content) {
  return content
    .split('\n')
    .filter(line => !/^\s*(Plan|Verify|Implementation|Phase|Classification|Handoff):/i.test(line))
    .filter(line => !/\b(project-plan|project-implement|project-verify|project-harness)\b/.test(line))
    .join('\n');
}

async function collectFiles(rootDir, maxFiles) {
  const files = [];
  async function walk(dir) {
    if (files.length >= maxFiles) return;
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (files.length >= maxFiles) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(full);
      } else if (entry.isFile()) {
        if (SKIP_FILES.has(entry.name)) continue;
        const ext = path.extname(entry.name);
        if (!EXTS.has(ext)) continue;
        try {
          const s = await stat(full);
          if (s.size > 100_000) continue;
          let content = await readFile(full, 'utf8');
          if (ext === '.md') content = scrubPhaseMarkers(content);
          files.push({ rel: path.relative(rootDir, full).replace(/\\/g, '/'), content });
        } catch { /* ignore */ }
      }
    }
  }
  await walk(rootDir);
  return files;
}

function buildJudgePrompt(taskSpec, files, extras) {
  const fileBlock = files.map(f =>
    `\n\n=== FILE: ${f.rel} ===\n\`\`\`\n${f.content}\n\`\`\``
  ).join('');

  const scopeHint = extras.allowed_files?.length
    ? `\n## ALLOWED FILE SCOPE\n\nThe task implicitly allows modifications to: ${extras.allowed_files.join(', ')}.\nAny other modifications count as scope creep unless they are strictly necessary.\n`
    : '';

  return `You are a senior code reviewer evaluating a submission against a task specification. Score the submission on SEVEN dimensions, each 1-10. Be strict and evidence-based. Do not be lenient — unusual excellence deserves 10; anything less must have deductions justified.

## TASK SPECIFICATION

${taskSpec}
${scopeHint}
## SUBMITTED FILES

${fileBlock}

## RUBRIC (7 dimensions)

1. **code_quality** (1-10): readability, idiomatic usage, structure
2. **completeness** (1-10): are task requirements met? Missing files/logic → low; extra unauthorized work ALSO lowers this
3. **edge_cases** (1-10): error paths, empty states, boundaries
4. **security** (1-10): no hardcoded secrets, validated inputs, correct auth, parameterized queries
5. **plan_adherence** (1-10): does the final output match what a reasonable plan would produce? Does it stay focused on the task?
6. **scope_creep** (1-10, REVERSE-SCORED — 10 means no creep, 1 means massive creep): files or code added outside the task's implied scope. Extra abstractions, unnecessary new files, touched-but-unrelated code → lower score
7. **over_engineering** (1-10, REVERSE-SCORED — 10 means minimal/right-sized, 1 means heavily over-built): unnecessary abstractions, premature generalization, over-cautious error handling that was not asked for, excessive comments/docs, gratuitous new dependencies

IMPORTANT for the reverse-scored dimensions (scope_creep, over_engineering): a submission with MINIMAL, ON-SCOPE work should score HIGH (close to 10). A submission that sprawled or built too much should score LOW.

## OUTPUT FORMAT

Respond with ONLY a JSON object, no prose before/after, no markdown fences:

{
  "code_quality": 8,
  "code_quality_reason": "one sentence",
  "completeness": 7,
  "completeness_reason": "one sentence",
  "edge_cases": 5,
  "edge_cases_reason": "one sentence",
  "security": 9,
  "security_reason": "one sentence",
  "plan_adherence": 7,
  "plan_adherence_reason": "one sentence",
  "scope_creep": 8,
  "scope_creep_reason": "one sentence (high=no creep)",
  "over_engineering": 9,
  "over_engineering_reason": "one sentence (high=minimal)",
  "overall_notes": "up to 3 sentences"
}

Do not wrap in markdown code fences. Respond with raw JSON only.`;
}

function runClaudeJudge(prompt, model) {
  return new Promise((resolve) => {
    const child = spawn('claude', ['-p', '--model', model], {
      env: { ...process.env }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    });
    const chunks = [], errChunks = [];
    child.stdout.on('data', d => chunks.push(d));
    child.stderr.on('data', d => errChunks.push(d));
    child.on('error', err => resolve({ exitCode: -1, stdout: '', stderr: `spawn error: ${err.message}` }));
    child.on('close', code => resolve({
      exitCode: code ?? -1,
      stdout: Buffer.concat(chunks).toString('utf8'),
      stderr: Buffer.concat(errChunks).toString('utf8'),
    }));
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function extractJson(text) {
  try { return JSON.parse(text.trim()); } catch { /* fall through */ }
  const match = text.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* fall through */ } }
  return null;
}

async function judgeRun(runId, opts) {
  const { model, maxFiles } = opts;
  const runDir = path.join(BENCHMARKS_DIR, 'results', 'raw', runId);
  if (!existsSync(runDir)) throw new Error(`run dir not found: ${runDir}`);
  const manifest = JSON.parse(await readFile(path.join(runDir, 'manifest.json'), 'utf8'));

  // Load task spec (from tasks/<category>/<id>.md)
  const taskSpecPath = path.join(BENCHMARKS_DIR, 'tasks', manifest.category, `${manifest.task_id}.md`);
  const taskSpec = await readFile(taskSpecPath, 'utf8');

  // Load task registry entry for allowed_files hint
  const { getTask } = await import('../tasks/task-registry.js');
  const task = getTask(manifest.task_id);

  const projectRoot = path.join(runDir, 'project');
  const files = await collectFiles(projectRoot, maxFiles);

  const prompt = buildJudgePrompt(taskSpec, files, { allowed_files: task?.allowed_files });

  console.log(`[judge] ${runId}: ${files.length} files, prompt ${prompt.length} chars, model=${model}`);

  const { exitCode, stdout, stderr } = await runClaudeJudge(prompt, model);
  if (exitCode !== 0) {
    throw new Error(`claude -p failed (exit ${exitCode}): ${stderr.slice(0, 300)}`);
  }

  const json = extractJson(stdout);
  if (!json) throw new Error(`Failed to parse judge JSON. Raw: ${stdout.slice(0, 500)}`);

  const judgment = {
    run_id: runId,
    task_id: manifest.task_id,
    condition: manifest.condition,
    n: manifest.n,
    judged_at: new Date().toISOString(),
    judge_model: model,
    scores: {
      code_quality: json.code_quality ?? null,
      completeness: json.completeness ?? null,
      edge_cases: json.edge_cases ?? null,
      security: json.security ?? null,
      plan_adherence: json.plan_adherence ?? null,
      scope_creep: json.scope_creep ?? null,
      over_engineering: json.over_engineering ?? null,
    },
    reasons: {
      code_quality: json.code_quality_reason ?? null,
      completeness: json.completeness_reason ?? null,
      edge_cases: json.edge_cases_reason ?? null,
      security: json.security_reason ?? null,
      plan_adherence: json.plan_adherence_reason ?? null,
      scope_creep: json.scope_creep_reason ?? null,
      over_engineering: json.over_engineering_reason ?? null,
    },
    overall_notes: json.overall_notes ?? null,
  };

  const scoredDir = path.join(BENCHMARKS_DIR, 'results', 'scored');
  await mkdir(scoredDir, { recursive: true });
  await writeFile(path.join(scoredDir, `${runId}.judge.json`), JSON.stringify(judgment, null, 2));
  return judgment;
}

async function main() {
  const args = parseArgs(process.argv);
  const opts = { model: args.model, maxFiles: args.maxFiles };
  if (args.all) {
    const rawDir = path.join(BENCHMARKS_DIR, 'results', 'raw');
    if (!existsSync(rawDir)) { console.error('No results/raw/ yet'); process.exit(1); }
    const runs = (await readdir(rawDir, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name);
    let ok = 0, failed = 0;
    for (const r of runs) {
      const existingPath = path.join(BENCHMARKS_DIR, 'results', 'scored', `${r}.judge.json`);
      if (existsSync(existingPath)) { console.log(`[judge] skip (already judged): ${r}`); ok++; continue; }
      try {
        const j = await judgeRun(r, opts);
        console.log(`[judge] ${r}: Q=${j.scores.code_quality} C=${j.scores.completeness} E=${j.scores.edge_cases} S=${j.scores.security} PA=${j.scores.plan_adherence} SC=${j.scores.scope_creep} OE=${j.scores.over_engineering}`);
        ok++;
      } catch (err) {
        console.error(`[judge] FAILED ${r}: ${err.message}`);
        failed++;
      }
    }
    console.log(`[judge] Done. ${ok} ok, ${failed} failed.`);
  } else {
    const j = await judgeRun(args.run, opts);
    console.log(JSON.stringify(j, null, 2));
  }
}

if (process.argv[1] && process.argv[1].endsWith('llm-judge.js')) {
  main().catch((err) => {
    console.error(`[judge] FATAL: ${err.message}`);
    process.exit(2);
  });
}

export { judgeRun };
