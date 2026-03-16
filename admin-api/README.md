# Admin API

The **Admin API** is a read-only FastAPI service that exposes templates, runs, and run events from the shared runtime Postgres database. It is designed for use by the Admin Console and other admin tooling.

## Responsibilities

- Expose templates from the `templates` table:
  - `GET /templates`
  - `GET /templates/{template_id}`
- Expose run status and metadata from the `runs` table:
  - `GET /runs`
  - `GET /runs/{run_id}`
- Expose step-by-step events from the `run_events` table:
  - `GET /runs/{run_id}/events`
- Health check:
  - `GET /health`

The Admin API **does not create or update runs**. Run creation and execution is owned by the `runtime` service (`POST /runs`).

## Running locally

From the repo root:

```bash
cd admin-api
uvicorn app.main:app --reload --port 8001
```

By default the service expects `DATABASE_URL` to point at the same Postgres instance used by the runtime, for example:

```bash
export DATABASE_URL="postgresql+asyncpg://swarm:swarm@localhost:5432/swarm"
```

## Endpoints

- `GET /health`  
  Simple health check; returns `{"status": "ok"}`.

- `GET /templates`  
  Lists templates from the `templates` table, ordered by `created_at` (newest first). Supports `limit` and `offset` query params.

- `GET /templates/{template_id}`  
  Returns one template by ID or `404` if not found.

- `GET /runs`  
  Lists runs with optional filters:
  - `template_id` — filter by template
  - `status` — one of `pending`, `running`, `completed`, `failed`
  - `limit`, `offset` — pagination

- `GET /runs/{run_id}`  
  Returns a single run by UUID, including status, payload, result, error_message, and timestamps.

- `GET /runs/{run_id}/events`  
  Returns ordered events for the run from the `run_events` table for use in step-by-step UIs.

## Docker & Kind

The Admin API image is built from `admin-api/Dockerfile` (Python 3.12 + FastAPI).

The Kind quickstart script:

- Builds `swarm-admin-api:latest`
- Loads it into the Kind cluster
- Applies `infra/k8s/admin-api-deployment.yaml`

After running `./scripts/quickstart.sh`, the Admin API is available at:

- `http://localhost:30081` (NodePort service `admin-api` in the Kind cluster)

