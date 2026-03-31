---
title: Deployment
description: Infra entry points for Docker Compose, Kind, Kubernetes on AWS, and Terraform.
---

# Deployment

## Kind (local full stack)

The recommended way to run **backend and runtime systems** together locally (Postgres in-cluster, adapter MCP, runtime, warm pools, admin-api) is:

- **[Kind cluster quickstart](/tutorials/kind-quickstart)** — `OPENROUTER_API_KEY=... ./scripts/quickstart.sh` and manual `kubectl` / `docker build` steps

Runtime is exposed at **`http://localhost:30080`** and Admin API at **`http://localhost:30081`** (NodePorts).

## AWS (EKS)

For production-like deployment:

- **[AWS quickstart](/tutorials/aws-quickstart)** — **`make deploy ENV=dev|prod`**, Terraform, ECR image push, ordered **`kubectl`** applies

Terraform in **`infra/terraform/prod/`** typically provisions:

- **VPC** and subnets (**`module.vpc`**)
- **ECR** repositories for **`swarm-core`**, **`swarm-runtime`**, **`swarm-adapter`**, **`swarm-admin-api`**, and template images (**`module.ecr`**)
- **EKS** cluster and node groups (**`module.eks`**)
- **RDS** Postgres and supporting IAM / secrets wiring (see **`main.tf`**)
- **Kubernetes/Helm** add-ons as defined (load balancer controller, External Secrets, etc.)

The root **`Makefile`** targets **`deploy`** and **`destroy`** with workspace selection (**`dev`** vs **`prod`**) and **`terraform.tfvars`** / **`dev.tfvars`**.

**Apply order for raw manifests:** follow **`infra/k8s-aws/README.md`** — agent-sandbox **CRDs first**, then app manifests and **`warmpool-swarm-core.yaml`**.

## Docker Compose

**`infra/docker/docker-compose.yml`** provides:

- **postgres** — port **`5432`**
- **redis** — port **`6379`** (used by the **runtime** and **admin-api** for the [Redis run queue](/concepts/redis-queue); set **`REDIS_URL`** on those services when you rely on queued webhooks or **`POST /runs/enqueue`**)
- **runtime** — image built from **`runtime/Dockerfile`**, port **`8000`**

```bash
cd infra/docker
docker compose up -d
```

**Compose does not** run the **adapter**, **warm pool**, or **swarm-core** sandbox pods. Use **Kind** or **EKS** for the full execution path.

## Kubernetes (generic)

- Kind manifests: **`infra/k8s/`**
- AWS manifests: **`infra/k8s-aws/`** (do not apply Kind files to EKS)

## Observability

See **`observability/README.md`** for tracing and APM integration notes.

## Further reading

- [Architecture](/concepts/architecture)
- [Warm pool](/concepts/warm-pool)
- [Services](/reference/services)
