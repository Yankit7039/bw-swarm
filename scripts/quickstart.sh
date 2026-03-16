#!/usr/bin/env bash
# Kind cluster quickstart — create cluster, build/load images, apply manifests.
# Postgres runs in-cluster only. Run from repo root: ./scripts/quickstart.sh
# Optional: OPENROUTER_API_KEY=sk-or-v1-... ./scripts/quickstart.sh
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Verify required CLI tools are available early.
missing=0
for cmd in kubectl kind docker; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd (install it and ensure it's on PATH)"
    missing=1
  fi
done
if [ "$missing" -ne 0 ]; then
  exit 1
fi

OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-$1}"
if [ -z "$OPENROUTER_API_KEY" ] || [ "$OPENROUTER_API_KEY" = "sk-or-v1-..." ]; then
  echo "Set OPENROUTER_API_KEY (env or first arg). Example: OPENROUTER_API_KEY=sk-or-v1-xxx ./scripts/quickstart.sh"
  exit 1
fi

echo "==> 1. Create cluster"
kind create cluster --config infra/k8s/kind-cluster.yaml

echo "==> 2. Build images"
docker build -t stuck-order-adk:latest templates/stuck-order-adk
docker build -f runtime/Dockerfile -t swarm-runtime:latest .

echo "==> 3. Load images into Kind"
kind load docker-image stuck-order-adk:latest
kind load docker-image swarm-runtime:latest

echo "==> 4. Install agent-sandbox CRDs"
kubectl apply -f https://github.com/kubernetes-sigs/agent-sandbox/releases/download/v0.1.1/manifest.yaml
kubectl apply -f https://github.com/kubernetes-sigs/agent-sandbox/releases/download/v0.1.1/extensions.yaml

echo "==> 5. Create secret"
kubectl create secret generic adk-secrets \
  --from-literal=database-url='postgresql+asyncpg://swarm:swarm@postgres:5432/swarm' \
  --from-literal=openrouter-api-key="$OPENROUTER_API_KEY"

echo "==> 6. Apply manifests (Postgres in-cluster)"
kubectl apply -f infra/k8s/postgres.yaml
kubectl apply -f infra/k8s/runtime-rbac.yaml
kubectl apply -f infra/k8s/runtime-deployment.yaml
kubectl apply -f infra/k8s/warmpool-stuck-order-adk.yaml

echo "==> 7. Wait for runtime"
kubectl rollout status deployment/runtime --timeout=60s

echo "==> 8. Pods"
kubectl get pods

echo
echo "Runtime: http://localhost:30080"
echo "Watch pods: kubectl get pods -w"
