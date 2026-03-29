# Ticket email routing template

YAML-driven workflow using the shared **[swarm-core](../../swarm-core/)** package (`swarm_core`). The base image is **`swarm-core:latest`** (build `swarm-core/` first); this Dockerfile only copies `ticket-email-routing.yaml` to `/app/workflow.yaml`. The pod runs `swarm_core.entrypoint`: POST `/run` (`run_id` + `payload`) and writes to shared Postgres (`runs`, `run_events`). **`follow_up.mode: agentmail`** enables the AgentMail follow-up lifecycle (scheduled follow-ups, engineer replies in-thread, Jira resolved detection) implemented in swarm-core.

- **Submit runs**: Use the **runtime** service: `POST /runs` with `{ "template_id": "ticket-email-routing", "payload": { "order_id": "ORD-123" } }`. Follow-up and reply payloads are constructed by the runtime (see runtime docs for `followup_context` / `reply_context`).
- **Build images** (repo root):

  ```bash
  docker build -t swarm-core:latest swarm-core/
  docker build -t ticket-email-routing-adk:latest templates/ticket-email-routing
  ```

  Or pass `--build-arg BASE_IMAGE=<account>.dkr.ecr.<region>.amazonaws.com/swarm-core:latest` when building this image for ECR (the repo **Makefile** does this for `ticket-email-routing-adk`).

- **Deploy warm pool**: `kubectl apply -f ../../infra/k8s-aws/warmpool-ticket-email-routing-adk.yaml` (set your registry image as needed).

**Contents**: `ticket-email-routing.yaml` (workflow definition), `Dockerfile` (extends `swarm-core`, copies YAML only), `.env.example`.

The adapter must expose **`jira__get_ticket`**, **`jira__transition_ticket`**, **`escalation_matrix__lookup`**, **`agentmail__send_email`**, and **`agentmail__send_followup`**. Set `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `JIRA_BASE` on the adapter; for real AgentMail sends set `AGENTMAIL_API_KEY` and `AGENTMAIL_INBOX_ID` (see `quickstart.md` / AWS deployment docs for `adk-secrets` keys).
