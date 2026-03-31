# SWARM — Agent Orchestration Platform

Multi-agent orchestration for telecom enterprises. Define AI-powered workflows in YAML, trigger via HTTP or webhooks, and observe runs through a shared PostgreSQL database and Admin Console.

SWARM provides a **shared runtime**, a **tool gateway (adapter)**, and **workflow templates** — so engineers ship automations for tickets, porting, network triage, and eSIM without building a separate integration stack each time.

---

## Start here — pick your role

| Role | Start with |
|------|------------|
| New joiners & stakeholders | [Architecture](/concepts/architecture), [Glossary](/concepts/glossary) |
| Operators & integrators | [Kind quickstart](/tutorials/kind-quickstart), [AWS quickstart](/tutorials/aws-quickstart), [Deployment](/guides/deployment) |
| Workflow authors | [Workflow YAML](/guides/workflow-yaml), [Templates](/guides/templates), [Adapters](/guides/adapters) |
| Engineers | [Repo layout](/concepts/repo-layout), [Service reference](/reference/services) |

---

## Components

| Component | What it does |
|-----------|--------------|
| runtime | Orchestrator. Handles `POST /runs`, webhooks (Jira, AgentMail), Redis run queue, sandbox triggers, follow-up polling, and claim reconciliation. |
| swarm-core | Shared workflow engine (YAML + ADK) and pod image. Calls external tools via the adapter; writes `run_events` to Postgres. |
| warm pool | Pre-started `swarm-core` pods on the Kubernetes `agent-sandbox` node pool. Runtime claims one pod per run for fast startup. |
| admin-api | REST API for templates, runs, events, and adapter registry. Backs the Admin Console. |
| admin-console | Web UI for browsing templates, viewing runs, editing workflow YAML, and managing adapters. |
| adapter | MCP server connecting to external systems — Jira, AgentMail, OSS, Siebel, etc. Tool definitions stored in Postgres. |
| templates/ | Per-template Dockerfiles (usually `FROM swarm-core`) and sample YAML. Database rows drive `workflow_yaml`. |
| infra | Docker Compose for local dev; Kind and AWS EKS manifests for clusters; Terraform for VPC, ECR, EKS, RDS, and secrets. |

---

## Documentation

### Concepts
- [Architecture](/concepts/architecture) — how services, Postgres, and pods fit together
- [Data flow](/concepts/data-flow) — runs, claims, events, follow-ups
- [Redis run queue](/concepts/redis-queue) — async handoff from webhooks and Admin API
- [Warm pool](/concepts/warm-pool) — SandboxTemplate, SandboxWarmPool, SandboxClaim
- [Follow-up lifecycle](/concepts/follow-up-lifecycle) — scheduled follow-ups and engineer replies
- [Event system](/concepts/event-system) — `run_events` and event types
- [Repo layout](/concepts/repo-layout) — monorepo map
- [Glossary](/concepts/glossary)

### Tutorials
- [Local dev](/tutorials/local-dev) — Postgres + uvicorn on the host (lightweight)
- [Kind quickstart](/tutorials/kind-quickstart) — full stack via `./scripts/quickstart.sh`
- [AWS quickstart](/tutorials/aws-quickstart) — Terraform + ECR + EKS

### Guides
- [Workflow YAML](/guides/workflow-yaml) — schema: stages, steps, `follow_up`
- [Adapters](/guides/adapters) — MCP gateway and tool registry
- [Templates](/guides/templates) — registration, `warm_pool_ref`, editing YAML
- [Templates catalog](/guides/templates-catalog) — built-in templates
- [Deployment](/guides/deployment) — Compose, K8s, Terraform, Makefile

### Reference
- [Runtime API](/reference/runtime-api) — runs and webhooks
- [Admin API](/reference/admin-api) — templates, runs, webhooks, adapters
- [Services](/reference/services) — ports and entrypoints
- [Environment variables](/reference/environment-variables) — per-service configuration

---

*Built with [Tome](https://www.tome.center/docs) from Markdown in `docs/pages/`.*