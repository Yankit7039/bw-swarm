---
title: bw-swarm documentation
description: Technical documentation for the SWARM multi-agent orchestration platform for telecom enterprises.
---

# SWARM — Agent orchestration platform

**SWARM** is a multi-agent orchestration platform for **telecom enterprises**. It runs **AI-powered workflows** where each workflow executes inside an **isolated Kubernetes pod**. Teams define automations in **YAML**, trigger them via HTTP or webhooks, and observe progress through a shared **PostgreSQL** database and the **Admin Console**.

**Why SWARM exists:** operational and customer-facing processes (tickets, porting, network triage, eSIM, and similar) need repeatable, auditable automation that can call CRM, ticketing, email, and vendor systems—without building a separate integration stack for every use case. SWARM provides a **shared runtime**, a **tool gateway (adapter)**, and **workflow templates** so engineers ship scenarios quickly while stakeholders get a clear picture of what runs and when.

---

## Who this documentation is for

| Audience | Start here |
|------------|------------|
| **New joiners & stakeholders** | This page, then [Architecture](/concepts/architecture) and [Glossary](/concepts/glossary) |
| **Operators & integrators** | [Kind cluster quickstart](/tutorials/kind-quickstart), [AWS quickstart](/tutorials/aws-quickstart), [Deployment](/guides/deployment) |
| **Workflow authors** | [Workflow YAML](/guides/workflow-yaml), [Templates](/guides/templates), [Adapters](/guides/adapters) |
| **Engineers** | [Repository layout](/concepts/repo-layout), [Reference](/reference/services) — and the repo source of truth |

---

## Component map

| Area | Role |
|------|------|
| **runtime** | Orchestrator: `POST /runs`, webhooks (Jira, AgentMail), **Redis run queue** (when configured), **sandbox trigger**, **follow-up poller**, **pending reply worker**, **claim reconciler** |
| **swarm-core** | Shared **workflow engine** (YAML + ADK) and **pod image**; MCP tools via **adapter**; writes **run_events** |
| **warm pool** | Pre-started **swarm-core** pods on Kubernetes **agent-sandbox**; **runtime** claims a pod per run |
| **admin-api** | Templates (incl. `PATCH` workflow YAML), runs, events, adapter registry — backs the console |
| **admin-console** | Web UI for templates, runs, YAML editing, adapters |
| **adapter** | **MCP** server: external systems (Jira, AgentMail, OSS, Siebel, …); **tool registry** in Postgres |
| **templates/** | Per-template Dockerfiles (often `FROM swarm-core`), sample YAML; **DB** rows drive `workflow_yaml` |
| **infra** | Docker Compose, Kind manifests, **AWS EKS** manifests, **Terraform** (VPC, ECR, EKS, RDS, secrets) |
| **observability** | Tracing and monitoring hooks (see repo `observability/`) |

---

## Where to go next

### Concepts

- **[Architecture](/concepts/architecture)** — How services, Postgres, and pods fit together
- **[Data flow](/concepts/data-flow)** — Runs, claims, events, follow-ups
- **[Redis run queue](/concepts/redis-queue)** — Async handoff from webhooks and Admin API enqueue
- **[Warm pool](/concepts/warm-pool)** — SandboxTemplate, SandboxWarmPool, SandboxClaim
- **[Follow-up lifecycle](/concepts/follow-up-lifecycle)** — Scheduled follow-ups and engineer replies
- **[Event system](/concepts/event-system)** — `run_events` and event types
- **[Repository layout](/concepts/repo-layout)** — Monorepo map
- **[Glossary](/concepts/glossary)** — Terms used across SWARM

### Tutorials

- **[Local development](/tutorials/local-dev)** — Postgres + uvicorn on the host (lightweight)
- **[Kind cluster quickstart](/tutorials/kind-quickstart)** — Full stack: `./scripts/quickstart.sh`, warm pool, adapter, admin-api
- **[AWS quickstart](/tutorials/aws-quickstart)** — Terraform + ECR + EKS + manifests

### Guides

- **[Workflow YAML](/guides/workflow-yaml)** — Schema: stages, steps, `follow_up`
- **[Adapters](/guides/adapters)** — MCP gateway and tool registry
- **[Templates](/guides/templates)** — Registration, `warm_pool_ref`, editing YAML
- **[Templates catalog](/guides/templates-catalog)** — Built-in templates
- **[Deployment](/guides/deployment)** — Compose, K8s, Terraform, Makefile

### Reference

- **[Runtime API](/reference/runtime-api)** — Runs and webhooks
- **[Admin API](/reference/admin-api)** — Templates, runs, webhooks, adapters
- **[Services](/reference/services)** — Ports and entrypoints
- **[Environment variables](/reference/environment-variables)** — Per-service configuration

---

## Doc system

This site is built with [Tome](https://www.tome.center/docs) from Markdown in the repo `docs/pages/` directory.
