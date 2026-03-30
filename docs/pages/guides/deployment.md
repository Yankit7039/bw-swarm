---
title: Deployment
description: Infra entry points for Docker, Kubernetes, and cloud.
---

# Deployment

## Kind (local full stack)

The recommended way to run **backend and runtime systems** together locally (Postgres in-cluster, adapter MCP, runtime, warm pools, admin-api) is:

- **[Kind cluster quickstart](/tutorials/kind-quickstart)** — documents `OPENROUTER_API_KEY=... ./scripts/quickstart.sh` and the equivalent manual `kubectl` / `docker build` steps.

Runtime is exposed at **`http://localhost:30080`** and Admin API at **`http://localhost:30081`** (NodePorts).

## Docker Compose

`infra/docker/docker-compose.yml` provides:

- **postgres** — Port `5432`
- **redis** — Port `6379` (available for other components; runtime path is Postgres-centric)
- **runtime** — Image built from `runtime/Dockerfile`, port `8000`

```bash
cd infra/docker
docker compose up -d
```

## Kubernetes

- Manifests live under `infra/k8s/` and `infra/k8s-aws/` (e.g. warm pool deployments, admin-api NodePort).
- Per-template warm pool YAML often pairs with an image built from `templates/<name>/`.

See `infra/k8s-aws/README.md` and template READMEs for image build and `kubectl apply` order.

## Terraform (AWS / EKS)

`infra/terraform/prod` targets EKS and related AWS resources. The infra README notes workspace naming and ALB webhook readiness.

## Admin API in cluster

After a Kind quickstart (if your repo provides one), Admin API may be exposed at **NodePort** `30081` — see `admin-api/README.md` in the repo.

## Observability

See `observability/README.md` for tracing and APM integration notes.
