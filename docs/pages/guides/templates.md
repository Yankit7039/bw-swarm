---
title: Templates
description: How template packages relate to the runtime and database.
---

# Templates

## What is a template?

A **template** is a deployable unit that implements one automation scenario (e.g. eSIM activation, number porting). It usually includes:

- Python agent / ADK entrypoint
- Optional **workflow YAML** interpreted at runtime
- Container **image** referenced from the `templates.image` column

## Registration

Template metadata is stored in Postgres (`templates` table). Seeds and refresh migrations under `runtime/db/migrations/` can load YAML from the repo into `workflow_yaml`.

## Runtime relationship

The runtime does not embed template business logic. It:

1. Accepts `template_id` + `payload`
2. Loads the template row (image, config, YAML)
3. Triggers execution in a sandbox pod running that image

## Editing workflow YAML

Operators can update `workflow_yaml` via **Admin Console** (template detail → edit → save), which calls **Admin API** `PATCH /templates/{template_id}` with `{ "workflow_yaml": "..." }`.

## Catalog

See the [templates catalog](/guides/templates-catalog) for links to each template’s README in the repo.
