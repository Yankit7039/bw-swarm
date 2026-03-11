# SWARM — Agent Orchestration Platform

Architecture and design are documented in **[swarm.md](swarm.md)**.

## Components

- **adapter-service** — Integration abstraction layer for external services
- **admin-api** — Admin API for templates, runs, and configuration
- **admin-console** — Management UI for templates, runs, and configuration
- **agent-runtime** — Core execution engine for agent workflows
- **infra** — DB, Redis, and deployment (K8s/Docker) for Swarm Infra
- **observability** — Monitoring and tracing (e.g. OpenTelemetry/APM)
- **scripts** — Run and utility scripts
