---
title: Data flow
description: How runs move through the runtime, Postgres, warm pool claims, sandbox execution, and follow-ups.
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

## Run lifecycle (initial trigger)

```mermaid
sequenceDiagram
  participant C as Client
  participant R as Runtime
  participant P as Postgres
  participant S as Sandbox pod

  C->>R: POST /runs template_id + payload
  R->>P: Insert run, load template row
  Note over R,P: run_events optional (e.g. jira_webhook)
  R->>S: SandboxClaim + POST /run
  S->>P: run_events workflow_* / tool_* / llm_*
  S->>P: Update run status, result, state
  C->>R: GET /runs/run_id/events
  R->>P: Read ordered events
```

## Warm pool claim flow

The runtime does not `kubectl run` a one-off pod per execution. It creates a **SandboxClaim** that binds a **pre-warmed** pod from **SandboxWarmPool** (see [Warm pool](/concepts/warm-pool)). When the pod hostname is ready, the runtime **POST**s `{ run_id, payload }` to the pod HTTP entrypoint.

```mermaid
sequenceDiagram
  participant R as Runtime
  participant K as Kubernetes agent-sandbox
  participant P as Postgres
  participant W as swarm-core pod

  R->>K: Create SandboxClaim (template ref from warm_pool_ref)
  K->>W: Assign claim to warm pod
  R->>P: Update assigned_pod / sandbox_claim_name
  R->>W: POST /run (run_id, payload)
  W->>P: insert_run_event workflow_started, ...
  W->>P: insert_run_event tool_started / tool_completed (per tool_filter)
  W->>P: Update run status / result
```

## Follow-up and inbound reply flow

When **`follow_up.mode: agentmail`** is in the workflow YAML, the pod may set **`waiting_for_followup`** and **`followup_due_at`**. The **followup_poller** emits **`followup_started`** and re-triggers the sandbox with **`followup_context`** in the payload. **AgentMail** webhooks can enqueue **engineer replies**; **`pending_reply_worker`** merges **`reply_context`** and triggers again. See [Follow-up lifecycle](/concepts/follow-up-lifecycle).

```mermaid
sequenceDiagram
  participant W as swarm-core pod
  participant P as Postgres
  participant RT as Runtime
  participant AM as AgentMail webhook

  W->>P: status waiting_for_followup, followup_due_at, state
  W->>P: insert_run_event followup_scheduled
  RT->>P: followup_poller claims due run
  RT->>P: insert_run_event followup_started
  RT->>W: POST /run (run_id, payload + followup_context)
  AM->>RT: POST /webhooks/agentmail (message.received)
  RT->>P: insert_run_event agentmail_inbound (when claiming reply)
  RT->>W: POST /run (merged reply_context)
```

## Template registry

Rows in **`templates`** include **`template_id`**, **`image`**, **`warm_pool_ref`**, optional **`workflow_yaml`**, and metadata used by the runtime to choose the warm pool and configuration.
