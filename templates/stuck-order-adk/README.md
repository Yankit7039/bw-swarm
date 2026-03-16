# Stuck Order Resolution template

One template implementation for the runtime: ADK agent + entrypoint that accepts POST /run (run_id + payload) and writes to shared Postgres (runs, run_events).

- **Submit runs**: Use the **runtime** service: `POST /runs` with `{ "template_id": "stuck-order-resolution", "payload": { "order_id": "Ord-1" } }`.
- **Sandbox**: Build image from this directory. Deploy warm pool from infra: `kubectl apply -f ../../infra/k8s/warmpool-stuck-order-adk.yaml` (replace `<REGISTRY>` in the file). Runtime creates SandboxClaims and POSTs /run to pods.
- **Local test**: Set `DATABASE_URL` and `OPENROUTER_API_KEY`, then `uvicorn entrypoint:app --port 8888` and POST to `/run` with `{ "run_id": "<uuid>", "payload": { "order_id": "OH-1" } }`.

Order IDs are mapped to deterministic scenarios based on the numeric part of the ID: the last number in the string is taken (for example `OH-1`, `OH-159`, `ORDER-42`, or just `159`) and the scenario is `number % 5`. The scenarios are:

- 0: provisioning timeout
- 1: billing hold
- 2: network hold
- 3: pending upstream
- 4: contradictory logs

So, for example, `OH-5` and `ORDER-10` both map to scenario 0, while `OH-1` and `OH-6` both map to scenario 1.

**Contents**: `entrypoint.py`, `workflow_runner.py`, `run_db.py` (thin Postgres client for runs/run_events), `stuck_order_agent/`, `Dockerfile`, `requirements.txt`, `.env.example`. No orchestration or job API; the runtime owns that.
