# Runtime service

Template-agnostic orchestrator for agent runs. Postgres only (no Redis).

- **POST /runs** — Body: `{ "template_id": string, "payload": object }`. Creates a run, enqueues sandbox trigger (SandboxClaim + POST /run to pod).
- **POST /webhooks/jira** — Jira Cloud admin webhooks: authenticate with `X-Hub-Signature` (HMAC-SHA256 of the raw body; secret in `JIRA_WEBHOOK_SECRET`). Optional `Authorization: Bearer <same secret>` for manual tests. Query `order_id` (issue key) and body `webhookEvent: jira:issue_created`: keys starting with `NET` trigger `network-ops-l1l2-triage` with payload `{ "ticket_id": "<key>" }`; otherwise `ticket-email-routing` with `{ "order_id": "<key>" }`.
- **POST /webhooks/agentmail** — AgentMail webhooks: authenticate with `X-AgentMail-Signature` (HMAC-SHA256 hex digest of the raw body; secret in `AGENTMAIL_WEBHOOK_SECRET`, key `agentmail-webhook-secret` in `adk-secrets`). Processes `message.received` and routes by registered `communication_threads` rows.
- **GET /runs/{run_id}** — Run status, result, error_message, timestamps.
- **GET /runs/{run_id}/events** — Live step-by-step events.

Template registry is the `templates` table in Postgres. Sandbox pods write run result and events to the same DB keyed by `run_id`.

**Run from repo root:**

```bash
export DATABASE_URL="postgresql+asyncpg://swarm:swarm@localhost:5432/swarm"
uvicorn runtime.app:app --host 0.0.0.0 --port 8000
```

Migrations in `db/migrations/` run automatically on startup.
