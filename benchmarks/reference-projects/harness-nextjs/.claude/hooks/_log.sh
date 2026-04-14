#!/usr/bin/env bash
# Shared logging helper for hook block events.
# Usage: log_block "hook-name" "reason" [extra-info]

log_block() {
  local hook_name="${1:-unknown}"
  local reason="${2:-}"
  local extra="${3:-}"
  local log_file=".claude/hook-blocks.log"
  mkdir -p "$(dirname "$log_file")"
  printf '%s\thook=%s\treason=%s\textra=%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "$hook_name" \
    "$reason" \
    "$extra" \
    >> "$log_file"
}
