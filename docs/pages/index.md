---
title: bw-swarm documentation
description: Technical documentation for the SWARM agent orchestration platform.
---

# SWARM — Agent orchestration platform

bw-swarm is a **template-agnostic runtime** plus **admin tooling** around a shared **PostgreSQL** database. External clients trigger **runs** (via HTTP or webhooks); the **runtime** schedules work in **sandbox pods**; templates implement domain-specific agents and workflows.

## Component map

| Area | Role |
|------|------|
| **runtime** | Orchestrator: `POST /runs`, run lifecycle, webhooks, sandbox trigger |
| **admin-api** | Read/update templates and read runs/events for the Admin Console |
| **admin-console** | Web UI for templates, runs, YAML editing |
| **templates/** | Per-template agent code, images, workflow YAML (registered in DB) |
| **adapter** | Integration abstraction for external services |
| **infra** | Docker Compose, Kubernetes, Terraform |
| **observability** | Tracing and monitoring hooks |

## Where to go next

- **[Architecture](/concepts/architecture)** — How services fit together
- **[Data flow](/concepts/data-flow)** — Runs, Postgres, and sandbox execution
- **[Local development](/tutorials/local-dev)** — Postgres + uvicorn on the host (lightweight)
- **[Kind cluster quickstart](/tutorials/kind-quickstart)** — Full backend: `./scripts/quickstart.sh`, adapter, runtime, warm pools, admin-api (Postgres in-cluster)
- **[Deployment](/guides/deployment)** — Infra entry points (Compose, K8s, Terraform)
- **[Service reference](/reference/services)** — Ports, env vars, entrypoints

## Doc system

This site is built with [Tome](https://www.tome.center/docs) from Markdown in the repo `docs/pages/` directory.
