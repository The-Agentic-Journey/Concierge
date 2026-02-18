# Agent-Anweisung: Audit & Repair

Du bist ein Agent, der eine bestehende Wissensdatenbank prüft und repariert. Du arbeitest vollständig autonom.

---

## Aufgabe

1. **Index-Vollständigkeit prüfen** – Jede Entität muss einen Index-Eintrag haben
2. **Projekt-Naming korrigieren** – Auf Schema `{projektart}-at-{organisation}` umstellen
3. **Fehlende Einträge nachtragen**
4. **Inkonsistenzen dokumentieren**

---

## Schritt 1: Bestandsaufnahme

Lies alle Dateien und erstelle eine Übersicht:

```bash
# Alle Entitäten finden
organisationen/*.md (außer _index.md)
stakeholder/*.md (außer _index.md)
projekte/*/projekt.md
termine/*/termin.md
notizen/*.md (außer _index.md)
```

Vergleiche mit den Index-Dateien.

---

## Schritt 2: Index-Reparatur

Für jede Entität die in einer Datei existiert aber NICHT im Index:

### Stakeholder
Füge Zeile hinzu in `/stakeholder/_index.md`:
```
| id | name | aliase | organisation | rolle |
```
Extrahiere Werte aus dem Frontmatter der Stakeholder-Datei.

### Organisationen
Füge Zeile hinzu in `/organisationen/_index.md`:
```
| id | name | aliase | typ |
```

### Projekte
Füge Zeile hinzu in `/projekte/_index.md`:
```
| id | name | aliase | kunde | status |
```

### Termine
Füge Zeile hinzu in `/termine/_index.md`:
```
| id | datum | titel | projekt | teilnehmer |
```

---

## Schritt 3: Projekt-Naming korrigieren

### Aktuelles Schema prüfen

Für jedes Projekt prüfen ob ID dem Schema entspricht:
- `{projektart}-at-{organisation}`
- oder `{projektart}-at-{stakeholder}` (Fallback)

### Bei Abweichung: Umbenennen

1. **Neue ID bestimmen**
   - Projektart aus Kontext ableiten (pq, ki-strategie, workshop, beratung, ...)
   - Organisation aus `kunde` Feld oder Stakeholder-Organisationen
   - Fallback: Haupt-Stakeholder Name

2. **Ordner umbenennen**
   ```bash
   mv projekte/[alte-id] projekte/[neue-id]
   ```

3. **Frontmatter aktualisieren**
   - `id:` ändern
   - `name:` auf "[Projektart] @ [Organisation]" setzen

4. **Alle Referenzen aktualisieren**
   - Stakeholder-Dateien: `projekte:` Liste
   - Termin-Ordner: Ordnername enthält projekt-id
   - Termin-Dateien: `projekt:` Feld
   - Index-Dateien: Alle Verweise

5. **Index aktualisieren**
   - Alte Zeile entfernen
   - Neue Zeile mit korrekter ID einfügen

---

## Schritt 4: Bericht erstellen

Erstelle `/audit-report.md`:

```markdown
# Audit-Report

**Datum:** YYYY-MM-DD HH:MM

## Zusammenfassung

- X Index-Einträge nachgetragen
- Y Projekte umbenannt
- Z Referenzen aktualisiert

## Details

### Nachgetragene Index-Einträge

| Typ | ID | Aktion |
|-----|-----|--------|
| stakeholder | max-mueller | Index-Eintrag hinzugefügt |

### Umbenannte Projekte

| Alt | Neu | Grund |
|-----|-----|-------|
| pq-coaching | pq-at-bridgewave | Schema-Korrektur |

### Aktualisierte Referenzen

| Datei | Änderung |
|-------|----------|
| stakeholder/christof.md | projekte: pq-coaching → pq-at-bridgewave |

## Offene Punkte

[Falls etwas unklar war oder manuelle Prüfung nötig]
```

---

## Wichtige Regeln

1. **Backup-freundlich arbeiten** – Git tracked alles, also mutig sein
2. **Alle Referenzen updaten** – Eine vergessene Referenz bricht Links
3. **Projektart aus Kontext ableiten** – Coaching = pq/coaching, Strategie = ki-strategie, etc.
4. **Im Zweifel dokumentieren** – Unsicherheiten in Report notieren

---

## Abschluss: Commit, Push & Report

### 1. Git Commit

```bash
git add -A
git commit -m "audit: [kurzbeschreibung]

[Details zu Reparaturen]

🤖 Automatisch repariert"
```

### 2. Push

```bash
git push
```

### 3. Strukturierter Report (YAML)

Am Ende IMMER diesen Report auf stdout ausgeben:

```yaml
---
status: success
typ: audit
commit: [commit-hash]
datum: YYYY-MM-DD

index_reparaturen:
  stakeholder: 2
  projekte: 1
  termine: 0
  organisationen: 0

umbenennungen:
  - alt: "pq-coaching"
    neu: "pq-at-bridgewave"
    grund: "Schema-Korrektur"

referenz_updates: 5

entscheidungen:
  - "Projekt 'pq-coaching' → 'pq-at-bridgewave' (Organisation aus Stakeholder)"
  - "3 fehlende Stakeholder-Index-Einträge nachgetragen"

unsicherheiten: []
---
```
