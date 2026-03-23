# ticket-email-routing

Hybrid ADK workflow: fetch ticket by `order_id`, resolve escalation contact, draft email with LLM, send via AgentMail (adapter MCP).

## Build

```bash
docker build -t ticket-email-routing-adk:latest .
```

## Run

Use the runtime service with `template_id: ticket-email-routing` and payload `{ "order_id": "..." }`.

Warm pool: `ticket-email-routing-adk-pool`. Adapter must expose `siebel_crm__get_ticket_by_order`, `escalation_matrix__lookup`, `agentmail__send_email`.
