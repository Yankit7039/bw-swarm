# Infra

Infrastructure concerns for Swarm Infra: database (persistent state for runs and config), Redis (message broker / event queue for webhooks and events), and deployment (K8s or multi-Docker).

- **terraform/prod** — AWS EKS and related resources. `terraform apply` expects **AWS CLI** (same as EKS auth) and **Python** (`python` or `python3`) on the PATH so a `null_resource` can poll until the ALB controller webhook is ready before creating Ingress resources.

  **Workspace migration:** If you previously used `script-testing` for dev, run once: `terraform -chdir=terraform/prod workspace rename script-testing dev`

- **docker/** — Docker Compose (Postgres, Redis, runtime service).
- **k8s/** — Kubernetes manifests (e.g. `warmpool-swarm-core.yaml` for the shared SandboxWarmPool; worker image is `swarm-core`).
