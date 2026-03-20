# =============================================================================
# SWARM Infrastructure Makefile
# Usage:
#   make deploy ENV=dev
#   make deploy ENV=prod
#   make destroy ENV=dev
#   make destroy ENV=prod
# =============================================================================

SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c

# ── Defaults ──────────────────────────────────────────────────────────────────
ENV          ?= dev
TF_DIR        = infra/terraform/prod
AWS_REGION    = ap-southeast-1
AWS_ACCOUNT   = 718277287766
ECR_BASE      = $(AWS_ACCOUNT).dkr.ecr.$(AWS_REGION).amazonaws.com

# ── Environment-specific config ───────────────────────────────────────────────
ifeq ($(ENV),prod)
  TF_WORKSPACE  = default
  TF_VARS_FLAG  = -var-file="terraform.tfvars"
  ECR_PREFIX    =
else
  TF_WORKSPACE  = script-testing
  TF_VARS_FLAG  = -var-file="dev.tfvars"
  ECR_PREFIX    = swarm-dev-
endif

# ── Image definitions: name:context:dockerfile ────────────────────────────────
IMAGES = \
  swarm-runtime:.:runtime/Dockerfile \
  swarm-adapter:adapter:adapter/Dockerfile \
  swarm-admin-api:.:admin-api/Dockerfile \
  stuck-order-adk:templates/stuck-order-adk:templates/stuck-order-adk/Dockerfile

# ── K8s manifests in apply order ─────────────────────────────────────────────
K8S_MANIFESTS = \
  infra/k8s-aws/runtime-rbac.yaml \
  infra/k8s-aws/cluster-secret-store.yaml \
  infra/k8s-aws/external-secret.yaml \
  infra/k8s-aws/adapter-deployment.yaml \
  infra/k8s-aws/runtime-deployment.yaml \
  infra/k8s-aws/admin-api-deployment.yaml \
  infra/k8s-aws/warmpool-stuck-order-adk.yaml

# =============================================================================
# PUBLIC TARGETS
# =============================================================================

.PHONY: deploy destroy help

help:
	@echo ""
	@echo "  make deploy ENV=dev    - Deploy full stack to dev environment"
	@echo "  make deploy ENV=prod   - Deploy full stack to prod environment"
	@echo "  make destroy ENV=dev   - Destroy dev environment"
	@echo "  make destroy ENV=prod  - Destroy prod environment"
	@echo ""

deploy: _check-env _tf-apply _kubeconfig _ecr-login _build-push _k8s-apply _health-check
	@echo ""
	@echo "===> Deploy complete for ENV=$(ENV)"
	@echo "     Runtime : $$(terraform -chdir=$(TF_DIR) output -raw runtime_url)"
	@echo "     API     : $$(terraform -chdir=$(TF_DIR) output -raw api_url)"
	@echo ""

destroy: _check-env _pre-destroy-cleanup _tf-destroy
	@echo ""
	@echo "===> Destroy complete for ENV=$(ENV)"
	@echo ""

# =============================================================================
# PRIVATE TARGETS
# =============================================================================

_check-env:
	@echo "==> [1/7] Checking environment: ENV=$(ENV)"
	@if [ "$(ENV)" != "dev" ] && [ "$(ENV)" != "prod" ]; then \
	  echo "ERROR: ENV must be 'dev' or 'prod'. Got: $(ENV)"; \
	  exit 1; \
	fi
	@command -v terraform >/dev/null 2>&1 || { echo "ERROR: terraform not found"; exit 1; }
	@command -v aws >/dev/null 2>&1 || { echo "ERROR: aws CLI not found"; exit 1; }
	@command -v docker >/dev/null 2>&1 || { echo "ERROR: docker not found"; exit 1; }
	@command -v kubectl >/dev/null 2>&1 || { echo "ERROR: kubectl not found"; exit 1; }
	@command -v curl >/dev/null 2>&1 || { echo "ERROR: curl not found"; exit 1; }

_tf-apply:
	@echo "==> [2/7] Terraform apply (workspace: $(TF_WORKSPACE))"
	terraform -chdir=$(TF_DIR) workspace select $(TF_WORKSPACE) 2>/dev/null || \
	  terraform -chdir=$(TF_DIR) workspace new $(TF_WORKSPACE)
	terraform -chdir=$(TF_DIR) apply -auto-approve $(TF_VARS_FLAG)

_kubeconfig:
	@echo "==> [3/7] Updating kubeconfig"
	$(eval CLUSTER_NAME := $(shell terraform -chdir=$(TF_DIR) output -raw eks_cluster_name))
	aws eks update-kubeconfig --region $(AWS_REGION) --name $(CLUSTER_NAME)

_ecr-login:
	@echo "==> [4/7] Logging in to ECR"
	aws ecr get-login-password --region $(AWS_REGION) | \
	  docker login --username AWS --password-stdin $(ECR_BASE)

_build-push:
	@echo "==> [5/7] Building and pushing images (prefix: '$(ECR_PREFIX)')"
	@for entry in $(IMAGES); do \
	  name=$$(echo $$entry | cut -d: -f1); \
	  ctx=$$(echo $$entry | cut -d: -f2); \
	  df=$$(echo $$entry | cut -d: -f3); \
	  ecr_repo=$(ECR_BASE)/$(ECR_PREFIX)$$name; \
	  echo "  --> Building $$name"; \
	  docker build -f $$df -t $$name:latest $$ctx; \
	  docker tag $$name:latest $$ecr_repo:latest; \
	  docker push $$ecr_repo:latest; \
	done

_k8s-apply:
	@echo "==> [6/7] Applying Kubernetes manifests"
	$(eval SECRET_NAME := $(shell terraform -chdir=$(TF_DIR) output -raw adk_secrets_arn | sed 's|arn:aws:secretsmanager:[^:]*:[^:]*:secret:||' | sed 's|-[^-]*$$||'))
	$(eval ECR_RUNTIME := $(ECR_BASE)/$(ECR_PREFIX)swarm-runtime:latest)
	$(eval ECR_ADAPTER := $(ECR_BASE)/$(ECR_PREFIX)swarm-adapter:latest)
	$(eval ECR_ADMIN   := $(ECR_BASE)/$(ECR_PREFIX)swarm-admin-api:latest)
	$(eval ECR_ADK     := $(ECR_BASE)/$(ECR_PREFIX)stuck-order-adk:latest)
	@echo "  --> Applying agent-sandbox CRDs"
	kubectl apply -f infra/k8s-aws/agent-sandbox-manifest.yaml
	kubectl apply -f infra/k8s-aws/agent-sandbox-extensions.yaml
	@echo "  --> Waiting for CRDs to establish"
	kubectl wait --for=condition=established \
	  crd/sandboxtemplates.extensions.agents.x-k8s.io \
	  crd/sandboxwarmpools.extensions.agents.x-k8s.io \
	  --timeout=60s 2>/dev/null || true
	@echo "  --> Applying manifests with substituted image URLs"
	@for f in $(K8S_MANIFESTS); do \
	  echo "    applying $$f"; \
	  sed \
	    -e 's|$(ECR_BASE)/swarm-runtime:latest|$(ECR_RUNTIME)|g' \
	    -e 's|$(ECR_BASE)/swarm-adapter:latest|$(ECR_ADAPTER)|g' \
	    -e 's|$(ECR_BASE)/swarm-admin-api:latest|$(ECR_ADMIN)|g' \
	    -e 's|$(ECR_BASE)/stuck-order-adk:latest|$(ECR_ADK)|g' \
	    -e 's|REPLACE_WITH_SECRET_NAME|$(SECRET_NAME)|g' \
	    $$f | kubectl apply -f -; \
	done
	@echo "  --> Ingress managed by Terraform (infra/terraform/prod/main.tf)"
	@echo "  --> Waiting for deployments to be ready"
	kubectl rollout status deployment/runtime --timeout=180s
	kubectl rollout status deployment/admin-api --timeout=180s
	kubectl rollout status deployment/adapter --timeout=180s

_health-check:
	@echo "==> [7/7] Health check"
	$(eval RUNTIME_URL := $(shell terraform -chdir=$(TF_DIR) output -raw runtime_url))
	$(eval API_URL     := $(shell terraform -chdir=$(TF_DIR) output -raw api_url))
	@echo "  --> Polling for health (max 24 attempts, 5s interval)"
	@max=24; int=5; ok=0; i=0; \
	while [ $$i -lt $$max ]; do \
	  if curl -sf $(RUNTIME_URL)/health >/dev/null 2>&1 && curl -sf $(API_URL)/health >/dev/null 2>&1; then \
	    echo "  --> Both endpoints healthy after $$(( i * int ))s"; ok=1; break; \
	  fi; \
	  i=$$((i + 1)); [ $$i -lt $$max ] && sleep $$int; \
	done; \
	if [ "$$ok" != "1" ]; then echo "ERROR: Health check failed"; exit 1; fi

_pre-destroy-cleanup:
	@echo "==> [1/2] Pre-destroy cleanup"
	terraform -chdir=$(TF_DIR) workspace select $(TF_WORKSPACE)
	@current=$$(terraform -chdir=$(TF_DIR) workspace show | tr -d '\r\n'); \
	if [ "$$current" != "$(TF_WORKSPACE)" ]; then \
	  echo "ERROR: Workspace mismatch; expected $(TF_WORKSPACE), got $$current"; \
	  exit 1; \
	fi
	$(eval VPC_ID := $(shell terraform -chdir=$(TF_DIR) output -raw vpc_id 2>/dev/null || echo ""))
	$(eval CLUSTER_NAME := $(shell terraform -chdir=$(TF_DIR) output -raw eks_cluster_name 2>/dev/null || echo ""))
	@if [ -z "$(VPC_ID)" ] || [ -z "$(CLUSTER_NAME)" ]; then \
	  echo "ERROR: Could not get VPC ID or cluster name for workspace $(TF_WORKSPACE), aborting cleanup"; \
	  exit 1; \
	fi
	@echo "  --> Updating kubeconfig for cluster $(CLUSTER_NAME)"
	@aws eks update-kubeconfig --region $(AWS_REGION) --name $(CLUSTER_NAME)
	@echo "  --> Deleting Ingresses (Kubernetes-first so ALB controller can reconcile)"
	@kubectl delete ingress runtime-ingress admin-api-ingress -n default --wait=true --timeout=120s 2>/dev/null || true
	@for ing in runtime-ingress admin-api-ingress; do \
	  if kubectl get ingress $$ing -n default 2>/dev/null | grep -q .; then \
	    echo "    Patching finalizers on $$ing (controller may be gone)"; \
	    kubectl patch ingress $$ing -n default --type=json -p='[{"op":"remove","path":"/metadata/finalizers"}]' 2>/dev/null || true; \
	    kubectl delete ingress $$ing -n default --force --grace-period=0 2>/dev/null || true; \
	  fi; \
	done
	@echo "  --> Removing Helm releases from Terraform state (uninstall via kubectl is unreliable after cluster teardown)"
	@terraform -chdir=$(TF_DIR) state rm helm_release.aws_load_balancer_controller 2>/dev/null || true
	@terraform -chdir=$(TF_DIR) state rm helm_release.external_secrets 2>/dev/null || true
	@terraform -chdir=$(TF_DIR) state rm kubernetes_namespace.external_secrets 2>/dev/null || true
	@terraform -chdir=$(TF_DIR) state rm null_resource.wait_for_alb_webhook 2>/dev/null || true
	@echo "  --> Polling until no ALBs remain in VPC $(VPC_ID) (timeout 20m)"
	@elb_timeout=1200; elb_interval=15; elapsed=0; \
	while [ $$elapsed -lt $$elb_timeout ]; do \
	  count=$$(aws elbv2 describe-load-balancers --region $(AWS_REGION) \
	    --query "length(LoadBalancers[?VpcId=='$(VPC_ID)'])" --output text 2>/dev/null || echo "0"); \
	  if [ "$$count" = "0" ] || [ "$$count" = "None" ]; then \
	    echo "    No ALBs remaining"; break; \
	  fi; \
	  echo "    $$count ALB(s) still in VPC, waiting $$elb_interval s..."; \
	  sleep $$elb_interval; elapsed=$$((elapsed + elb_interval)); \
	done; \
	if [ $$elapsed -ge $$elb_timeout ]; then echo "WARN: ALB poll timed out"; fi
	@echo "  --> Force deleting Secrets Manager secrets"
	@SECRET_ARN=$$(terraform -chdir=$(TF_DIR) output -raw adk_secrets_arn 2>/dev/null || echo ""); \
	if [ -n "$$SECRET_ARN" ]; then \
	  aws secretsmanager delete-secret \
	    --secret-id "$$SECRET_ARN" \
	    --force-delete-without-recovery \
	    --region $(AWS_REGION) 2>/dev/null || true; \
	  echo "    Deleted secret $$SECRET_ARN"; \
	fi

_tf-destroy:
	@echo "==> [2/2] Terraform destroy (workspace: $(TF_WORKSPACE))"
	terraform -chdir=$(TF_DIR) destroy -auto-approve $(TF_VARS_FLAG)