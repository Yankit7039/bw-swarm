---
title: Templates
description: How template packages relate to the runtime, database, warm pool, and workflow YAML.
---

# Templates

## What is a template?

A **template** is a deployable unit that implements one automation scenario (e.g. eSIM activation, number porting, ticket email routing). It usually includes:

- A **Dockerfile** that **`FROM`** the **`swarm-core`** base image (**`BASE_IMAGE`**) and may **`COPY`** a default **`workflow.yaml`** into the image
- Optional **workflow YAML** in the repo — often also stored in **`templates.workflow_yaml`** in Postgres (authoritative for many deployments)

## Registration

Template metadata lives in the **`templates`** table:

| Column | Role |
|--------|------|
| **`template_id`** | Primary key; used in **`POST /runs`**
| **`name`** | Display name |
| **`image`** | Container image reference (for builds / legacy paths) |
| **`warm_pool_ref`** | Name of the **SandboxTemplate** / warm pool (typically **`swarm-core-pool`**) |
| **`workflow_yaml`** | Full YAML document (optional if file baked into image) |
| **`config`** | JSON metadata |

Seeds and migrations under **`runtime/db/migrations/`** can load YAML from the repo into **`workflow_yaml`**.

## Warm pool

In the standard architecture, **all templates share one generic warm pool** (e.g. **`swarm-core-pool`**) of **`swarm-core`** images. Pods load **workflow YAML per `run_id`** from the database, so you do not need a different pool image per template unless you operate a custom layout.

## Runtime relationship

The runtime does not embed template business logic. It:

1. Accepts **`template_id`** + **`payload`**
2. Loads the template row (**`warm_pool_ref`**, config, YAML pointer)
3. Creates a **SandboxClaim** and **`POST`**s to the assigned **swarm-core** pod

## Workflow YAML overview

Workflows declare **stages** and **steps** (`mcp_call`, `llm_agent`, `condition`, `poll_loop`). Optional **`follow_up`** configures AgentMail follow-up behavior when **`mode: agentmail`**.

Full reference: [Workflow YAML](/guides/workflow-yaml).

## Editing workflow YAML

Operators can update **`workflow_yaml`** via **Admin Console** (template detail → edit → save), which calls **Admin API** **`PATCH /templates/{template_id}`** with `{ "workflow_yaml": "..." }`.

## Catalog

See the [templates catalog](/guides/templates-catalog) for links to each template’s README in the repo.
