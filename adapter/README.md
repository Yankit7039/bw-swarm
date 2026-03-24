# SWARM Adapter Service

FastAPI + MCP server providing mock telecom backend tools (Amdocs OMS, Siebel CRM, Ericsson, Netcracker) and real integrations where configured (e.g. **Jira** via `JIRA_EMAIL` / `JIRA_API_TOKEN` / `JIRA_BASE` for `jira__get_ticket` and `jira__transition_ticket`).

This service is intended to run inside the SWARM kind cluster as a `ClusterIP` service. ADK workflow pods connect to it using ADK's `StreamableHTTPConnectionParams`.
