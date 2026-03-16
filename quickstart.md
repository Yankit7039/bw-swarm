# Kind cluster quickstart

Postgres runs in-cluster only. Run from repo root.

## Using the script

From repo root, set your OpenRouter API key and run:

```bash
OPENROUTER_API_KEY=sk-or-v1-your-key-here ./scripts/quickstart.sh
```

Or pass it as the first argument:

```bash
./scripts/quickstart.sh sk-or-v1-your-key-here
```

The script creates the Kind cluster, builds and loads images, installs agent-sandbox CRDs, creates the secret, and applies all manifests. At the end it prints the runtime URL and suggests `kubectl get pods -w` to watch pods.

---

## Manual steps

### 1. Create cluster

```bash
kind create cluster --config infra/k8s/kind-cluster.yaml
```

### 2. Build images

```bash
docker build -t stuck-order-adk:latest templates/stuck-order-adk
docker build -f runtime/Dockerfile -t swarm-runtime:latest .
```

### 3. Load images into Kind

```bash
kind load docker-image stuck-order-adk:latest
kind load docker-image swarm-runtime:latest
```

### 4. Install agent-sandbox CRDs

```bash
kubectl apply -f https://github.com/kubernetes-sigs/agent-sandbox/releases/download/v0.1.1/manifest.yaml
kubectl apply -f https://github.com/kubernetes-sigs/agent-sandbox/releases/download/v0.1.1/extensions.yaml
```

### 5. Create secret

Replace `sk-or-v1-...` with your OpenRouter API key.

```bash
kubectl create secret generic adk-secrets \
  --from-literal=database-url='postgresql+asyncpg://swarm:swarm@postgres:5432/swarm' \
  --from-literal=openrouter-api-key='sk-or-v1-...'
```

### 6. Apply manifests (Postgres in-cluster)

```bash
kubectl apply -f infra/k8s/postgres.yaml
kubectl apply -f infra/k8s/runtime-rbac.yaml
kubectl apply -f infra/k8s/runtime-deployment.yaml
kubectl apply -f infra/k8s/warmpool-stuck-order-adk.yaml
```

### 7. Wait for runtime

```bash
kubectl rollout status deployment/runtime --timeout=120s
```

### 8. Check warm pool pods

```bash
kubectl get pods -w
```

Runtime is available at `http://localhost:30080` (NodePort from kind-cluster.yaml).
