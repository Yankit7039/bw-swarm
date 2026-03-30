---
title: Repository layout
description: Main directories in the bw-swarm monorepo.
---

# Repository layout

| Path | Contents |
|------|-----------|
| `runtime/` | FastAPI orchestrator, DB migrations, Dockerfile |
| `admin-api/` | FastAPI admin/read API + template YAML PATCH |
| `admin-console/` | Vite + React management UI |
| `templates/` | One folder per template (agent, YAML, image build) |
| `adapter/` | Adapter service for external integrations |
| `swarm-core/` | Shared core libraries |
| `infra/` | Docker Compose, K8s manifests, Terraform |
| `observability/` | Monitoring / tracing notes and config |
| `bible/` | Internal product notes, diagrams, plans (not all mirrored here) |
| `docs/` | This Tome documentation site |

See also the [templates catalog](/guides/templates-catalog) for links into `templates/*/README.md`.
