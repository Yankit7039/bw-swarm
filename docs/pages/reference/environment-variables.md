---
title: Environment variables
description: Configuration reference for runtime, admin-api, admin-console, adapter, and swarm-core pods.
---

# Environment variables

Values are often injected from Kubernetes **`adk-secrets`** (keys use **hyphens**, e.g. **`database-url`**) or from **Terraform** → **Secrets Manager** → **External Secrets**. Local development uses shell **`export`** or **`.env`** files.

## Runtime

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| **`DATABASE_URL`** | yes* | `postgresql+asyncpg://swarm:swarm@localhost:5432/swarm` | Async Postgres URL |
| **`SANDBOX_NAMESPACE`** | no | `default` | Namespace for SandboxClaim |
| **`ENTRYPOINT_PORT`** | no | `8888` | Target port on swarm-core pods |
| **`SANDBOX_POST_TIMEOUT`** | no | `60` | Seconds for HTTP POST to pod |
| **`FOLLOWUP_POLLER_INTERVAL_SEC`** | no | `5` | Follow-up poller interval |
| **`PENDING_REPLY_WORKER_INTERVAL_SEC`** | no | `5` | Pending reply worker interval |
| **`CLAIM_RECONCILER_INTERVAL_SEC`** | no | `5` | Claim reconciler interval |
| **`JIRA_WEBHOOK_SECRET`** | for Jira webhooks | — | Shared secret for **`POST /webhooks/jira`** |
| **`AGENTMAIL_WEBHOOK_SECRET`** | for AgentMail webhooks | — | Svix **`whsec_...`** secret |

\*Strongly required in production; default only for local dev.

**K8s:** mount from **`adk-secrets`** as env vars (see **`infra/k8s-aws/runtime-deployment.yaml`** patterns).

## Admin API

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| **`DATABASE_URL`** | yes | — | Same Postgres as runtime |
| **`RUNTIME_URL`** | yes in cluster | `http://runtime:8000` | Forward webhooks to **`POST /runs`** |

## Admin Console (Vite)

| Variable | Required | Description |
|----------|----------|-------------|
| **`VITE_ADMIN_API_URL`** | yes | Admin API base URL (browser) |
| **`VITE_RUNTIME_API_URL`** | optional | Runtime base URL if UI calls runtime directly |

Set in **`admin-console/.env`** for local dev.

## Adapter

| Variable | Required | Description |
|----------|----------|-------------|
| **`DATABASE_URL`** | yes | Registry upserts to **`adapter_tool_registry`** |
| **`MCP_MOUNT_PATH`** | no | Default **`/mcp`** |
| **`AGENTMAIL_API_KEY`**, **`AGENTMAIL_INBOX_ID`** | optional | Real sends; mocks if empty |
| **`JIRA_EMAIL`**, **`JIRA_API_TOKEN`**, **`JIRA_BASE`** | optional | Jira MCP tools |

## swarm-core (pod)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| **`DATABASE_URL`** | yes | — | Load **`workflow_yaml`** by **`run_id`** when file missing |
| **`OPENROUTER_API_KEY`** | yes | — | LLM calls |
| **`OPENROUTER_API_BASE`** | no | `https://openrouter.ai/api/v1` | API base URL |
| **`OPENROUTER_MODEL`** | no | package default | Model id |
| **`ADAPTER_URL`** | no | `http://adapter:8080` | MCP base (**`/mcp`** appended in code) |
| **`YAML_PATH`** | no | `/app/workflow.yaml` | On-disk workflow; if absent, DB YAML used |
| **`ENTRYPOINT_PORT`** | no | `8888` | Uvicorn listen port |
| **`SWARM_HYBRID_DEBUG_MCP`** | no | — | Set to enable extra MCP debug logs |

## Terraform / secrets mapping (typical)

| App env | Secret key (Kubernetes **`adk-secrets`**) | Source |
|---------|-------------------------------------------|--------|
| **`DATABASE_URL`** | **`database-url`** | RDS URL from Terraform / Secrets Manager |
| **`OPENROUTER_API_KEY`** | **`openrouter-api-key`** | tfvars |
| **`AGENTMAIL_API_KEY`** | **`agentmail-api-key`** | tfvars |
| **`AGENTMAIL_INBOX_ID`** | **`agentmail-inbox-id`** | tfvars |
| **`JIRA_EMAIL`** | **`jira-email`** | tfvars |
| **`JIRA_API_TOKEN`** | **`jira-api-token`** | tfvars |
| **`JIRA_BASE`** | **`jira-base`** | tfvars |
| **`JIRA_WEBHOOK_SECRET`** | **`jira-webhook-secret`** | tfvars |
| **`AGENTMAIL_WEBHOOK_SECRET`** | **`agentmail-webhook-secret`** | tfvars |

Exact key names may vary slightly between Kind (**`kubectl create secret`**) and EKS (**External Secrets**); always check the manifest you applied.

## Further reading

- [Services](/reference/services)
- [AWS quickstart](/tutorials/aws-quickstart)
- **`infra/k8s-aws/README.md`**
