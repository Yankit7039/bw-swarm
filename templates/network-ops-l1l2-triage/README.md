# network-ops-l1l2-triage

Hybrid ADK workflow: fetch Jira issue by `ticket_id`, transition to Triaging, LLM validates domain (RAN/Transport/Core), updates labels, calls Ericsson OSS / NetCracker / ServiceNow KB adapters, synthesizes triage comment, updates priority, posts comment, transitions to Enriched.

## Build

```bash
docker build -t network-ops-l1l2-triage-adk:latest .
```

## Run

Use the runtime service with `template_id: network-ops-l1l2-triage` and payload `{ "ticket_id": "NET-123" }`.

Warm pool: `network-ops-l1l2-triage-adk-pool`. Adapter must expose the Jira and vendor tools listed in `network-ops-l1l2-triage.yaml`. Set `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `JIRA_BASE` on the adapter.
