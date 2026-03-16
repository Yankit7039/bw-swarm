# Infra

Infrastructure concerns for Swarm Infra: database (persistent state for runs and config), Redis (message broker / event queue for webhooks and events), and deployment (K8s or multi-Docker).

- **docker/** — Docker Compose (Postgres, Redis, runtime service).
- **k8s/** — Kubernetes manifests (e.g. `warmpool-stuck-order-adk.yaml` for SandboxWarmPool; apply after building the template image from `templates/stuck-order-adk`).
