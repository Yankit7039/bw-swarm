---
title: Event system
description: The run_events table, event types emitted by swarm-core and runtime, and how consumers read them.
---

# Event system

## Schema

`run_events` is defined in **`runtime/db/migrations/001_initial.sql`**:

| Column | Type | Purpose |
|--------|------|---------|
| **`run_id`** | UUID | FK to **`runs`** |
| **`event_type`** | TEXT | Short identifier (e.g. `tool_started`) |
| **`event`** | TEXT | Human-readable summary for UI |
| **`payload`** | JSONB | Optional structured detail |
| **`created_at`** | TIMESTAMPTZ | Ordering |

Events are append-only for a run. **Admin API** exposes **`GET /runs/{run_id}/events`**; **Runtime** exposes **`GET /runs/{run_id}/events`**. The **Admin Console** can load them via SSE or polling.

## Emission from swarm-core (standard path)

During **`workflow_runner`** / **`yaml_runner`** execution:

| event_type | When |
|------------|------|
| **`workflow_started`** | Run begins |
| **`tool_started`** | Before an MCP tool call (YAML **`mcp_call`** step) |
| **`tool_completed`** | After the tool returns |
| **`llm_message`** | Model response (when captured) |
| **`workflow_completed`** | Successful completion of the workflow path |

**`tool_filter`** on **`llm_agent`** steps controls which tools are available to the model; **YAML** **`tool_labels`** map internal names to display labels in **`tool_*`** events.

## Emission from swarm-core (AgentMail follow-up path)

`followup_agentmail` adds domain-specific types, including:

| event_type | When |
|------------|------|
| **`followup_scheduled`** | Next timer set after outbound send or after handling a reply |
| **`followup_sent`** | A proactive follow-up email was sent |
| **`followup_exhausted`** | **`follow_up_count`** reached **`limit`** |
| **`ticket_resolved`** | Ticket closed on follow-up |
| **`workflow_error`** | Invalid payload (e.g. both `followup_context` and `reply_context`) |
| **`pending_inbound_drained`** | Queued inbound messages processed after a reply |
| **`engineer_reply_after_exhausted`** | Reply handled while exhausted |

Standard **`workflow_started`**, **`workflow_completed`**, **`llm_message`**, and **`tool_*`** may still appear during follow-up/reply sessions.

## Emission from runtime

| event_type | When |
|------------|------|
| **`followup_started`** | **`followup_poller`** claimed a due run and re-triggered the sandbox |
| **`jira_webhook`** | Jira webhook created a run (`POST /webhooks/jira`) |
| **`agentmail_inbound`** | Inbound reply claimed and sandbox re-triggered |

## Consumers

- **Admin Console** — Run detail and flow views
- **Operators** — `GET /runs/{run_id}/events` for debugging or external dashboards

## Further reading

- [Data flow](/concepts/data-flow)
- [Follow-up lifecycle](/concepts/follow-up-lifecycle)
- [Admin API](/reference/admin-api)
