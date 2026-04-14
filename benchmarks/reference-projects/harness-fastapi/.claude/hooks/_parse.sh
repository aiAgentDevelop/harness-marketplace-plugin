#!/usr/bin/env bash
# Helper: read Claude Code v2 hook input (JSON from stdin) and extract fields.
#
# After sourcing this, these variables are set:
#   HOOK_INPUT — raw JSON
#   TOOL_FILE_PATH — .tool_input.file_path (empty if absent)
#   TOOL_CONTENT — .tool_input.content, decoded (may be multi-line)
#   TOOL_COMMAND — .tool_input.command (may contain spaces)
#
# Uses python for JSON parsing since jq isn't guaranteed to be present.
# Uses base64 to safely carry content/command through shell variables.

HOOK_INPUT="$(cat)"

_parsed=$(printf '%s' "$HOOK_INPUT" | python -c "$(cat <<'PYEOF'
import sys, json, base64
try:
    data = json.load(sys.stdin)
except Exception:
    print("")
    print("")
    print("")
    sys.exit(0)
ti = data.get("tool_input", {}) or {}
fp = ti.get("file_path", "") or ""
ct = ti.get("content", "") or ""
cm = ti.get("command", "") or ""
print(fp)
print(base64.b64encode(ct.encode("utf-8")).decode("ascii") if ct else "")
print(base64.b64encode(cm.encode("utf-8")).decode("ascii") if cm else "")
PYEOF
)")

TOOL_FILE_PATH=$(printf '%s\n' "$_parsed" | sed -n '1p')
_content_b64=$(printf '%s\n' "$_parsed" | sed -n '2p')
_command_b64=$(printf '%s\n' "$_parsed" | sed -n '3p')

TOOL_CONTENT=""
if [[ -n "$_content_b64" ]]; then
  TOOL_CONTENT=$(printf '%s' "$_content_b64" | base64 -d 2>/dev/null || printf '')
fi

TOOL_COMMAND=""
if [[ -n "$_command_b64" ]]; then
  TOOL_COMMAND=$(printf '%s' "$_command_b64" | base64 -d 2>/dev/null || printf '')
fi

export HOOK_INPUT TOOL_FILE_PATH TOOL_CONTENT TOOL_COMMAND
unset _parsed _content_b64 _command_b64
