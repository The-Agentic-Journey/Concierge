#!/bin/bash
# audit-repair.sh - Prüft und repariert die Wissensdatenbank
#
# Verwendung:
#   ./audit-repair.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_PATH="${REPO_PATH:-$SCRIPT_DIR}"
ANWEISUNG="${ANWEISUNG:-$SCRIPT_DIR/agent-audit-repair.md}"
MODEL="${MODEL:-opus}"  # opus (gründlich) oder sonnet (schnell)

if [[ ! -f "$ANWEISUNG" ]]; then
  echo "Fehler: Anweisung nicht gefunden: $ANWEISUNG" >&2
  exit 1
fi

cd "$REPO_PATH"

echo "---" >&2
echo "Starte Audit (model: $MODEL)..." >&2

echo "Prüfe und repariere die Wissensdatenbank." | stdbuf -oL claude -p \
  --model "$MODEL" \
  --system-prompt "$(cat "$ANWEISUNG")" \
  --dangerously-skip-permissions \
  --verbose \
  --output-format stream-json \
  | "$SCRIPT_DIR/format-output.sh"
