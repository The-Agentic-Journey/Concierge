#!/bin/bash
# process-input.sh - Headless Agent für Input-Verarbeitung
#
# Verwendung:
#   cat transkript.txt | ./process-input.sh
#   ./process-input.sh transkript.txt
#   ./process-input.sh "Notiz: Habe heute mit Guido telefoniert..."
#   ./process-input.sh              (interaktiv: tippen/pasten, Ctrl+D zum Beenden)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_PATH="${REPO_PATH:-$(pwd)}"  # Default: current directory (knowledge repo)
ANWEISUNG="${ANWEISUNG:-$SCRIPT_DIR/agent-input-verarbeitung.md}"
MODEL="${MODEL:-sonnet}"  # sonnet (schnell) oder opus (gründlich)

# Prüfe ob Anweisung existiert
if [[ ! -f "$ANWEISUNG" ]]; then
  echo "Fehler: Anweisung nicht gefunden: $ANWEISUNG" >&2
  exit 1
fi

# Input ermitteln: stdin, Datei, oder direkter Text
if [[ -n "$1" ]]; then
  if [[ -f "$1" ]]; then
    # Argument ist eine Datei
    INPUT="$(cat "$1")"
  else
    # Argument ist direkter Text
    INPUT="$1"
  fi
elif [[ ! -t 0 ]]; then
  # Stdin ist nicht leer (Pipe)
  INPUT="$(cat)"
else
  # Interaktiver Modus: auf Eingabe warten
  echo "Input eingeben (Transkript oder Notiz)." >&2
  echo "Beenden mit Ctrl+D auf leerer Zeile." >&2
  echo "---" >&2
  INPUT="$(cat)"
fi

# Agent ausführen (im Repository-Verzeichnis)
cd "$REPO_PATH"

echo "---" >&2
echo "Starte Agent (model: $MODEL)..." >&2

echo "Verarbeite diesen Input:

$INPUT" | stdbuf -oL claude -p \
  --model "$MODEL" \
  --system-prompt "$(cat "$ANWEISUNG")" \
  --dangerously-skip-permissions \
  --verbose \
  --output-format stream-json \
  | "$SCRIPT_DIR/format-output.sh"
