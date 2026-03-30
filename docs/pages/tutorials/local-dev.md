---
title: Local development
description: Run Postgres, runtime, admin-api, and admin-console locally.
---

# Local development

This path runs **Postgres** (often via Docker Compose) and **Python services on your machine** (`uvicorn`). It does not start Kind, warm pools, or the adapter in Kubernetes.

For the **full runtime + adapter + template sandboxes + admin-api** stack on a local **Kind** cluster, use **[Kind cluster quickstart](/tutorials/kind-quickstart)** (`./scripts/quickstart.sh` from repo root).

## Prerequisites

- **Python 3.12+** for `runtime` and `admin-api`
- **Node.js 20+** for `admin-console` and `docs`
- **Docker** (optional) for Compose-based Postgres/runtime

## Database

From repo root, start Postgres (and optional Redis/runtime) with Docker Compose:

```bash
cd infra/docker
docker compose up -d postgres
```

Default database (matches typical local config):

- URL: `postgresql+asyncpg://swarm:swarm@localhost:5432/swarm`
- User / password / DB: `swarm` / `swarm` / `swarm`

## Runtime

```bash
export DATABASE_URL="postgresql+asyncpg://swarm:swarm@localhost:5432/swarm"
uvicorn runtime.app:app --host 0.0.0.0 --port 8000
```

Migrations under `runtime/db/migrations/` run on startup.

## Admin API

```bash
cd admin-api
export DATABASE_URL="postgresql+asyncpg://swarm:swarm@localhost:5432/swarm"
uvicorn app.main:app --reload --port 8001
```

## Admin Console

```bash
cd admin-console
npm install
npm run dev
```

Point the UI at your Admin API (e.g. `VITE_ADMIN_API_URL` in `.env` — often `http://localhost:30081` when using Kind, or `http://localhost:8001` for local uvicorn).

## Trigger a run

With runtime up, `POST` to `http://localhost:8000/runs` with a body like:

```json
{
  "template_id": "<registered_template_id>",
  "payload": { "order_id": "EXAMPLE-1" }
}
```

Use `GET /runs/{run_id}` and `GET /runs/{run_id}/events` for status and streaming-style event logs.

## Documentation site

```bash
cd docs
npm install
npm run dev
```

Build static output: `npm run build` → `docs/out/`.
