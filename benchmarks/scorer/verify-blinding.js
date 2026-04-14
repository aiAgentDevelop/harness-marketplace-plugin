// verify-blinding.js — CI check: judge prompt must not leak condition labels.
// Exits 1 if any forbidden identifier appears in llm-judge.js constants.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FORBIDDEN = [
  "bare_claude",
  "claude_md_only",
  "full_harness",
  "project-harness",
  "harness-marketplace",
  "C1",
  "C2",
  "C3",
];

async function main() {
  const judgeSrc = await readFile(path.join(__dirname, "llm-judge.js"), "utf8");
  // Extract strings inside JUDGE_PROMPT template literal
  const m = judgeSrc.match(/const\s+JUDGE_PROMPT\s*=\s*`([\s\S]+?)`/);
  if (!m) {
    console.error("[verify-blinding] FAIL: could not find JUDGE_PROMPT in llm-judge.js");
    process.exit(1);
  }
  const prompt = m[1];
  const leaked = FORBIDDEN.filter((w) =>
    new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(prompt),
  );
  if (leaked.length) {
    console.error("[verify-blinding] FAIL: judge prompt leaks:", leaked);
    process.exit(1);
  }
  console.log("[verify-blinding] PASS — judge prompt clean of condition labels");
}

main().catch((e) => {
  console.error("[verify-blinding] error:", e);
  process.exit(1);
});
