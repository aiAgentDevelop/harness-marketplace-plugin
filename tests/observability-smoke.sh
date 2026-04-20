#!/usr/bin/env bash
# ============================================================================
# Smoke test for observability integration templates
#
# For each template under templates/integrations/{sentry,posthog}/, performs:
#   1. Token substitution with a representative sample set
#   2. Conditional block resolution (CONDITION:has_database etc.)
#   3. Basic syntactic sanity check on the compiled output
#      - TypeScript templates: no unresolved {{ }} markers remain
#      - Expected API surface present (Sentry.init, posthog.init, etc.)
#
# Usage: bash tests/observability-smoke.sh
# Exit:  0 = all tests pass, 1 = any test failed
# ============================================================================
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATES_DIR="$REPO_ROOT/templates/integrations"
WORK_DIR="$(mktemp -d -t obs-smoke-XXXXXX)"
OUT_DIR="$WORK_DIR/compiled"
mkdir -p "$OUT_DIR"

cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

PASS=0
FAIL=0
FAILED_CASES=()

# ----------------------------------------------------------------------------
# Compile one template:
#   - substitute {{PROJECT_NAME}}, {{VERSION}}, {{TRACES_SAMPLE_RATE}}, {{PROFILES_SAMPLE_RATE}}
#   - resolve {{CONDITION:flag}}...{{/CONDITION:flag}} blocks (keep enclosed content since all flags = true here)
# ----------------------------------------------------------------------------
compile_template() {
  local tpl="$1"
  local out="$2"

  # Strip conditional markers (keep content inside — we test the has_database/has_cache true case)
  sed -E 's/\{\{CONDITION:[^}]+\}\}//g; s/\{\{\/CONDITION:[^}]+\}\}//g' "$tpl" \
    | sed -E \
      -e 's/\{\{PROJECT_NAME\}\}/smoke-test-app/g' \
      -e 's/\{\{VERSION\}\}/0.8.0/g' \
      -e 's/\{\{TRACES_SAMPLE_RATE\}\}/0.2/g' \
      -e 's/\{\{PROFILES_SAMPLE_RATE\}\}/0.1/g' \
      > "$out"
}

assert_compiled() {
  local name="$1"
  local file="$2"
  shift 2

  # No unresolved harness tokens remain.
  # Harness tokens are ALL_CAPS_SNAKE_CASE inside {{ }}. JSX inline styles
  # like {{ padding: "2rem" }} are NOT harness tokens (space / lowercase rules
  # them out) and are allowed through.
  if grep -qE '\{\{[A-Z][A-Z0-9_]*\}\}' "$file"; then
    echo "[FAIL] $name — unresolved {{}} tokens:"
    grep -nE '\{\{[A-Z][A-Z0-9_]*\}\}' "$file" | head -5 | sed 's/^/       /'
    FAIL=$((FAIL + 1))
    FAILED_CASES+=("$name: unresolved tokens")
    return 1
  fi

  # Each remaining expected string must appear
  for expected in "$@"; do
    if ! grep -q "$expected" "$file"; then
      echo "[FAIL] $name — missing expected marker: $expected"
      FAIL=$((FAIL + 1))
      FAILED_CASES+=("$name: missing $expected")
      return 1
    fi
  done

  echo "[PASS] $name"
  PASS=$((PASS + 1))
}

# ----------------------------------------------------------------------------
# Sentry templates
# ----------------------------------------------------------------------------
echo "--- Sentry templates ---"

compile_template "$TEMPLATES_DIR/sentry/nextjs-init.ts.template" "$OUT_DIR/sentry-nextjs-init.ts"
assert_compiled "sentry/nextjs-init" "$OUT_DIR/sentry-nextjs-init.ts" \
  "Sentry.init" "SENTRY_DSN" "tracesSampleRate" "onRequestError"

compile_template "$TEMPLATES_DIR/sentry/node-backend-init.ts.template" "$OUT_DIR/sentry-node-init.ts"
assert_compiled "sentry/node-backend-init" "$OUT_DIR/sentry-node-init.ts" \
  "Sentry.init" "nodeProfilingIntegration" "uncaughtException" "unhandledRejection"

compile_template "$TEMPLATES_DIR/sentry/error-boundary.tsx.template" "$OUT_DIR/sentry-error-boundary.tsx"
assert_compiled "sentry/error-boundary" "$OUT_DIR/sentry-error-boundary.tsx" \
  "ErrorBoundary" "@sentry/nextjs" "use client"

compile_template "$TEMPLATES_DIR/sentry/health-check.ts.template" "$OUT_DIR/sentry-health-check.ts"
assert_compiled "sentry/health-check" "$OUT_DIR/sentry-health-check.ts" \
  "export async function GET" "checks" "Response.json" "SENTRY_RELEASE"

# ----------------------------------------------------------------------------
# PostHog templates
# ----------------------------------------------------------------------------
echo ""
echo "--- PostHog templates ---"

compile_template "$TEMPLATES_DIR/posthog/nextjs-init.ts.template" "$OUT_DIR/posthog-nextjs-init.tsx"
assert_compiled "posthog/nextjs-init" "$OUT_DIR/posthog-nextjs-init.tsx" \
  "posthog.init" "NEXT_PUBLIC_POSTHOG_KEY" "PostHogProvider" "\$pageview"

compile_template "$TEMPLATES_DIR/posthog/events-catalog.md.template" "$OUT_DIR/posthog-events-catalog.md"
assert_compiled "posthog/events-catalog" "$OUT_DIR/posthog-events-catalog.md" \
  "signed_up" "Naming convention" "CUSTOM EVENTS BELOW"

# ----------------------------------------------------------------------------
# Summary
# ----------------------------------------------------------------------------
echo ""
echo "--- Summary ---"
echo "Passed: $PASS"
echo "Failed: $FAIL"

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "Failed cases:"
  for case in "${FAILED_CASES[@]}"; do
    echo "  - $case"
  done
  exit 1
fi

echo ""
echo "All observability template smoke tests passed."
exit 0
