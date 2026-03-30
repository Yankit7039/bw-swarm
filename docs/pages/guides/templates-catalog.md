---
title: Templates catalog
description: Built-in SWARM templates — purpose, inputs, tools, and follow-up behavior.
---

# Templates catalog

Each row summarizes a template under **`templates/`** in the monorepo. **`template_id`** is the value used in **`POST /runs`**.

| Template ID | One-line description | Primary inputs | Adapters / tools (representative) | Follow-up |
|-------------|---------------------|----------------|-------------------------------------|-----------|
| **`esim-activation-resolution`** | Resolve eSIM activation issues using hybrid YAML and OSS-style data | **`order_id`** | **amdocs_oms**, **fraud_engine**, **esim_manager**, **runbook_registry**, **notification** | **No** |
| **`number-porting-resolution`** | Unblock stuck mobile number port-in orders | **`order_id`** | **porting_gateway**, **siebel_crm**, **amdocs_oms**, **runbook_registry**, **notification** (see YAML) | **No** |
| **`network-ops-l1l2-triage`** | NET-board L1/L2 triage with OSS and knowledge-base context | **`ticket_id`** | **Jira**, **Ericsson OSS**, **Netcracker**, **ServiceNow KB** | **No** |
| **`ticket-email-routing`** | Jira + escalation matrix + AgentMail handoff with scheduled follow-ups and engineer replies | **`order_id`** | **Jira**, **escalation_matrix**, **AgentMail** | **Yes** — **`follow_up.mode: agentmail`** |
| **`stuck-order-resolution`** | Investigate and escalate stuck orders across OSS and CRM data | **`order_id`** | **amdocs_oms**, **siebel_crm**, **ericsson**, **netcracker**, **escalation_matrix**, **notification** | **No** |

## README paths

| Folder | README path |
|--------|-------------|
| esim-activation-resolution | `templates/esim-activation-resolution/README.md` |
| number-porting-resolution | `templates/number-porting-resolution/README.md` |
| network-ops-l1l2-triage | `templates/network-ops-l1l2-triage/README.md` |
| ticket-email-routing | `templates/ticket-email-routing/README.md` |
| stuck-order-adk | `templates/stuck-order-adk/README.md` |

**Note:** The **`stuck-order-adk`** folder uses **`template_id: stuck-order-resolution`** in its YAML.

Add new rows when you introduce templates under **`templates/`**.

## Further reading

- [Workflow YAML](/guides/workflow-yaml)
- [Adapters](/guides/adapters)
