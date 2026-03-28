# Network ops L1/L2 triage template

YAML-driven workflow using the shared **[swarm-core](../../swarm-core/)** Python package (`swarm_core`). The base image is **`swarm-core:latest`** (build `swarm-core/` first); this Dockerfile only copies `network-ops-l1l2-triage.yaml` to `/app/workflow.yaml`. The pod runs `swarm_core.entrypoint`: POST `/run` (`run_id` + `payload`) and writes to shared Postgres (`runs`, `run_events`).

- **Submit runs**: Use the **runtime** service: `POST /runs` with `{ "template_id": "network-ops-l1l2-triage", "payload": { "ticket_id": "NET-123" } }`.
- **Build images** (repo root):

  ```bash
  docker build -t swarm-core:latest swarm-core/
  docker build -t network-ops-l1l2-triage-adk:latest templates/network-ops-l1l2-triage
  ```

  Or from `infra/docker`: build `swarm-core` first, then `docker compose build` if a service references this template (use `context: ../../templates/network-ops-l1l2-triage` and `BASE_IMAGE: swarm-core:latest`).

  For ECR, pass `--build-arg BASE_IMAGE=<account>.dkr.ecr.<region>.amazonaws.com/swarm-core:latest` when building this image.

- **Deploy warm pool**: `kubectl apply -f ../../infra/k8s-aws/warmpool-network-ops-l1l2-triage-adk.yaml` (set your registry image as needed).

**Contents**: `network-ops-l1l2-triage.yaml` (workflow definition), `Dockerfile` (extends `swarm-core`, copies YAML only), `.env.example`.

The adapter must expose Jira tools (`jira__get_ticket`, `jira__transition_ticket`, `jira__update_labels`, `jira__update_priority`, `jira__add_comment`) and vendor tools (`ericsson_oss__get_correlated_alarms`, `netcracker__get_recent_changes`, `servicenow_kb__get_similar_incidents`). Set `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `JIRA_BASE` on the adapter.
