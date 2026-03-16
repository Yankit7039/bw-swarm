#!/usr/bin/env bash
# Kind cluster quickstart — create cluster, build/load images, apply manifests.
# Postgres runs in-cluster only.
# Run from repo root:
#   OPENROUTER_API_KEY=sk-or-v1-... ./scripts/quickstart.sh
#   ./scripts/quickstart.sh sk-or-v1-...
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo -e "${BLUE}=== Swarm Kind Quickstart ===${NC}"
echo

# Verify required CLI tools are available early.
missing=0
for cmd in kubectl kind docker; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo -e "${RED}✗ Missing required command: ${cmd}${NC} (install it and ensure it's on PATH)"
    missing=1
  else
    echo -e "${GREEN}✓ Found ${cmd}${NC}"
  fi
done
if [ "$missing" -ne 0 ]; then
  echo -e "${RED}Aborting quickstart due to missing commands.${NC}"
  exit 1
fi

OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-$1}"
if [ -z "$OPENROUTER_API_KEY" ] || [ "$OPENROUTER_API_KEY" = "sk-or-v1-..." ]; then
  echo -e "${RED}OPENROUTER_API_KEY is not set.${NC}"
  echo -e "${YELLOW}Set it via env or first arg, for example:${NC}"
  echo "  OPENROUTER_API_KEY=sk-or-v1-xxx ./scripts/quickstart.sh"
  echo "  ./scripts/quickstart.sh sk-or-v1-xxx"
  exit 1
fi

echo
echo -e "${BLUE}==> 1. Create cluster${NC}"
kind create cluster --config infra/k8s/kind-cluster.yaml

echo
echo -e "${BLUE}==> 2. Build images${NC}"
docker build -t stuck-order-adk:latest templates/stuck-order-adk
docker build -f runtime/Dockerfile -t swarm-runtime:latest .

echo
echo -e "${BLUE}==> 3. Load images into Kind${NC}"
kind load docker-image stuck-order-adk:latest
kind load docker-image swarm-runtime:latest

echo
echo -e "${BLUE}==> 4. Install agent-sandbox CRDs${NC}"
kubectl apply -f https://github.com/kubernetes-sigs/agent-sandbox/releases/download/v0.1.1/manifest.yaml
kubectl apply -f https://github.com/kubernetes-sigs/agent-sandbox/releases/download/v0.1.1/extensions.yaml

echo
echo -e "${BLUE}==> 5. Create secret (adk-secrets)${NC}"
kubectl create secret generic adk-secrets \
  --from-literal=database-url='postgresql+asyncpg://swarm:swarm@postgres:5432/swarm' \
  --from-literal=openrouter-api-key="$OPENROUTER_API_KEY" \
  >/dev/null 2>&1 || {
  echo -e "${YELLOW}Secret adk-secrets already exists, reusing it.${NC}"
}

echo
echo -e "${BLUE}==> 6. Apply manifests (Postgres in-cluster)${NC}"
kubectl apply -f infra/k8s/postgres.yaml
kubectl apply -f infra/k8s/runtime-rbac.yaml
kubectl apply -f infra/k8s/runtime-deployment.yaml
kubectl apply -f infra/k8s/warmpool-stuck-order-adk.yaml

echo
echo -e "${BLUE}==> 7. Wait for runtime deployment${NC}"
kubectl rollout status deployment/runtime --timeout=120s

echo
echo -e "${BLUE}==> 8. Current pods${NC}"
kubectl get pods

echo
echo -e "${GREEN}✓ Quickstart complete.${NC}"
echo -e "${BLUE}Runtime:${NC} http://localhost:30080"
echo -e "${BLUE}Watch pods:${NC} kubectl get pods -w"
