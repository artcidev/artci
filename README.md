# ARTCI Web App (Frontend + Backend)

This repository contains a modern frontend (in `source/`) and a FastAPI backend (in `backend/`) to collect and store user feedback. The backend serves the static frontend, saves feedback submissions to PostgreSQL (or SQLite by default), and exposes a small REST API.

## Frontend
- Location: `source/`
- Entry: `source/index.html`
- Styles: `source/styles.css`
- Script: `source/main.js`
- Assets: `source/images/`

Changes:
- Background now uses the image `source/images/bg.jpg` (cover, fixed).
- Rating icons use mask-based SVGs with a JS fallback.
- Success dialog updated to match the design (white card, centered text, large orange button with label “Terminer”).
- Ratings UI updated to borderless white cards with the title inside each card (no fieldsets/legends in markup).

## Backend
- Location: `backend/`
- Framework: FastAPI
- ORM: SQLAlchemy
- Static serving: The backend serves the `source/` directory at `/`.

### API Endpoints
- `GET /api/health` — health check.
- `POST /api/feedback` — create a feedback entry.
- `GET /api/feedback` — list feedback (latest first, default limit 50).
- `GET /api/feedback/{id}` — get a single feedback entry by id.

### Feedback Schema (modeled after `response_example.json`)
Request body for `POST /api/feedback`:
```json
{
  "type": "fixe",
  "provider": "Togo Télécom",
  "ratings": [
    { "crit-1": { "label": "Disponibilité de l’internet", "sublabel": "", "rating": "2" } },
    { "crit-2": { "label": "Disponibilité du SAV", "sublabel": "Injoignable ou attente de plus de 5 minutes", "rating": "3" } }
  ]
}
```
- `rating` is a string among "1" (bad), "2" (neutral), "3" (good).
- The backend stores `ratings` as JSON (JSONB on PostgreSQL).

### Quick Start (SQLite default)
1) Create a virtual environment and install requirements:
```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```
2) Run the server:
```powershell
uvicorn backend.main:app --reload --port 8000
```
3) Open the app in your browser:
- http://127.0.0.1:8000

The API is available under `/api/*` (same origin as the app). The database defaults to `sqlite:///./app.db` in the project root.

### Configure PostgreSQL
Set the `DATABASE_URL` environment variable before starting the server. Example:
```powershell
$env:DATABASE_URL = "postgresql+psycopg2://user:password@localhost:5432/artci"
uvicorn backend.main:app --reload --port 8000
```
The backend will automatically create the table on first run. For production, use migrations instead.

### cURL Examples
- Create feedback:
```bash
curl -X POST http://127.0.0.1:8000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "type": "fixe",
    "provider": "Togo Télécom",
    "ratings": [
      {"crit-1": {"label": "Disponibilité de l’internet", "sublabel": "", "rating": "2"}}
    ]
  }'
```
- List feedback:
```bash
curl http://127.0.0.1:8000/api/feedback
```

## Notes
- If you previously served the frontend via `file://` or a separate `http.server`, please close it and use the FastAPI server instead. The app and API will run under the same origin, avoiding CORS issues.
- The frontend `fetch('/api/feedback', {...})` assumes the app is served by the backend at the same base URL.

## Docker

You can containerize and run the app with Docker. A `Dockerfile` and `.dockerignore` are provided.

### Build
```bash
docker build -t artci-app:latest .
```

### Run with SQLite (default)
```bash
docker run --rm -p 8000:8000 \
  -e DATABASE_URL="sqlite:///./app.db" \
  --name artci-app \
  artci-app:latest
```
Then open: http://127.0.0.1:8000

### Run with PostgreSQL
Provide a `DATABASE_URL` env var. Example:
```bash
docker run --rm -p 8000:8000 \
  -e DATABASE_URL="postgresql+psycopg2://user:password@host:5432/artci" \
  --name artci-app \
  artci-app:latest
```

### Notes
- The container serves the static frontend from `source/` and the API at `/api/*` using `uvicorn`.
- Default port is 8000; change the published port with `-p <host>:8000` if needed.

## Kubernetes Deployment (MicroK8s)

### Prerequisites
- MicroK8s enabled with `dns`, `registry`, `ingress`, `storage`.
- Helm and Helmfile installed.

### Deploy
1. Build and push the image to the local registry:
   ```bash
   docker build -t localhost:32000/artci:latest .
   docker push localhost:32000/artci:latest
   ```
2. Deploy using Helmfile:
   ```bash
   helmfile -e dev apply
   ```

### Accessing the Application

**Option 1: Ingress (Recommended)**
1. Add the following line to your `/etc/hosts` (Linux/Mac) or `C:\Windows\System32\drivers\etc\hosts` (Windows):
   ```text
   127.0.0.1 artci.local
   ```
2. Open your browser at [http://artci.local](http://artci.local).

**Option 2: Port Forwarding**
If Ingress is not working or you want quick access:
```bash
microk8s kubectl port-forward svc/artci 8080:80 -n artci
```
Then open [http://localhost:8080](http://localhost:8080).

## Tableau de bord (Analytics)

Une page d’analytics moderne est disponible sur `/dashboard`.

Contenu:
- KPIs: nombre total de feedbacks, nombre d’opérateurs distincts, note moyenne pondérée, part des réponses « Bon ».
- Graphiques:
  - Répartition des notes (donut).
  - Réponses par jour (30 derniers jours).
  - Moyenne par critère (barres horizontales).
  - Réponses par opérateur (barres).

Sources de données:
- `GET /api/analytics/summary`
- `GET /api/analytics/criteria`
- `GET /api/analytics/time_series?days=30`

Astuce: vous pouvez ouvrir directement http://127.0.0.1:8000/dashboard

# JS Delivery

```html
<script src="https://cdn.jsdelivr.net/gh/artcidev/artci@latest/source/script-nperf.js"></script>
```
