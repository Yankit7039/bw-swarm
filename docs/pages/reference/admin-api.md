---
title: Admin API
description: HTTP endpoints exposed by the admin-api service.
---

# Admin API

FastAPI service under `admin-api/`. Uses the **same Postgres** as the runtime (`DATABASE_URL`).

## Templates

| Method | Path | Description |
|--------|------|-------------|
| GET | `/templates/` | List templates (`limit`, `offset`) |
| GET | `/templates/{template_id}` | Get one template |
| PATCH | `/templates/{template_id}` | Update `workflow_yaml` — body: `{ "workflow_yaml": "string" }` |

## Runs and events

| Method | Path | Description |
|--------|------|-------------|
| GET | `/runs` | List runs; query: `template_id`, `status`, `limit`, `offset` |
| GET | `/runs/{run_id}` | Single run |
| GET | `/runs/{run_id}/events` | Ordered events for UI |

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |

## OpenAPI

When the service is running, interactive docs are available at `/docs` and the machine-readable spec at `/openapi.json`.

A copy may be vendored under `docs/public/openapi.json` for static tooling; regenerate it when the API changes (e.g. curl a running instance or export from FastAPI).
