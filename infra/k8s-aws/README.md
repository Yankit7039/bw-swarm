## SWARM on AWS (EKS)

This folder contains AWS-adapted Kubernetes manifests for SWARM. Do **not** apply `infra/k8s/` to EKS.

### Prerequisites

- **Terraform applied**: `infra/terraform/prod` has been applied successfully (EKS, RDS, ECR, Secrets Manager, External Secrets Operator, AWS Load Balancer Controller).
- **kubectl configured** for the EKS cluster (your kubeconfig context points to the right cluster).
- **Images pushed** to ECR (see `infra/terraform/prod` outputs for repository URLs).
- **ECR placeholders replaced**: replace `<AWS_ACCOUNT_ID>` in all `*-deployment.yaml` and `warmpool-*.yaml` image refs.

### Apply (explicit order)

Do **not** run `kubectl apply -f infra/k8s-aws/` as a single command. `kubectl` applies files in alphabetical order and CRDs may not be established before custom resources.

```bash
# 1) Agent-sandbox core (includes CRDs + controller)
kubectl apply -f infra/k8s-aws/agent-sandbox-manifest.yaml

# 2) Agent-sandbox extensions (CRDs for SandboxTemplate/WarmPool/etc.)
kubectl apply -f infra/k8s-aws/agent-sandbox-extensions.yaml

# 3) Wait for CRDs to be established (avoids "no matches for kind ..." errors)
kubectl wait --for=condition=established \
  crd/sandboxtemplates.extensions.agents.x-k8s.io \
  crd/sandboxwarmpools.extensions.agents.x-k8s.io \
  --timeout=60s

# 4) External secrets + app components + warmpool + ingress
kubectl apply -f infra/k8s-aws/external-secret.yaml
kubectl apply -f infra/k8s-aws/runtime-rbac.yaml
kubectl apply -f infra/k8s-aws/adapter-deployment.yaml
kubectl apply -f infra/k8s-aws/runtime-deployment.yaml
kubectl apply -f infra/k8s-aws/admin-api-deployment.yaml
kubectl apply -f infra/k8s-aws/warmpool-stuck-order-adk.yaml
kubectl apply -f infra/k8s-aws/warmpool-esim-activation-adk.yaml
kubectl apply -f infra/k8s-aws/warmpool-number-porting-adk.yaml
kubectl apply -f infra/k8s-aws/warmpool-ticket-email-routing-adk.yaml
kubectl apply -f infra/k8s-aws/ingress.yaml
kubectl apply -f infra/k8s-aws/ingress-admin.yaml
```

If the CRD names change in a newer agent-sandbox release, replace the `kubectl wait` line with `Start-Sleep -Seconds 10` (PowerShell) or `sleep 10` (bash) after applying the CRD manifests.

### Notes

- **Database**: Postgres runs in **RDS**, not in-cluster. The `DATABASE_URL` comes from the `adk-secrets` Kubernetes secret.
- **Secrets**: `adk-secrets` is created by External Secrets Operator from AWS Secrets Manager via `infra/k8s-aws/external-secret.yaml`. It includes `database-url`, `openrouter-api-key`, and (when set in Terraform) `agentmail-api-key` / `agentmail-inbox-id` for the adapter’s AgentMail MCP tool.
- **Ingress / ALB cost**:
  - `infra/k8s-aws/ingress.yaml` creates an internet-facing ALB for the `runtime` service:
    - `/` → `runtime`
  - `infra/k8s-aws/ingress-admin.yaml` creates a separate internet-facing ALB for the `admin-api` service:
    - `/` → `admin-api`
- **HTTPS / Route 53**: When using the Terraform HTTPS and Route 53 setup (`infra/terraform/prod`), the Ingress is managed by Terraform via `kubernetes_manifest` using the `.tpl` templates. In that case, skip `kubectl apply` for `ingress.yaml` and `ingress-admin.yaml`. If applying manually via kubectl, replace `REPLACE_WITH_TERRAFORM_OUTPUT_ACM_CERTIFICATE_ARN` in those files with `terraform output -raw acm_certificate_arn`.

### Agent-sandbox upgrades

To upgrade agent-sandbox:

1. Download the new release assets:
   - `manifest.yaml`
   - `extensions.yaml`
2. Replace:
   - `infra/k8s-aws/agent-sandbox-manifest.yaml`
   - `infra/k8s-aws/agent-sandbox-extensions.yaml`
3. Re-run the **Apply (explicit order)** commands above.

