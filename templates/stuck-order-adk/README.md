# Stuck Order Resolution template

One template implementation for the runtime: ADK agent + entrypoint that accepts POST /run (run_id + payload) and writes to shared Postgres (runs, run_events).

- **Submit runs**: Use the **runtime** service: `POST /runs` with `{ "template_id": "stuck-order-resolution", "payload": { "order_id": "ORDER-TIMEOUT" } }`.
- **Sandbox**: Build image from this directory. Deploy warm pool from infra: `kubectl apply -f ../../infra/k8s/warmpool-stuck-order-adk.yaml` (replace `<REGISTRY>` in the file). Runtime creates SandboxClaims and POSTs /run to pods.
- **Local test**: Set `DATABASE_URL` and `OPENROUTER_API_KEY`, then `uvicorn entrypoint:app --port 8888` and POST to `/run` with `{ "run_id": "<uuid>", "payload": { "order_id": "ORDER-TIMEOUT" } }`.

**Contents**: `entrypoint.py`, `workflow_runner.py`, `run_db.py` (thin Postgres client for runs/run_events), `stuck_order_agent/`, `Dockerfile`, `requirements.txt`, `.env.example`. No orchestration or job API; the runtime owns that.
