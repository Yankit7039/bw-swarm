---
title: Runtime API
description: HTTP endpoints exposed by the runtime orchestrator service.
---

# Runtime API

FastAPI service under **`runtime/`**. Uses **`DATABASE_URL`** for **`runs`** and **`run_events`**.

**Listing runs** is not implemented on the runtime service — use **Admin API** **`GET /runs/`** for paginated lists.

## Runs

| Method | Path | Description |
|--------|------|-------------|
| **POST** | **`/runs`** | Create a run. Body: **`{ "template_id": string, "payload": object }`**. Returns **`run_id`**, **`template_id`**, **`status": "pending"`**. Enqueues sandbox trigger in the background. |
| **GET** | **`/runs/{run_id}`** | Single run row: status, result, error, timestamps, payload, etc. |
| **GET** | **`/runs/{run_id}/events`** | Ordered **`run_events`** for the run (UI / debugging). |

## Webhooks

| Method | Path | Description |
|--------|------|-------------|
| **POST** | **`/webhooks/jira`** | Jira Cloud webhook. Query param **`order_id`** selects routing: keys starting with **`NET`** → **`network-ops-l1l2-triage`** with **`ticket_id`**; otherwise **`ticket-email-routing`** with **`order_id`**. Requires **`JIRA_WEBHOOK_SECRET`**. |
| **POST** | **`/webhooks/agentmail`** | AgentMail (**Svix**) webhook for **`message.received`**. Verifies signature with **`AGENTMAIL_WEBHOOK_SECRET`**. Returns **`{"status":"accepted"}`** immediately; processing is asynchronous. |

### Jira webhook authentication

If **`JIRA_WEBHOOK_SECRET`** is unset, requests are rejected (**401**).

Otherwise the raw body is authenticated using **one** of:

- **`X-Hub-Signature: sha256=<hex>`** — HMAC-SHA256 of the body with the secret (Atlassian / WebSub style)
- **`Authorization: Bearer <secret>`** — same secret (useful for manual testing)

### AgentMail webhook authentication

**`AGENTMAIL_WEBHOOK_SECRET`** must be set to the **Svix** signing secret (value typically starts with **`whsec_`**). Headers **`svix-id`**, **`svix-timestamp`**, and **`svix-signature`** (or **`webhook-*`** aliases) are validated.

## Health

| Method | Path | Description |
|--------|------|-------------|
| **GET** | **`/health`** | **`{"status":"ok"}`** |

## OpenAPI

When the service is run with default FastAPI settings, interactive docs may be available at **`/docs`** if enabled in your deployment.

## Further reading

- [Admin API](/reference/admin-api) — template webhooks that forward to **`POST /runs`**
- [Event system](/concepts/event-system)
