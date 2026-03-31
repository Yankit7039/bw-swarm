---
title: Admin API
description: HTTP endpoints exposed by the admin-api service for templates, runs, webhooks, and adapters.
---

# Admin API

FastAPI service under **`admin-api/`**. Uses the **same Postgres** as the runtime (**`DATABASE_URL`**). Forwards operator **webhooks** to **`RUNTIME_URL`** (**`POST /runs`**).

## Templates

| Method | Path | Description |
|--------|------|-------------|
| **GET** | **`/templates/`** | List templates (`limit`, `offset`) |
| **GET** | **`/templates/{template_id}`** | Get one template |
| **PATCH** | **`/templates/{template_id}`** | Update **`workflow_yaml`** — body: **`{ "workflow_yaml": "string" }`** |

## Runs and events

| Method | Path | Description |
|--------|------|-------------|
| **GET** | **`/runs/`** | List runs; query: **`template_id`**, **`status`**, **`limit`**, **`offset`** |
| **GET** | **`/runs/{run_id}`** | Single run |
| **GET** | **`/runs/{run_id}/events`** | Ordered events for UI |
| **POST** | **`/runs/enqueue`** | Create a run with **`status: queued`** and push to the **Redis** queue for the runtime worker. Body: **`{ "template_id": string, "payload": object }`**. Requires **`REDIS_URL`** (see [Redis run queue](/concepts/redis-queue)). |

## Webhooks

These endpoints live under **`/webhooks`** and trigger runs via the **runtime** (not in-process execution).

| Method | Path | Description |
|--------|------|-------------|
| **POST** | **`/webhooks/templates/{template_id}`** | Body: single JSON object **or** **`{ "orders": [ {...}, ... ] }`** for batch. Forwards to **`{RUNTIME_URL}/runs`** with **`template_id`** and **`payload`**. |
| **GET** | **`/webhooks/templates/{template_id}`** | Metadata: sample payload, batch example, relative **`webhook_url`**, notes |

## Adapters

| Method | Path | Description |
|--------|------|-------------|
| **GET** | **`/adapters/`** | List adapters / registry overview |
| **GET** | **`/adapters/{adapter_name}`** | Tools for a named adapter |

## Health

| Method | Path | Description |
|--------|------|-------------|
| **GET** | **`/health`** | **`{"status":"ok"}`** |

## OpenAPI

When the service is running, interactive docs are at **`/docs`** and the machine-readable spec at **`/openapi.json`**.

A copy may be vendored under **`docs/public/openapi.json`** for static tooling; regenerate when the API changes.

## Further reading

- [Runtime API](/reference/runtime-api)
- [Adapters](/guides/adapters)
