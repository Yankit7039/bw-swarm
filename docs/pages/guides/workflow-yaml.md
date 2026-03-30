---
title: Workflow YAML
description: Schema for SWARM workflow YAML validated by swarm_core.schema — stages, steps, and follow_up.
---

# Workflow YAML

Workflow documents are **YAML** files validated at pod startup by **`WorkflowSchema`** in **`swarm-core/swarm_core/schema.py`**. Operators can edit **`templates.workflow_yaml`** via the Admin Console (**`PATCH /templates/{template_id}`**).

## Top-level fields

| Field | Type | Description |
|-------|------|-------------|
| **`template_id`** | string | Must match the **`templates`** row |
| **`version`** | string | Optional version label (default **`1.0`**) |
| **`description`** | string | Human-readable summary |
| **`model`** | string | Default model id (e.g. OpenRouter id); may be overridden by env |
| **`input`** | object | **`required`**: list of payload keys the workflow expects |
| **`adapters`** | list of strings | Declarative list of integration areas (Jira, AgentMail, …) — documentation / convention |
| **`tool_labels`** | map | Display labels for MCP tools in **`run_events`** |
| **`result_keys`** | list | Keys the workflow may write into final **result** / state |
| **`follow_up`** | object | See [Follow-up](#follow_up-block) |
| **`escalation_matrix`** | map | Optional structured data for escalation tooling |
| **`stages`** | list | **Required**, non-empty — see [Stages](#stages) |

## Stages

Each stage is a mapping with **`type`**:

| `type` | Purpose |
|--------|---------|
| **`deterministic`** | Ordered **`steps`** — no LLM unless a step is **`llm_agent`** |
| **`hybrid`** | Same as deterministic (default **`type`** if omitted) |
| **`poll_loop`** | Repeated polling with **`poll_steps`**, **`interval_seconds`**, **`max_iterations`**, **`exit_if`**, and optional **`escalation_ladder`** |

Common stage fields:

- **`name`** — Identifier for logs and skipping
- **`skip_if`** — Expression string evaluated against session context (e.g. **`"is_followup or is_reply"`**)

### `poll_loop`

| Field | Meaning |
|-------|---------|
| **`interval_seconds`** | Sleep between iterations |
| **`max_iterations`** | Stop after N loops |
| **`exit_if`** | When true, exit the loop |
| **`poll_steps`** | **`mcp_call`** steps run each iteration |
| **`escalation_ladder`** | List of **`iteration`**, **`level`**, **`label`**, optional **`steps`** (MCP calls) for escalation |

## Steps

Each step under **`stages[].steps`** (or inside **`poll_loop`**) has **`type`**:

### `mcp_call`

| Field | Meaning |
|-------|---------|
| **`tool`** | MCP tool name (e.g. **`jira__get_ticket`**) |
| **`input`** | Arguments; may use **`{{ variable }}`** templating |
| **`output_key`** | Where to store the tool result in workflow state |
| **`skip_if`** | Optional guard |
| **`input_bindings`** | Optional mapping for advanced input wiring |
| **`name`** | Optional short name for logging |

### `llm_agent`

| Field | Meaning |
|-------|---------|
| **`instruction`** | Prompt for the model |
| **`description`** | Short description |
| **`tool_filter`** | Allowlist of MCP tool names the agent may call |
| **`output_key`** | State key for structured output |
| **`fallback_state`** | Defaults if parsing fails |
| **`input_keys`** | Keys to pass into context |
| **`skip_if`** | Optional guard |

### `condition`

| Field | Meaning |
|-------|---------|
| **`branches`** | List of **`if`** / **`else`** / **`set`** — see schema **`ConditionBranch`** |

## `follow_up` block

| Field | Type | Description |
|-------|------|-------------|
| **`mode`** | **`none`** \| **`agentmail`** | **`agentmail`** enables scheduled follow-ups and reply handling in **`followup_agentmail`** |
| **`limit`** | int | Max proactive follow-up sends |
| **`interval_seconds`** | int | Delay before next follow-up timer |
| **`email_result_key`** | string | Which result key holds outbound email metadata |

Runtime **follow-up scheduling** uses DB columns (**`followup_due_at`**, **`state`**) — see [Follow-up lifecycle](/concepts/follow-up-lifecycle).

## Annotated excerpt

From **`templates/ticket-email-routing/ticket-email-routing.yaml`** (abbreviated):

```yaml
template_id: ticket-email-routing
version: "1.0"

input:
  required:
    - order_id

adapters:
  - jira
  - escalation_matrix
  - agentmail

follow_up:
  mode: agentmail
  limit: 3
  interval_seconds: 120

stages:
  - name: classify
    type: deterministic
    skip_if: "is_followup or is_reply"
    steps:
      - name: fetch_ticket
        type: mcp_call
        tool: jira__get_ticket
        input:
          order_id: "{{ order_id }}"
        output_key: ticket_details
      - name: route_department
        type: llm_agent
        instruction: |
          Pick exactly one department key...
        output_key: routing
        tool_filter:
          - jira__get_ticket
```

See the full file in the repository for **`poll_loop`**, **`condition`**, and follow-up stages.

## Further reading

- [Templates](/guides/templates)
- [Adapters](/guides/adapters)
- [Event system](/concepts/event-system)
