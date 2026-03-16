# Runtime service

Template-agnostic orchestrator for agent runs. Postgres only (no Redis).

- **POST /runs** — Body: `{ "template_id": string, "payload": object }`. Creates a run, enqueues sandbox trigger (SandboxClaim + POST /run to pod).
- **GET /runs/{run_id}** — Run status, result, error_message, timestamps.
- **GET /runs/{run_id}/events** — Live step-by-step events.

Template registry is the `templates` table in Postgres. Sandbox pods write run result and events to the same DB keyed by `run_id`.

**Run from repo root:**

```bash
export DATABASE_URL="postgresql+asyncpg://swarm:swarm@localhost:5432/swarm"
uvicorn runtime.app:app --host 0.0.0.0 --port 8000
```

Migrations in `db/migrations/` run automatically on startup.
