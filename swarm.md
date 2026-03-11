# SWARM — Agent Orchestration Platform

> Architecture & Design Notes — Reconstructed from whiteboard sketches

---

## 1. Overview

SWARM is an agent orchestration platform designed to run automated, multi-step AI agent workflows at scale. It abstracts away the complexity of running parallel agents, managing integrations, and providing observability — exposing a clean interface for defining **templates** that get triggered by events or schedules.

---

## 2. High-Level Architecture

The platform is divided into two primary layers:

| Layer    | Component                  | Responsibility                                                                                      |
|----------|----------------------------|-----------------------------------------------------------------------------------------------------|
| Frontend | UI + Specific Use Case     | User-facing interface tailored to a specific domain or workflow. Communicates bidirectionally with Swarm Infra. |
| Backend  | Swarm Infra ("Fabric")     | Core platform responsible for all agent execution, observability, integrations, and runtime.        |

> The UI layer changes per use case. The Swarm Infra layer remains constant — a stable fabric underneath all deployments.

### 2.1 Swarm Infra — Core Capabilities

- **Observability** — monitoring and tracing of all agent activity
- **Integrations / Tools Abstraction** — standardised adapter layer for external services
- **Parallel Agent Runtime** — ability to run N agents concurrently, maximising throughput
- **Templates** — reusable, parameterised workflow definitions

---

## 3. Templates

Templates are the **core unit of work** in SWARM. Each template defines a workflow that is activated and broken down into discrete steps executed by agents.

### 3.1 Activation

A template can be activated in two ways:

| Trigger Type          | Description                                                        |
|-----------------------|--------------------------------------------------------------------|
| Event / Event Stream  | Reacts to an incoming event (e.g. a webhook trigger)               |
| Cron                  | Scheduled activation at defined time intervals                     |

### 3.2 Execution Model

```
1 Event  →  1 Agent Run  →  N Ordered Steps  →  Execution Done
```

Each activation produces **exactly one agent run**, broken into a sequence of ordered steps:

| Step Type           | Description                                                          |
|---------------------|----------------------------------------------------------------------|
| Subagent call       | LLM-powered step that reasons and acts                               |
| Deterministic step  | Code-based, predictable operation (file reads, fixed API calls, etc.)|

Execution completes once all steps (`step 1` → `step N`) have finished.

---

## 4. Example Workflows

### 4.1 Stuck Order Resolution

**Trigger:** Webhook event when an order is detected as stuck.

```
step 1  →  Check CRM
            └─ returns: customer_id, order_status

step 2  →  Check webhook / notification module
            └─ determines: when to send SMS or notification

step 3  →  ... (intermediate steps)

step 4  →  Talk to Delphi (internal service)
  step 4.1  →  Initiate conversation with Delphi
  step 4.2  →  Process response
```

---

### 4.2 HR Dietary Preferences Collection

**Trigger:** Cron — illustrates **fan-out parallelism**.

```
[Task: Collect dietary preferences]
         │
         ├─── subagent → employee_1
         ├─── subagent → employee_2
         ├─── subagent → employee_3
         └─── subagent → employee_N
                              │
                        [collect results]
```

- HR initiates a single task
- System fans out to **N parallel sub-agents**, one per employee
- Each sub-agent independently contacts an individual
- Results are **aggregated centrally** on completion

> This pattern demonstrates running N parallel agent interactions simultaneously, then collecting outputs into a unified result.

---

## 5. Infrastructure & Technology Stack

| Component              | Technology / Notes                                                                                           |
|------------------------|--------------------------------------------------------------------------------------------------------------|
| **Agent Runtime**      | Core execution engine. Runs on K8s or multi-Docker. Scales up/down based on load. Integrates with LLMs, tools, and memory. |
| **Adapter Service**    | Integration abstraction layer. ⚠️ Currently rewritten per new integration — known pain point, candidate for plugin/registry architecture. |
| **Database (DB)**      | Persistent state storage for agent runs, step results, and configuration.                                    |
| **Admin API + Console**| Management interface for templates, runs, and configuration. Skills/tools exposed as Admin API.              |
| **Redis**              | Message broker / event queue between components. Handles webhook triggers and event streams.                 |
| **Observability**      | Open-source stack (e.g. OpenTelemetry). Tracks agent runs, step durations, errors, and throughput.          |

### 5.1 Architecture Diagram (Simplified)

```
┌─────────────────────────────────────────────────────┐
│                    Swarm Infra                       │
│                                                      │
│  ┌──────────────┐     ┌──────────────────────────┐  │
│  │ Agent        │────▶│ DB / Redis (Msg Queue)   │  │
│  │ Execution    │     └──────────────────────────┘  │
│  │ Runtime      │                                    │
│  └──────┬───────┘     ┌──────────────────────────┐  │
│         │             │ Skills / Tools (Admin API)│  │
│         ▼             └──────────────────────────┘  │
│  ┌──────────────┐     ┌──────────────────────────┐  │
│  │ Adapter      │     │ Observability             │  │
│  │ Service      │     │ (OpenTelemetry / APM)     │  │
│  └──────────────┘     └──────────────────────────┘  │
│                                                      │
│  API + Admin Console        Scale: K8s / multi-Docker│
└─────────────────────────────────────────────────────┘
```

---


---

## 7. Key Design Decisions

| Decision                        | Detail                                                                                          |
|---------------------------------|-------------------------------------------------------------------------------------------------|
| **Separation of concerns**      | UI layer fully decoupled from Swarm Infra — different UIs per use case, core platform unchanged |
| **1:1 event-to-agent mapping**  | Each event → exactly one traceable agent run — keeps execution predictable and auditable        |
| **Parallel throughput**         | Fan-out model allows N agents simultaneously — high throughput for batch-style workflows        |
| **Adapter service fragility**   | ⚠️ Rewritten per integration — scalability risk, should become a plugin/registry architecture   |
| **Deterministic + agentic mix** | LLM-powered subagent steps + deterministic code steps = flexibility with predictability         |

---

> **Note:** This document was reconstructed from hand-drawn whiteboard sketches. Some labels may be partially interpreted due to handwriting legibility.