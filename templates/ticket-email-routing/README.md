# ticket-email-routing

Hybrid ADK workflow: fetch Jira issue by `order_id` (issue key), transition status, LLM route to escalation department, resolve escalation contact, draft email with LLM, send via AgentMail (adapter MCP).

## Build

```bash
docker build -t ticket-email-routing-adk:latest .
```

## Run

Use the runtime service with `template_id: ticket-email-routing` and payload `{ "order_id": "..." }`.

Warm pool: `ticket-email-routing-adk-pool`. Adapter must expose `jira__get_ticket`, `jira__transition_ticket`, `escalation_matrix__lookup`, `agentmail__send_email`. Set `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `JIRA_BASE` on the adapter (see `quickstart.md` / AWS deployment docs for `adk-secrets` keys).
