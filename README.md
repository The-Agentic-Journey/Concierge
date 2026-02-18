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
  --name ingest-gateway \
  -p 8080:8080 \
  -e AUTH_TOKEN=mein-geheimer-token \
  -e SCALEBOX_API_URL=https://scalebox.example.com \
  -e SCALEBOX_API_TOKEN=sb-token \
  -e SCALEBOX_HOST=scalebox.example.com \
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
| `SCALEBOX_HOST` | Ja | - | Scalebox Host für SSH |
| `SSH_USER` | Nein | `root` | SSH Benutzer für VM |
| `KNOWLEDGE_REPO_URL` | Ja | - | Git URL des Knowledge Repos |
| `KNOWLEDGE_REPO_BRANCH` | Nein | `main` | Branch des Knowledge Repos |
| `EXECUTION_TIMEOUT_MS` | Nein | `300000` | Timeout in ms (5 Min) |

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
```

### Ingest (Plain Text)

```bash
curl -X POST http://localhost:8080/ingest/text \
  -H "Authorization: Bearer mein-geheimer-token" \
  -d 'Transkript vom Meeting...'

# Oder aus Datei
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
      - SCALEBOX_HOST=${SCALEBOX_HOST}
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

Releases werden automatisch via GitHub Actions erstellt:

- **Push auf `main`**: Baut und pusht `ghcr.io/the-agentic-journey/concierge:main`
- **Tag `v*`**: Baut und pusht `ghcr.io/the-agentic-journey/concierge:v1.2.3` und `ghcr.io/the-agentic-journey/concierge:1.2`

### Neues Release erstellen

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Voraussetzungen

- Scalebox-Account mit API-Zugang
- Knowledge-Repository mit Claude-kompatiblen Prompts
- SSH-Key-Zugang zu Scalebox VMs (wird automatisch vom Template bereitgestellt)
