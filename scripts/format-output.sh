#!/bin/bash
# format-output.sh - Formatiert Claude stream-json Output
#
# Ausgabe:
#   stderr: Live-Aktivität (Tool-Calls, Summary)
#   stdout: Finaler YAML-Report vom Agent
#
# Verwendung: claude ... --output-format stream-json | ./format-output.sh

# Zähler für Zusammenfassung
declare -i stakeholder=0 termine=0 aktionen=0 projekte=0 orgs=0 notizen=0 index_updates=0

# Startzeit
start_time=$SECONDS
first_output=true

# Buffer für finalen Text-Output
final_text=""
in_yaml=false

count_path() {
  local path="$1"

  # Index-Updates separat zählen
  if [[ "$path" == *"/_index.md" ]]; then
    ((index_updates++))
    return
  fi

  # Nach Kategorie zählen
  case "$path" in
    */stakeholder/*)  ((stakeholder++)) ;;
    */termine/*)      ((termine++)) ;;
    */aktionen/*)     ((aktionen++)) ;;
    */projekte/*)     ((projekte++)) ;;
    */organisationen/*) ((orgs++)) ;;
    */notizen/*)      ((notizen++)) ;;
  esac
}

format_duration() {
  local secs=$1
  if [[ $secs -lt 60 ]]; then
    echo "${secs}s"
  elif [[ $secs -lt 3600 ]]; then
    echo "$((secs / 60))m $((secs % 60))s"
  else
    echo "$((secs / 3600))h $((secs % 3600 / 60))m"
  fi
}

print_summary() {
  local elapsed=$((SECONDS - start_time))
  local duration=$(format_duration $elapsed)
  local parts=()

  [[ $stakeholder -gt 0 ]] && parts+=("$stakeholder Stakeholder")
  [[ $termine -gt 0 ]] && parts+=("$termine Termin(e)")
  [[ $aktionen -gt 0 ]] && parts+=("$aktionen Aktion(en)")
  [[ $projekte -gt 0 ]] && parts+=("$projekte Projekt(e)")
  [[ $orgs -gt 0 ]] && parts+=("$orgs Organisation(en)")
  [[ $notizen -gt 0 ]] && parts+=("$notizen Notiz(en)")
  [[ $index_updates -gt 0 ]] && parts+=("$index_updates Index-Updates")

  if [[ ${#parts[@]} -gt 0 ]]; then
    local IFS=", "
    echo "✅ Fertig in $duration — ${parts[*]}"
  else
    echo "✅ Fertig in $duration"
  fi
}

# Warte-Nachricht
echo -n "⏳ Warte auf API..." >&2

while IFS= read -r line; do
  # Erste Antwort - Warte-Nachricht löschen
  if $first_output; then
    echo -ne "\r\033[K" >&2
    first_output=false
  fi

  # Tool-Use aus nested content extrahieren (jq)
  tool_info=$(echo "$line" | jq -r '
    .message.content[]? |
    select(.type == "tool_use") |
    "\(.name)|\(.input.file_path // .input.pattern // .input.command // "")"
  ' 2>/dev/null)

  if [[ -n "$tool_info" ]]; then
    tool=$(echo "$tool_info" | cut -d'|' -f1)
    param=$(echo "$tool_info" | cut -d'|' -f2)

    case "$tool" in
      Read)
        echo "📖 Read: $param" >&2
        ;;
      Write)
        echo "📝 Write: $param" >&2
        count_path "$param"
        ;;
      Edit)
        echo "✏️  Edit: $param" >&2
        count_path "$param"
        ;;
      Glob)
        echo "🔍 Glob: $param" >&2
        ;;
      Grep)
        echo "🔎 Grep: $param" >&2
        ;;
      Bash)
        echo "⚡ Bash: ${param:0:60}" >&2
        ;;
      TodoWrite)
        # ignorieren
        ;;
      *)
        echo "🔧 $tool" >&2
        ;;
    esac
  fi

  # Text-Content aus assistant messages extrahieren (für YAML-Report)
  text_content=$(echo "$line" | jq -r '
    .message.content[]? |
    select(.type == "text") |
    .text // empty
  ' 2>/dev/null)

  if [[ -n "$text_content" ]]; then
    # Prüfe ob YAML-Report beginnt
    if [[ "$text_content" == *"---"* && "$text_content" == *"status:"* ]]; then
      in_yaml=true
    fi
    if $in_yaml; then
      final_text+="$text_content"
    fi
  fi

  # Result = Ende
  if echo "$line" | jq -e '.type == "result"' >/dev/null 2>&1; then
    echo "" >&2
    print_summary >&2

    # YAML-Report auf stdout ausgeben
    if [[ -n "$final_text" ]]; then
      echo "" >&2
      echo "$final_text"
    fi
  fi
done
