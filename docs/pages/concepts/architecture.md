---
title: Architecture
description: High-level architecture of bw-swarm services and shared data.
---

# Architecture

## Mental model

1. **Postgres** is the system of record for templates, runs, run events, and related configuration.
2. **Runtime** creates runs and drives execution by talking to **sandbox pods** (warm pools / K8s) that load the right **template** image.
3. **Admin API** exposes the same database to **Admin Console** for operations and template YAML management (list/get templates, patch workflow YAML, list runs and events).
4. **Templates** are independent codebases (Python agents, YAML workflows) deployed as images; their metadata and `workflow_yaml` live in the `templates` table.

## Adapter vs runtime vs admin-api

| Layer | Responsibility |
|-------|------------------|
| **Runtime** | Run creation, webhook ingress, enqueueing sandbox work, run/event writes from workers |
| **Admin API** | Query (and limited update) API for operators; does not execute runs |
| **Adapter service** | Normalizes calls to external systems (CRM, email, etc.) so templates stay thinner |

## Shared database

Runtime and admin-api both use `DATABASE_URL` against the same Postgres. Migrations under `runtime/db/migrations/` evolve the shared schema (runs, templates, run_events, etc.).

## Further reading

- [Data flow](/concepts/data-flow)
- [Repository layout](/concepts/repo-layout)
- Repository root `README.md` — component list
