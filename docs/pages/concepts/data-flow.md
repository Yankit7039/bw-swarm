---
title: Data flow
description: How runs move through the runtime, Postgres, and sandbox execution.
---

# Data flow

## Control plane overview

```mermaid
flowchart LR
  subgraph clients [Clients]
    WH[Webhooks]
    APIClient[API clients]
    AC[Admin Console]
  end
  subgraph services [Services]
    RT[runtime]
    AA[admin-api]
  end
  DB[(Postgres)]
  SB[Sandbox pods]

  WH --> RT
  APIClient --> RT
  AC --> AA
  RT --> DB
  AA --> DB
  RT --> SB
  SB --> DB
```

## Run lifecycle (simplified)

```mermaid
sequenceDiagram
  participant C as Client
  participant R as Runtime
  participant P as Postgres
  participant S as Sandbox pod

  C->>R: POST /runs template_id + payload
  R->>P: Insert run, load template row
  R->>S: Trigger execution (claim / POST to pod)
  S->>P: Append run_events, set result / status
  C->>R: GET /runs/run_id/events
  R->>P: Read ordered events
```

## Template registry

Rows in `templates` include `template_id`, `image`, optional `workflow_yaml`, and metadata used by the runtime to choose the container image and configuration.

## Product-specific diagrams

Some legacy sequence diagrams under `bible/diagrams/` describe product demos (e.g. retail flows). For **orchestration mechanics**, treat this page and `runtime/README.md` in the repo as canonical.
