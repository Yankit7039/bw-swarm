# eSIM Activation Resolution template

YAML-driven workflow using the shared **[swarm-core](../../swarm-core/)** Python package (`swarm_core`). The base image is **`swarm-core:latest`** (build `swarm-core/` first); this Dockerfile only copies `esim-activation-resolution.yaml` to `/app/workflow.yaml`. The pod runs `swarm_core.entrypoint`: POST `/run` (`run_id` + `payload`) and writes to shared Postgres (`runs`, `run_events`).

- **Submit runs**: Use the **runtime** service: `POST /runs` with `{ "template_id": "esim-activation-resolution", "payload": { "order_id": "Ord-1" } }`.
- **Build images** (repo root):

  ```bash
  docker build -t swarm-core:latest swarm-core/
  docker build -t esim-activation-adk:latest templates/esim-activation-resolution
  ```

  Or from `infra/docker`: build `swarm-core` first, then `docker compose build esim-activation-adk` (compose uses `context: ../../templates/esim-activation-resolution` and `BASE_IMAGE: swarm-core:latest`).

- **Deploy warm pool**: `kubectl apply -f ../../infra/k8s/warmpool-esim-activation-adk.yaml` (set your registry image as needed).

**Contents**: `esim-activation-resolution.yaml` (workflow definition), `Dockerfile` (extends `swarm-core`, copies YAML only), `.env.example`.

Order IDs map to deterministic adapter scenarios from the numeric part of the ID (`number % 5`).
