# SWARM on AWS — Quickstart

Deploy SWARM (runtime, adapter, admin API, stuck-order ADK) to EKS in AWS account `718277287766`, region `ap-southeast-1`. The Makefile automates Terraform, ECR, and Kubernetes rollout.

Run all commands from the repo root.

---

## Prerequisites

- **AWS CLI** configured for the target account and region
- **Terraform** ≥ 1.6, **Docker**, **kubectl**, **curl**

---

## 1. Configure OpenRouter API key

Edit the tfvars file for your target environment:


| Environment | File                                    |
| ----------- | --------------------------------------- |
| Dev         | `infra/terraform/prod/dev.tfvars`       |
| Prod        | `infra/terraform/prod/terraform.tfvars` |


Set:

```
openrouter_api_key = "sk-or-v1-YOUR_KEY_HERE"
```

Do not commit real API keys. Use local edits or a secrets manager.

**Remote state:** If this is a greenfield account, bootstrap once with `infra/terraform/backend` (init, apply). Otherwise the backend is already configured.

---

## 2. Deploy

```bash
make deploy ENV=dev
# or
make deploy ENV=prod
```

Expect **about 20–25 minutes** end-to-end (EKS, RDS, Helm, image builds/pushes, rollouts, health checks).

---

## 3. Destroy

```bash
make destroy ENV=dev
# or
make destroy ENV=prod
```

Expect **about 12–15 minutes** typically. ALB teardown can occasionally take longer (Makefile polls up to 20 minutes).

---

## Debugging


| Command                                                                        | Purpose                                        |
| ------------------------------------------------------------------------------ | ---------------------------------------------- |
| `make help`                                                                    | List deploy/destroy targets                    |
| `terraform -chdir=infra/terraform/prod workspace show`                         | Current Terraform workspace                    |
| `terraform -chdir=infra/terraform/prod output`                                 | URLs, cluster name, etc.                       |
| `kubectl get pods -n default`                                                  | Pod status                                     |
| `kubectl describe pod <name> -n default`                                       | Pod details                                    |
| `kubectl logs deployment/runtime -n default`                                   | Runtime logs (same for `admin-api`, `adapter`) |
| `curl $(terraform -chdir=infra/terraform/prod output -raw runtime_url)/health` | Health check                                   |
| `kubectl get ingress`                                                          | Ingress and ALB hostnames                      |
| `kubectl get events -n default --sort-by=.lastTimestamp`                       | Recent cluster events                          |


