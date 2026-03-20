# SWARM on AWS – Full Deployment Guide

> For Makefile-based deploy/destroy, see [AWS_QUICKSTART.md](AWS_QUICKSTART.md).

This guide walks you through deploying SWARM to AWS on EKS in `ap-southeast-1` in **one AWS account**:

- AWS Account ID: `718277287766`
- Region: `ap-southeast-1`

It covers:
- Bootstrapping Terraform remote state
- Deploying core infrastructure (VPC, EKS, RDS, ECR, Secrets, controllers)
- Building, tagging, and pushing Docker images to ECR
- Pointing `kubectl` at the EKS cluster (not your local kind cluster)
- Applying Kubernetes manifests in the right order
- Common verification and debugging commands

> All commands assume you are running them from the repo root: `C:\Users\Dell\Desktop\bw\bw-swarm`.

---

## 1. Prerequisites

- **AWS account**: `718277287766` with admin‑level or sufficient permissions for:
  - S3, DynamoDB, VPC, EKS, RDS, ECR, IAM, Secrets Manager, CloudWatch, EC2, ELB.
- **Tools installed**:
  - Terraform >= **1.6**
  - AWS CLI v2
  - Docker
  - `kubectl`
  - (Optional) `jq` for pretty JSON in shells
- **AWS CLI configured** for `ap-southeast-1`:

```powershell
aws configure
# Use region: ap-southeast-1
```

---

## 2. Bootstrap Terraform Remote State (run once)

This creates:
- S3 bucket: `swarm-terraform-state-718277287766`
- DynamoDB table: `swarm-terraform-locks`

### PowerShell (Windows)

```powershell
cd C:\Users\Dell\Desktop\bw\bw-swarm

terraform -chdir=infra/terraform/backend init
terraform -chdir=infra/terraform/backend plan
terraform -chdir=infra/terraform/backend apply
```

Capture outputs:

```powershell
terraform -chdir=infra/terraform/backend output
```

You should see at least:
- `region` (should be `ap-southeast-1`)
- `state_bucket_name` (e.g. `swarm-terraform-state-718277287766`)
- `lock_table_name` (e.g. `swarm-terraform-locks`)

> These already match the backend config in `infra/terraform/prod/main.tf` (bucket and DynamoDB table names), so no manual editing should be required.

### Bash (Linux/macOS)

```bash
cd /path/to/bw-swarm

terraform -chdir=infra/terraform/backend plan
terraform -chdir=infra/terraform/backend init
terraform -chdir=infra/terraform/backend apply

terraform -chdir=infra/terraform/backend output
```

---

## 3. Deploy Core Infra (`infra/terraform/prod`)

This will deploy:
- VPC (public + private subnets)
- EKS cluster + managed node group
- RDS Postgres 16 (private)
- ECR repositories
- Secrets Manager secret `swarm-prod/adk-secrets`
- External Secrets Operator
- AWS Load Balancer Controller

### 3.1 Set OpenRouter API key

#### PowerShell

```powershell
cd C:\Users\Dell\Desktop\bw\bw-swarm

$env:TF_VAR_openrouter_api_key = "sk-or-v1-REPLACE_ME"
```

#### Bash

```bash
cd /path/to/bw-swarm

export TF_VAR_openrouter_api_key="sk-or-v1-REPLACE_ME"
```

### 3.2 Init and apply prod

#### PowerShell

```powershell
terraform -chdir=infra/terraform/prod init
terraform -chdir=infra/terraform/prod plan
terraform -chdir=infra/terraform/prod apply
```

#### Bash

```bash
terraform -chdir=infra/terraform/prod plan
terraform -chdir=infra/terraform/prod init
terraform -chdir=infra/terraform/prod apply
```

### 3.3 Useful Terraform outputs

```powershell
terraform -chdir=infra/terraform/prod output

# Individual values
$cluster = terraform -chdir=infra/terraform/prod output -raw eks_cluster_name
$region  = terraform -chdir=infra/terraform/prod output -raw region    # ap-southeast-1

terraform -chdir=infra/terraform/prod output -json ecr_repository_urls
```

`ecr_repository_urls` will be a map of:
- `stuck-order-adk`
- `swarm-adapter`
- `swarm-runtime`
- `swarm-admin-api`

---

## 4. Configure kubectl for EKS (Not kind)

You probably have a local `kind` cluster. We want `kubectl` to point at **EKS**, not kind.

### 4.1 Update kubeconfig from Terraform outputs

#### PowerShell

```powershell
cd C:\Users\Dell\Desktop\bw\bw-swarm

$cluster = terraform -chdir=infra/terraform/prod output -raw eks_cluster_name
$region  = terraform -chdir=infra/terraform/prod output -raw region

aws eks update-kubeconfig --name $cluster --region $region
```

#### Bash

```bash
cd /path/to/bw-swarm

cluster=$(terraform -chdir=infra/terraform/prod output -raw eks_cluster_name)
region=$(terraform -chdir=infra/terraform/prod output -raw region)

aws eks update-kubeconfig --name "$cluster" --region "$region"
```

### 4.2 Verify and switch contexts

```powershell
kubectl config get-contexts
kubectl config current-context

# If needed, explicitly select the EKS context:
kubectl config use-context <eks-context-name>
```

> Once the EKS context is current, all `kubectl apply` commands below will target EKS, not your local kind cluster.

---

## 5. Build, Tag, and Push Docker Images to ECR

Terraform has created ECR repositories in:
- `718277287766.dkr.ecr.ap-southeast-1.amazonaws.com`

You need to:
1. Log in to ECR.
2. Build images for each component.
3. Tag with the correct ECR repo.
4. Push.

### 5.1 Log in to ECR

#### PowerShell

```powershell
aws ecr get-login-password --region ap-southeast-1 `
  | docker login --username AWS --password-stdin `
    718277287766.dkr.ecr.ap-southeast-1.amazonaws.com
```

#### Bash

```bash
aws ecr get-login-password --region ap-southeast-1 \
  | docker login --username AWS --password-stdin \
    718277287766.dkr.ecr.ap-southeast-1.amazonaws.com
```

### 5.2 Components and their Docker build contexts

| Component        | Context directory       | ECR repo name      |
|-----------------|-------------------------|--------------------|
| Runtime         | `./runtime`             | `swarm-runtime`    |
| Admin API       | `./admin-api`           | `swarm-admin-api`  |
| Adapter         | `./adapter`             | `swarm-adapter`    |
| Stuck-order ADK | `./templates/stuck-order-adk` | `stuck-order-adk` |

### 5.3 Example: build & push **runtime**

#### PowerShell

```powershell
cd C:\Users\Dell\Desktop\bw\bw-swarm

docker build -t swarm-runtime .\runtime

docker tag swarm-runtime `
  718277287766.dkr.ecr.ap-southeast-1.amazonaws.com/swarm-runtime:latest

docker push 718277287766.dkr.ecr.ap-southeast-1.amazonaws.com/swarm-runtime:latest
```

#### Bash

```bash
cd /path/to/bw-swarm

docker build -t swarm-runtime ./runtime

docker tag swarm-runtime \
  718277287766.dkr.ecr.ap-southeast-1.amazonaws.com/swarm-runtime:latest

docker push 718277287766.dkr.ecr.ap-southeast-1.amazonaws.com/swarm-runtime:latest
```

### 5.4 Repeat for the other images

#### Admin API

```powershell
docker build -t swarm-admin-api .\admin-api
docker tag swarm-admin-api `
  718277287766.dkr.ecr.ap-southeast-1.amazonaws.com/swarm-admin-api:latest
docker push 718277287766.dkr.ecr.ap-southeast-1.amazonaws.com/swarm-admin-api:latest
```

```bash
docker build -t swarm-admin-api ./admin-api
docker tag swarm-admin-api \
  718277287766.dkr.ecr.ap-southeast-1.amazonaws.com/swarm-admin-api:latest
docker push 718277287766.dkr.ecr.ap-southeast-1.amazonaws.com/swarm-admin-api:latest
```

#### Adapter

```powershell
docker build -t swarm-adapter .\adapter
docker tag swarm-adapter `
  718277287766.dkr.ecr.ap-southeast-1.amazonaws.com/swarm-adapter:latest
docker push 718277287766.dkr.ecr.ap-southeast-1.amazonaws.com/swarm-adapter:latest
```

```bash
docker build -t swarm-adapter ./adapter
docker tag swarm-adapter \
  718277287766.dkr.ecr.ap-southeast-1.amazonaws.com/swarm-adapter:latest
docker push 718277287766.dkr.ecr.ap-southeast-1.amazonaws.com/swarm-adapter:latest
```

#### Stuck-order ADK

```powershell
docker build -t stuck-order-adk .\templates\stuck-order-adk
docker tag stuck-order-adk `
  718277287766.dkr.ecr.ap-southeast-1.amazonaws.com/stuck-order-adk:latest
docker push 718277287766.dkr.ecr.ap-southeast-1.amazonaws.com/stuck-order-adk:latest
```

```bash
docker build -t stuck-order-adk ./templates/stuck-order-adk
docker tag stuck-order-adk \
  718277287766.dkr.ecr.ap-southeast-1.amazonaws.com/stuck-order-adk:latest
docker push 718277287766.dkr.ecr.ap-southeast-1.amazonaws.com/stuck-order-adk:latest
```

---

## 6. Deployment Order (HTTPS + Route 53)

With the HTTPS and Route 53 setup, **Terraform manages the Ingress** via `kubernetes_manifest`. The order is:

### 6.1 Full deployment sequence

| Step | Action | What it creates |
|------|--------|-----------------|
| 1 | `terraform -chdir=infra/terraform/prod apply` | EKS, Helm (ALB controller, External Secrets), ACM cert, DNS validation, **Ingress**, Route 53 alias records |
| 2 | Configure kubectl for EKS | `aws eks update-kubeconfig` |
| 3 | Build and push images to ECR | Docker images for runtime, admin-api, etc. |
| 4 | `kubectl apply` (see 6.2) | Agent-sandbox, external-secret, deployments, warmpool — **skip Ingress** |

**Important**: Do **not** run `kubectl apply` for `ingress.yaml` or `ingress-admin.yaml`. Terraform creates the Ingress with the ACM certificate ARN.

**If you already applied the old Ingress via kubectl**: Delete them first so Terraform can create the new HTTPS-enabled ones:

```powershell
kubectl delete ingress runtime-ingress admin-api-ingress -n default
```

Then run `terraform -chdir=infra/terraform/prod apply`. Terraform will create the new Ingress with HTTPS. The ALB controller will provision new ALBs; Route 53 records will point to them.

### 6.2 Apply manifests in the documented order

You must be on the **EKS context** before running these.

```powershell
kubectl config get-contexts
kubectl config current-context
# If needed: kubectl config use-context <eks-context-name>
```

From `infra/k8s-aws/README.md`:

```powershell
cd C:\Users\Dell\Desktop\bw\bw-swarm

# 1) Agent-sandbox core (includes CRDs + controller)
kubectl apply -f infra/k8s-aws/agent-sandbox-manifest.yaml

# 2) Agent-sandbox extensions (CRDs for SandboxTemplate/WarmPool/etc.)
kubectl apply -f infra/k8s-aws/agent-sandbox-extensions.yaml

# 3) Wait for CRDs to be established
kubectl wait --for=condition=established `
  crd/sandboxtemplates.extensions.agents.x-k8s.io `
  crd/sandboxwarmpools.extensions.agents.x-k8s.io `
  --timeout=60s

# 4) External secrets + app components + warmpool (NO ingress — Terraform manages it)
kubectl apply -f infra/k8s-aws/external-secret.yaml
kubectl apply -f infra/k8s-aws/cluster-secret-store.yaml
kubectl apply -f infra/k8s-aws/runtime-rbac.yaml
kubectl apply -f infra/k8s-aws/adapter-deployment.yaml
kubectl apply -f infra/k8s-aws/runtime-deployment.yaml
kubectl apply -f infra/k8s-aws/admin-api-deployment.yaml
kubectl apply -f infra/k8s-aws/warmpool-stuck-order-adk.yaml
# Skip: kubectl apply -f infra/k8s-aws/ingress.yaml
# Skip: kubectl apply -f infra/k8s-aws/ingress-admin.yaml
```

Same in bash (replace backticks with `\` as needed).

---

## 7. Verify Deployment

### 7.1 Cluster and workloads

```powershell
kubectl get nodes -o wide
kubectl get pods -A
kubectl get svc
kubectl get ingress
```

You should see:
- Services for `runtime`, `admin-api`, `adapter`, etc.
- Two ingresses (e.g. `runtime-ingress`, `admin-api-ingress`) with **hostname** values.

### 7.2 Health checks (HTTPS URLs)

With Route 53 and ACM configured, use the final URLs:

```powershell
# Runtime
curl https://runtime.swarm.singledigit.team/health

# Admin API
curl https://api.swarm.singledigit.team/health
```

Both should return `{"status":"ok"}`.

Or get the ALB hostname directly:

```powershell
kubectl get ingress runtime-ingress -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
curl https://<runtime-alb-hostname>/health
```

---

## 8. Debugging & Troubleshooting

### 8.1 Kubernetes basics

- Pods:

```powershell
kubectl get pods -A
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace>
kubectl logs <pod-name> -c <container-name> -n <namespace>
```

- Events (recent first):

```powershell
kubectl get events --sort-by=.lastTimestamp
```

### 8.2 Terraform

- Show current state:

```powershell
terraform -chdir=infra/terraform/prod state list
```

- Re-run a plan to see changes:

```powershell
terraform -chdir=infra/terraform/prod plan
```

### 8.3 ECR / image issues

- List images:

```powershell
aws ecr list-images `
  --repository-name swarm-runtime `
  --region ap-southeast-1
```

- If pods are in `ImagePullBackOff`, check:
  - Node IAM role has `AmazonEC2ContainerRegistryReadOnly`.
  - Image tag exists (`latest` or whatever you used).

### 8.4 Ingress / ALB issues

- Describe ingress:

```powershell
kubectl describe ingress runtime-ingress
kubectl describe ingress admin-api-ingress
```

- In AWS Console:
  - Check **EC2 → Load Balancers** for the created ALBs.
  - Make sure target groups are **healthy** (targets in `healthy` state).

### 8.5 RDS connectivity

If runtime or admin API pods crash with DB errors:

- Confirm the RDS endpoint Terraform output:

```powershell
terraform -chdir=infra/terraform/prod output -raw rds_endpoint
```

- Ensure `adk-secrets` secret contains a valid `database-url` and is synced:

```powershell
kubectl get secret adk-secrets -o yaml
```

---

## 9. Cleanup (Optional)

> WARNING: This will **destroy data** (RDS) and infrastructure. Be careful.

Destroy prod first, then backend:

```powershell
terraform -chdir=infra/terraform/prod destroy -auto-approve
terraform -chdir=infra/terraform/backend destroy -auto-approve
```

You may also want to:
- Delete ECR images.
- Remove any DNS records pointing to the ALBs.

