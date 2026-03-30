---
title: Glossary
description: Terms used across SWARM documentation.
---

# Glossary

| Term | Meaning |
|------|---------|
| **Run** | A single execution instance for a **`template_id`** and JSON **`payload`**, tracked in **`runs`** |
| **Template** | Registered workflow + container image metadata; stored in **`templates`**, implemented under **`templates/`** |
| **Runtime** | Service that accepts run creation, webhooks, and coordinates sandbox execution |
| **Sandbox pod** | Kubernetes workload running **swarm-core**; executes workflow code and writes to Postgres |
| **Admin API** | HTTP API for templates, runs, events, adapters, and operator webhooks |
| **Workflow YAML** | Declarative workflow: **stages**, **steps**, optional **`follow_up`** — stored in **`templates.workflow_yaml`** |
| **Warm pool** | **SandboxWarmPool** keeping idle **swarm-core** pods ready — see [Warm pool](/concepts/warm-pool) |
| **SandboxTemplate** | CRD: pod spec (image, env, probes) for agent-sandbox |
| **SandboxWarmPool** | CRD: desired replica count + reference to a **SandboxTemplate** |
| **SandboxClaim** | CRD: per-run claim binding a warm pod to a run |
| **swarm-core** | Shared Python package + **pod image**: YAML engine, ADK **Runner**, MCP client |
| **ADK** | Agent Development Kit — agent/session/runner abstractions used inside the pod |
| **MCP** | Model Context Protocol — adapter exposes tools at **`/mcp`** (Streamable HTTP) |
| **Adapter** | FastAPI service + MCP server; external integrations and **tool registry** |
| **Adapter tool registry** | Postgres table **`adapter_tool_registry`** — tool names and JSON Schemas synced at adapter startup |
| **Run event** | Row in **`run_events`** (`event_type`, `event`, `payload`) for UI and auditing |
| **Follow-up** | Scheduled or reply-driven re-execution while **`waiting_for_followup`** — see [Follow-up lifecycle](/concepts/follow-up-lifecycle) |
| **followup_poller** | Runtime background task that finds due runs and re-triggers the sandbox |
| **pending_reply_worker** | Runtime task that drains queued AgentMail messages when the run is idle |
| **claim reconciler** | Runtime task that deletes stale **SandboxClaim** objects for terminal runs |
| **warm_pool_ref** | Column on **`templates`** pointing to the **SandboxTemplate** / pool name (e.g. **`swarm-core-pool`**) |
| **Stage** | Named unit in workflow YAML: **`deterministic`**, **`hybrid`**, or **`poll_loop`** |
| **Step** | **`mcp_call`**, **`llm_agent`**, or **`condition`** inside a stage |
| **poll_loop** | Stage type: repeated **poll** steps with optional **escalation_ladder** |
| **Escalation ladder** | Ordered entries in **`poll_loop`** that run extra MCP steps at defined iterations |
| **tool_filter** | Allowlist of MCP tool names for an **`llm_agent`** step |
| **YAML runner** | Code path that interprets stages/steps and invokes tools and the model |
| **Communication thread** | Mapping from email **thread_id** to **run_id** for inbound routing |

Further product vocabulary may appear in template READMEs under **`templates/*/`**.
