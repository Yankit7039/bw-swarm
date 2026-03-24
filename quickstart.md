# Kind cluster quickstart

Postgres runs in-cluster only. Run from repo root.

## Using the script

From repo root, set your OpenRouter API key and run:

```bash
OPENROUTER_API_KEY=sk-or-v1-your-key-here ./scripts/quickstart.sh
```

Optional — AgentMail (real sends from the adapter MCP `agentmail__send_email`; omit to use mock sends):

```bash
AGENTMAIL_API_KEY=your-key AGENTMAIL_INBOX_ID=your-inbox@agentmail.to OPENROUTER_API_KEY=sk-or-v1-... ./scripts/quickstart.sh
```

Optional — Jira (for the ticket-email-routing template: `jira__get_ticket` and `jira__transition_ticket`). If unset, `jira-email` and `jira-api-token` are empty and those tools fail until you add credentials (same keys as AWS `adk-secrets`):

```bash
JIRA_EMAIL=you@example.com JIRA_API_TOKEN=your-atlassian-api-token JIRA_BASE=https://swarm-bw.atlassian.net \
OPENROUTER_API_KEY=sk-or-v1-... ./scripts/quickstart.sh
```

Or pass OpenRouter key as the first argument:

```bash
./scripts/quickstart.sh sk-or-v1-your-key-here
```

The script creates the Kind cluster, builds and loads images, installs agent-sandbox CRDs, creates the secret, and applies all manifests for:

- Postgres
- Adapter service (FastAPI + MCP)
- Runtime
- Warm pools (stuck-order-adk, esim-activation-adk, number-porting-adk, ticket-email-routing-adk)
- Admin API

At the end it prints the Runtime and Admin API URLs and suggests `kubectl get pods -w` to watch pods.

---

## Manual steps

### 1. Create cluster

```bash
kind create cluster --config infra/k8s/kind-cluster.yaml
```

### 2. Build images

```bash
docker build -t stuck-order-adk:latest templates/stuck-order-adk
docker build -t esim-activation-adk:latest templates/esim-activation-resolution
docker build -t number-porting-adk:latest templates/number-porting-resolution
docker build -t ticket-email-routing-adk:latest templates/ticket-email-routing
docker build -t swarm-adapter:latest adapter
docker build -f runtime/Dockerfile -t swarm-runtime:latest .
docker build -f admin-api/Dockerfile -t swarm-admin-api:latest .
```

### 3. Load images into Kind

```bash
kind load docker-image stuck-order-adk:latest
kind load docker-image esim-activation-adk:latest
kind load docker-image number-porting-adk:latest
kind load docker-image ticket-email-routing-adk:latest
kind load docker-image swarm-adapter:latest
kind load docker-image swarm-runtime:latest
kind load docker-image swarm-admin-api:latest
```

### 4. Install agent-sandbox CRDs

```bash
kubectl apply -f https://github.com/kubernetes-sigs/agent-sandbox/releases/download/v0.1.1/manifest.yaml
kubectl apply -f https://github.com/kubernetes-sigs/agent-sandbox/releases/download/v0.1.1/extensions.yaml
```

### 5. Create secret

Replace `sk-or-v1-...` with your OpenRouter API key. Optionally add AgentMail credentials (same keys as in `adk-secrets` for AWS); omit them or use empty strings to use mock email sends from the adapter.

The adapter deployment expects **Jira** keys for the ticket-email-routing workflow (`jira-email`, `jira-api-token`, `jira-base`). Use empty strings for Jira if you are not testing that template yet.

```bash
kubectl create secret generic adk-secrets \
  --from-literal=database-url='postgresql+asyncpg://swarm:swarm@postgres:5432/swarm' \
  --from-literal=openrouter-api-key='sk-or-v1-...' \
  --from-literal=agentmail-api-key='' \
  --from-literal=agentmail-inbox-id='' \
  --from-literal=jira-email='' \
  --from-literal=jira-api-token='' \
  --from-literal=jira-base='https://swarm-bw.atlassian.net'
```

### 6. Apply manifests (Postgres in-cluster)

```bash
kubectl apply -f infra/k8s/postgres.yaml
kubectl apply -f infra/k8s/adapter-deployment.yaml
kubectl apply -f infra/k8s/runtime-rbac.yaml
kubectl apply -f infra/k8s/runtime-deployment.yaml
kubectl apply -f infra/k8s/warmpool-stuck-order-adk.yaml
kubectl apply -f infra/k8s/warmpool-esim-activation-adk.yaml
kubectl apply -f infra/k8s/warmpool-number-porting-adk.yaml
kubectl apply -f infra/k8s/warmpool-ticket-email-routing-adk.yaml
kubectl apply -f infra/k8s/admin-api-deployment.yaml
```

The warm pool pods are configured with:

- `ADAPTER_URL=http://adapter:8080`

This allows sandbox pods to connect to the adapter’s MCP endpoint at `http://adapter:8080/mcp`.

### 7. Wait for deployments

```bash
kubectl rollout status deployment/runtime --timeout=120s
kubectl rollout status deployment/admin-api --timeout=120s
```

### 8. Check pods

```bash
kubectl get pods -w
```

Runtime is available at `http://localhost:30080` and the Admin API at `http://localhost:30081` (NodePorts from `infra/k8s/kind-cluster.yaml`).
