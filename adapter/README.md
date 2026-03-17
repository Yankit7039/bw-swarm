# SWARM Adapter Service

FastAPI + MCP server providing mock telecom backend tools (Amdocs OMS, Siebel CRM, Ericsson, Netcracker).

This service is intended to run inside the SWARM kind cluster as a `ClusterIP` service. ADK workflow pods connect to it using ADK's `StreamableHTTPConnectionParams`.
