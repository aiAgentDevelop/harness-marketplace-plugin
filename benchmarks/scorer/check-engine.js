// check-engine.js — Lightweight static check runner for task-defined assertions.
// Each task frontmatter declares `checks: [...]`. This module evaluates them
// against the post-run workdir and returns pass/fail + reason per check.
//
// Check types:
//   - file_exists       { path }
//   - file_not_exists   { path }
//   - file_contains     { path, regex, expected: true }
//   - no_file_contains  { path (glob), regex }           # any file matching path glob
//   - file_missing_or_no_contains { path, regex }
//   - cmd_succeeds      { cmd }
//   - cmd_fails         { cmd }

import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

export async function runChecks(checks, workDir) {
  const results = [];
  for (const chk of checks ?? []) {
    try {
      const r = await runOne(chk, workDir);
      results.push({ ...chk, ...r });
    } catch (e) {
      results.push({ ...chk, pass: false, error: String(e?.message || e) });
    }
  }
  const pass = results.filter((r) => r.pass).length;
  const total = results.length;
  return { results, pass, total, passRate: total ? pass / total : 0 };
}

async function runOne(chk, workDir) {
  switch (chk.type) {
    case "file_exists": {
      return { pass: existsSync(path.join(workDir, chk.path)) };
    }
    case "file_not_exists": {
      return { pass: !existsSync(path.join(workDir, chk.path)) };
    }
    case "file_contains": {
      const full = path.join(workDir, chk.path);
      if (!existsSync(full)) return { pass: false, reason: "file missing" };
      const body = await readFile(full, "utf8");
      const re = new RegExp(chk.regex, chk.flags || "m");
      const hit = re.test(body);
      return { pass: chk.expected === false ? !hit : hit };
    }
    case "no_file_contains": {
      const hits = await globContains(chk.path, chk.regex, chk.flags, workDir);
      return { pass: hits.length === 0, hits };
    }
    case "file_missing_or_no_contains": {
      const full = path.join(workDir, chk.path);
      if (!existsSync(full)) return { pass: true };
      const body = await readFile(full, "utf8");
      const re = new RegExp(chk.regex, chk.flags || "m");
      return { pass: !re.test(body) };
    }
    case "cmd_succeeds": {
      try {
        execSync(chk.cmd, { cwd: workDir, stdio: "ignore" });
        return { pass: true };
      } catch {
        return { pass: false };
      }
    }
    case "cmd_fails": {
      try {
        execSync(chk.cmd, { cwd: workDir, stdio: "ignore" });
        return { pass: false };
      } catch {
        return { pass: true };
      }
    }
    default:
      return { pass: false, reason: `unknown check type: ${chk.type}` };
  }
}

async function globContains(globPattern, regex, flags, workDir) {
  // Minimal glob support: recursive directory walk + ext filter
  const re = new RegExp(regex, flags || "m");
  const hits = [];
  const files = await walk(workDir);
  const globRe = globToRegex(globPattern);
  for (const f of files) {
    const rel = path.relative(workDir, f).replace(/\\/g, "/");
    if (!globRe.test(rel)) continue;
    try {
      const body = await readFile(f, "utf8");
      if (re.test(body)) hits.push(rel);
    } catch {}
  }
  return hits;
}

async function walk(dir) {
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
      if (e.name === "node_modules" || e.name === ".git" || e.name === ".claude") continue;
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) out.push(p);
    }
  }
  return out;
}

function globToRegex(glob) {
  // Very small subset: **/ and * and ?
  let r = "^";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*" && glob[i + 2] === "/") {
        r += "(?:.*/)?";
        i += 2;
      } else {
        r += "[^/]*";
      }
    } else if (c === "?") r += "[^/]";
    else if (c === ".") r += "\\.";
    else if (c === "/") r += "/";
    else r += c;
  }
  r += "$";
  return new RegExp(r);
}
