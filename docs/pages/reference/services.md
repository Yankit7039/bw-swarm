---
title: Services reference
description: Ports, responsibilities, and entrypoints for bw-swarm components.
---

# Services reference

| Service | Responsibility | Typical port (local) | Entry / notes |
|---------|------------------|----------------------|---------------|
| **runtime** | Run API, webhooks, sandbox trigger | `8000` | `uvicorn runtime.app:app` |
| **admin-api** | Templates + runs read API; `PATCH` workflow YAML | `8001` (local), `30081` (Kind NodePort) | `uvicorn app.main:app` in `admin-api/` |
| **admin-console** | Web UI | `5173` (Vite dev) | `npm run dev` in `admin-console/` |
| **postgres** | Shared DB | `5432` (Compose) / in-cluster (Kind) | `infra/docker/` or Kind quickstart |
| **adapter** | External integrations | `8080` in-cluster (Kind) | See [Kind quickstart](/tutorials/kind-quickstart) |
| **runtime (Kind)** | Orchestrator | `30080` → service | NodePort; see `infra/k8s/kind-cluster.yaml` |
| **admin-api (Kind)** | Admin HTTP API | `30081` → service | NodePort; pair console with `VITE_ADMIN_API_URL=http://localhost:30081` |

## Environment

- **`DATABASE_URL`** — Async SQLAlchemy URL (`postgresql+asyncpg://...`) for runtime and admin-api
- **`VITE_ADMIN_API_URL`** — Admin Console → Admin API base URL

## Health

- Runtime: check app routes (no single standard path in all builds; see OpenAPI at `/docs` if enabled)
- Admin API: `GET /health` → `{"status":"ok"}`
