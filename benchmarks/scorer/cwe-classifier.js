// cwe-classifier.js — Axis 4: CWE-weighted defect score.
//
// Approach: static heuristics (regex-based) over post-run workdir looking for known
// insecure patterns, each labeled with a CWE ID and CVSS-like severity weight.
// Optional semgrep augmentation if `semgrep --config p/owasp-top-ten` is installed.

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

// Severity weights calibrated to CVSS 3.1 approximate base-score bands.
const SEVERITY = { critical: 9.5, high: 7.5, medium: 5.0, low: 2.5 };

// Heuristic rule set — conservative / low false-positive patterns.
const RULES = [
  {
    cwe: "CWE-798",
    name: "Hardcoded credentials",
    severity: "critical",
    pattern: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][A-Za-z0-9_\-+/]{16,}["']/i,
    excludeInComment: true,
  },
  {
    cwe: "CWE-200",
    name: "Service-role key exposed to client code",
    severity: "critical",
    pattern: /SUPABASE_SERVICE_ROLE(?:_KEY)?|service_role/,
    fileGlobs: ["app/**/*.ts", "app/**/*.tsx", "src/**/*.ts", "src/**/*.tsx", "pages/**/*.ts", "pages/**/*.tsx"],
  },
  {
    cwe: "CWE-89",
    name: "SQL injection via string interpolation",
    severity: "high",
    pattern: /(?:execute|query|prepare)\s*\(\s*(?:`|["'])[^`"']*\$\{[^}]+\}/,
  },
  {
    cwe: "CWE-79",
    name: "Dangerous HTML injection (dangerouslySetInnerHTML w/ user input)",
    severity: "high",
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html:\s*(?!['"`])[A-Za-z_][A-Za-z0-9_.]*\s*\}/,
  },
  {
    cwe: "CWE-918",
    name: "SSRF: unvalidated URL in fetch",
    severity: "high",
    pattern: /fetch\s*\(\s*(?:req\.(?:body|query|params)|request\.(?:body|query|params))/,
  },
  {
    cwe: "CWE-94",
    name: "eval/Function with dynamic input",
    severity: "critical",
    pattern: /\b(?:eval|Function)\s*\(\s*[^)]*(?:req\.|request\.|params\.)/,
  },
  {
    cwe: "CWE-327",
    name: "Weak crypto primitive",
    severity: "medium",
    pattern: /\b(?:createHash|createCipher)\s*\(\s*["'](md5|sha1|des|rc4)/i,
  },
  {
    cwe: "CWE-352",
    name: "CSRF: mutation endpoint with no method check",
    severity: "medium",
    // coarse heuristic — file containing a DB mutation but no method check
    pattern: null,
    custom: "csrf_loose",
  },
  {
    cwe: "CWE-532",
    name: "Logging of secrets",
    severity: "medium",
    pattern: /console\.log\s*\([^)]*(?:password|token|secret|api[_-]?key)/i,
  },
  {
    cwe: "CWE-862",
    name: "Missing authorization check on admin endpoint",
    severity: "high",
    pattern: null,
    custom: "admin_no_auth",
  },
];

export async function scoreCwe(workDir) {
  const files = await walk(workDir);
  const findings = [];
  let totalPenalty = 0;

  for (const file of files) {
    const rel = path.relative(workDir, file).replace(/\\/g, "/");
    if (shouldSkip(rel)) continue;
    let body;
    try {
      body = await readFile(file, "utf8");
    } catch {
      continue;
    }
    for (const rule of RULES) {
      if (rule.fileGlobs && !rule.fileGlobs.some((g) => matchGlob(g, rel))) continue;
      if (rule.pattern && rule.pattern.test(body)) {
        findings.push({
          cwe: rule.cwe,
          name: rule.name,
          severity: rule.severity,
          file: rel,
          weight: SEVERITY[rule.severity],
        });
        totalPenalty += SEVERITY[rule.severity];
      } else if (rule.custom === "csrf_loose") {
        if (
          /INSERT|UPDATE|DELETE FROM/i.test(body) &&
          !/(req|request)\.method\s*===?\s*['"]POST['"]|method:\s*['"]POST['"]/.test(body) &&
          /export\s+(?:async\s+)?function|app\.(?:post|put|delete)/i.test(body)
        ) {
          findings.push({
            cwe: rule.cwe,
            name: rule.name,
            severity: rule.severity,
            file: rel,
            weight: SEVERITY[rule.severity],
          });
          totalPenalty += SEVERITY[rule.severity];
        }
      } else if (rule.custom === "admin_no_auth") {
        if (
          /\/admin\//.test(rel) &&
          !/getUser\(|auth\.verify|verifyJWT|requireAdmin|checkRole/.test(body) &&
          /export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|DELETE|PATCH)|export\s+default\s+async/i.test(body)
        ) {
          findings.push({
            cwe: rule.cwe,
            name: rule.name,
            severity: rule.severity,
            file: rel,
            weight: SEVERITY[rule.severity],
          });
          totalPenalty += SEVERITY[rule.severity];
        }
      }
    }
  }

  // Optional semgrep
  let semgrepCount = 0;
  try {
    const out = execSync(
      `semgrep --config p/owasp-top-ten --json --quiet --error --timeout 60 ${JSON.stringify(workDir)}`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const parsed = JSON.parse(out);
    semgrepCount = (parsed.results || []).length;
    totalPenalty += semgrepCount * 3.0; // conservative semgrep weight
  } catch {
    /* semgrep absent or no findings */
  }

  // Normalize to 0-100 score: each unit of penalty reduces score.
  // At penalty >= 50 (roughly 5 critical or 10 medium findings), score = 0.
  const PENALTY_CAP = 50;
  const score = Math.max(
    0,
    Math.round(100 * (1 - Math.min(totalPenalty, PENALTY_CAP) / PENALTY_CAP)),
  );

  return {
    score,
    totalPenalty,
    findings,
    semgrepCount,
    cweTally: tallyCwe(findings),
  };
}

function shouldSkip(rel) {
  return (
    rel.startsWith("node_modules/") ||
    rel.startsWith(".git/") ||
    rel.startsWith(".next/") ||
    rel.startsWith("dist/") ||
    rel.startsWith("build/") ||
    /\.(png|jpg|jpeg|gif|woff2?|ttf|ico)$/i.test(rel) ||
    /\.lock$/.test(rel)
  );
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
      // Exclude harness infrastructure — we score the agent's APP output, not skill templates
      if (e.name === "node_modules" || e.name === ".git" || e.name === ".claude") continue;
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) out.push(p);
    }
  }
  return out;
}

function matchGlob(pattern, rel) {
  // subset: **/ + * only
  const src = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*\//g, "__DD__")
    .replace(/\*/g, "[^/]*")
    .replace(/__DD__/g, "(?:.*/)?");
  return new RegExp("^" + src + "$").test(rel);
}

function tallyCwe(findings) {
  const out = {};
  for (const f of findings) out[f.cwe] = (out[f.cwe] || 0) + 1;
  return out;
}
