---
title: Services reference
description: Ports, responsibilities, and entrypoints for SWARM components.
---

# Services reference

| Service | Responsibility | Typical port (local) | Entry / notes |
|---------|----------------|------------------------|---------------|
| **runtime** | Run API, webhooks, sandbox trigger, background pollers | **`8000`** (host), **`30080`** (Kind NodePort) | **`uvicorn runtime.app:app`**
| **admin-api** | Templates, runs, events, webhooks, adapters | **`8001`** (host), **`30081`** (Kind NodePort) | **`uvicorn app.main:app`** in **`admin-api/`**
| **admin-console** | Web UI | **`5173`** (Vite dev) | **`npm run dev`** in **`admin-console/`**
| **adapter** | MCP tool server + FastAPI **`/health`** | **`8080`** (in-cluster Service) | Mounted at **`/mcp`** (see **`MCP_MOUNT_PATH`**)
| **swarm-core** (pod) | Workflow engine, **`POST /run`**, **`GET /health`** | **`8888`** (**`ENTRYPOINT_PORT`**) | **`python -m uvicorn swarm_core.entrypoint:app`**
| **postgres** | Shared DB | **`5432`** (Compose) / **RDS** (EKS) | Compose or Terraform |
| **redis** | Run queue for async webhook / enqueue handoff | **`6379`** (Compose) | **`REDIS_URL`** on **runtime** and **admin-api** when using the queue ([Redis run queue](/concepts/redis-queue)) |

## Environment (quick reference)

| Variable | Used by | Purpose |
|----------|---------|---------|
| **`DATABASE_URL`** | runtime, admin-api, adapter (registry), swarm-core | Async SQLAlchemy / asyncpg URL |
| **`REDIS_URL`** | runtime, admin-api | Enables [Redis run queue](/concepts/redis-queue) (runtime); required for **`POST /runs/enqueue`** on admin-api |
| **`RUNTIME_URL`** | admin-api | Base URL for webhook forwarding (**`http://runtime:8000`** in cluster) |
| **`VITE_ADMIN_API_URL`** | admin-console | Browser → Admin API |
| **`VITE_RUNTIME_API_URL`** | admin-console | Optional direct runtime calls |
| **`ADAPTER_URL`** | swarm-core | Base URL before **`/mcp`** |
| **`OPENROUTER_API_KEY`** | swarm-core | LLM API key |
| **`OPENROUTER_API_BASE`**, **`OPENROUTER_MODEL`** | swarm-core | OpenRouter endpoint and model id |
| **`YAML_PATH`** | swarm-core | Default **`/app/workflow.yaml`**; if missing, YAML loaded from DB per run |
| **`ENTRYPOINT_PORT`** | runtime (client), swarm-core (server) | HTTP port for **`POST /run`** (default **8888**) |
| **`SANDBOX_NAMESPACE`** | runtime | Kubernetes namespace for SandboxClaim (default **`default`**) |
| **`SANDBOX_POST_TIMEOUT`** | runtime | HTTP timeout when calling the pod |
| **`FOLLOWUP_POLLER_INTERVAL_SEC`** | runtime | Follow-up poller sleep (default **5**) |
| **`PENDING_REPLY_WORKER_INTERVAL_SEC`** | runtime | Pending reply worker sleep (default **5**) |
| **`CLAIM_RECONCILER_INTERVAL_SEC`** | runtime | Claim reconciler sleep (default **5**) |
| **`JIRA_WEBHOOK_SECRET`** | runtime | Jira webhook verification |
| **`AGENTMAIL_WEBHOOK_SECRET`** | runtime | Svix secret for AgentMail webhooks |
| **`SWARM_HYBRID_DEBUG_MCP`** | swarm-core | Optional debug logging for MCP |
| **`MCP_MOUNT_PATH`** | adapter | MCP mount (default **`/mcp`**) |
| **`AGENTMAIL_API_KEY`**, **`AGENTMAIL_INBOX_ID`** | adapter | AgentMail MCP tools |
| **`JIRA_EMAIL`**, **`JIRA_API_TOKEN`**, **`JIRA_BASE`** | adapter | Jira MCP tools |

Full tables: [Environment variables](/reference/environment-variables).

## Health

- **Runtime:** **`GET /health`**
- **Admin API:** **`GET /health`**
- **Adapter:** **`GET /health`**
- **swarm-core pod:** **`GET /health`** on **`ENTRYPOINT_PORT`**
