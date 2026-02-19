# Concierge

Ein intelligenter Concierge für unstrukturierte Daten. Nimmt Transkripte, Notizen und andere Inhalte entgegen und sortiert sie automatisch ins richtige Format und an den richtigen Ort ein.

## Architektur

```
Client -> Gateway (HTTP) -> Scalebox VM -> Claude Agent -> Knowledge Repo
```

1. Gateway empfängt Content via HTTP
2. Erstellt eine neue VM auf Scalebox
3. Kopiert Verarbeitungs-Scripts in die VM
4. Klont das Knowledge-Repository
5. Führt den Claude-Agent aus
6. Löscht die VM nach Abschluss

## Schnellstart

### Mit Docker (empfohlen)

```bash
# Image von GHCR ziehen
docker pull ghcr.io/the-agentic-journey/concierge:latest

# Container starten
docker run -d \
  --name concierge \
  -p 8080:8080 \
  -e AUTH_TOKEN=mein-geheimer-token \
  -e SCALEBOX_API_URL=https://scalebox.example.com \
  -e SCALEBOX_API_TOKEN=sb-token \
  -e KNOWLEDGE_REPO_URL=git@github.com:user/knowledge.git \
  ghcr.io/the-agentic-journey/concierge:latest
```

### Lokal entwickeln

```bash
# Dependencies installieren
npm install

# .env erstellen (siehe .env.example)
cp .env.example .env

# Development Server starten
npm run dev
```

## Konfiguration

Alle Einstellungen erfolgen über Umgebungsvariablen:

| Variable | Erforderlich | Default | Beschreibung |
|----------|--------------|---------|--------------|
| `PORT` | Nein | `8080` | HTTP Port |
| `AUTH_TOKEN` | Ja | - | Bearer Token für API-Authentifizierung |
| `SCALEBOX_API_URL` | Ja | - | Scalebox API Endpoint |
| `SCALEBOX_API_TOKEN` | Ja | - | Scalebox API Token |
| `SCALEBOX_TEMPLATE` | Nein | `agentic-0-authenticated` | VM Template |
| `KNOWLEDGE_REPO_URL` | Ja | - | Git URL des Knowledge Repos |
| `KNOWLEDGE_REPO_BRANCH` | Nein | `main` | Branch des Knowledge Repos |
| `EXECUTION_TIMEOUT_MS` | Nein | `1200000` | Timeout in ms (20 Min) |

## API Endpoints

### Health Check

```bash
curl http://localhost:8080/health
```

### Ingest (JSON)

```bash
curl -X POST http://localhost:8080/ingest \
  -H "Authorization: Bearer mein-geheimer-token" \
  -H "Content-Type: application/json" \
  -d '{"content": "Transkript vom Meeting..."}'

# Mit Datum (für alte Transkripte)
curl -X POST http://localhost:8080/ingest \
  -H "Authorization: Bearer mein-geheimer-token" \
  -H "Content-Type: application/json" \
  -d '{"content": "Transkript vom Meeting...", "date": "2026-01-15"}'
```

### Ingest (Plain Text)

```bash
curl -X POST http://localhost:8080/ingest/text \
  -H "Authorization: Bearer mein-geheimer-token" \
  -d 'Transkript vom Meeting...'

# Mit Datum (Header oder Query-Parameter)
curl -X POST http://localhost:8080/ingest/text \
  -H "Authorization: Bearer mein-geheimer-token" \
  -H "X-Date: 2026-01-15" \
  -d 'Transkript vom Meeting...'

curl -X POST "http://localhost:8080/ingest/text?date=2026-01-15" \
  -H "Authorization: Bearer mein-geheimer-token" \
  -d 'Transkript vom Meeting...'

# Aus Datei
curl -X POST http://localhost:8080/ingest/text \
  -H "Authorization: Bearer mein-geheimer-token" \
  --data-binary @transkript.txt
```

### Response

```json
{
  "success": true,
  "output": "Agent Output...",
  "vmId": "vm-abc123",
  "durationMs": 45000
}
```

## Schneller Workflow (Shell-Aliases)

Füge diese Aliases zu deiner `~/.zshrc` oder `~/.bashrc` hinzu:

```bash
# Concierge URL und Token
export CONCIERGE_URL="http://localhost:8080"
export CONCIERGE_TOKEN="mein-geheimer-token"

# Clipboard -> Concierge (heute)
concierge() {
  pbpaste | curl -sX POST "$CONCIERGE_URL/ingest/text" \
    -H "Authorization: Bearer $CONCIERGE_TOKEN" \
    --data-binary @- | jq
}

# Clipboard -> Concierge mit Datum
# Verwendung: concierge-date 2026-01-15
concierge-date() {
  pbpaste | curl -sX POST "$CONCIERGE_URL/ingest/text?date=$1" \
    -H "Authorization: Bearer $CONCIERGE_TOKEN" \
    --data-binary @- | jq
}

# Interaktiv: Datum eingeben, dann Clipboard senden
concierge-old() {
  echo -n "Datum (YYYY-MM-DD): "
  read date
  pbpaste | curl -sX POST "$CONCIERGE_URL/ingest/text?date=$date" \
    -H "Authorization: Bearer $CONCIERGE_TOKEN" \
    --data-binary @- | jq
}
```

### Verwendung

```bash
# 1. Transkript in Zwischenablage kopieren (Cmd+C)

# 2. Für heutiges Transkript:
concierge

# 3. Für altes Transkript mit bekanntem Datum:
concierge-date 2026-01-15

# 4. Für altes Transkript (fragt nach Datum):
concierge-old
```

## Deployment

### Docker Compose

```yaml
version: "3.8"

services:
  ingest-gateway:
    image: ghcr.io/the-agentic-journey/concierge:latest
    ports:
      - "8080:8080"
    environment:
      - AUTH_TOKEN=${AUTH_TOKEN}
      - SCALEBOX_API_URL=${SCALEBOX_API_URL}
      - SCALEBOX_API_TOKEN=${SCALEBOX_API_TOKEN}
      - KNOWLEDGE_REPO_URL=${KNOWLEDGE_REPO_URL}
    restart: unless-stopped
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ingest-gateway
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ingest-gateway
  template:
    metadata:
      labels:
        app: ingest-gateway
    spec:
      containers:
        - name: gateway
          image: ghcr.io/the-agentic-journey/concierge:latest
          ports:
            - containerPort: 8080
          envFrom:
            - secretRef:
                name: ingest-gateway-secrets
---
apiVersion: v1
kind: Service
metadata:
  name: ingest-gateway
spec:
  selector:
    app: ingest-gateway
  ports:
    - port: 80
      targetPort: 8080
```

## Release

Continuous Release via GitHub Actions:

- Jeder Push auf `main` baut automatisch ein neues Image
- Tag ist die Build-Nummer: `ghcr.io/the-agentic-journey/concierge:42`
- Zusätzlich wird `latest` aktualisiert

## Voraussetzungen

- Scalebox-Account mit API-Zugang
- Knowledge-Repository mit Claude-kompatiblen Prompts
- SSH-Key-Zugang zu Scalebox VMs (wird automatisch vom Template bereitgestellt)
