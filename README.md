# SWARM — Agent Orchestration Platform

Architecture and design are documented in **[swarm.md](swarm.md)**.

## Components

- **adapter-service** — Integration abstraction layer for external services
- **admin-api** — Admin API for templates, runs, and configuration
- **admin-console** — Management UI for templates, runs, and configuration
- **runtime** — Template-agnostic orchestrator: POST /runs (template_id + payload), GET /runs, GET /runs/events; Postgres, sandbox trigger (see [runtime/README.md](runtime/README.md))
- **templates** — Template implementations (e.g. [stuck-order-adk](templates/stuck-order-adk)): agent + entrypoint; no orchestration
- **infra** — DB and deployment (Docker/K8s); Postgres shared by runtime and templates
- **observability** — Monitoring and tracing (e.g. OpenTelemetry/APM)
- **scripts** — Run and utility scripts
