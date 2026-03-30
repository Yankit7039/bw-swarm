---
title: Warm pool
description: How SandboxTemplate, SandboxWarmPool, and SandboxClaim provide pre-started swarm-core pods for low-latency runs.
---

# Warm pool

## Why a warm pool exists

Starting a container from cold on every run adds **latency**. SWARM uses the **Kubernetes SIG agent-sandbox** CRDs to keep a **pool of ready pods** running the same **swarm-core** image. When a run is created, the **runtime** claims one of these pods instead of scheduling a new Job from scratch.

## CRDs (high level)

| Kind | Purpose |
|------|---------|
| **SandboxTemplate** | Defines the **pod template**: image (`swarm-core`), env (`DATABASE_URL`, `OPENROUTER_API_KEY`, `ADAPTER_URL`, `ENTRYPOINT_PORT`), probes, resources |
| **SandboxWarmPool** | Points at a **SandboxTemplate** by name and sets **`replicas`** (how many idle pods to keep) |
| **SandboxClaim** | Created **per run** by the runtime; binds one warm pod to that run so the runtime can `POST` to its HTTP entrypoint |

In the default setup, **all templates share one pool** named **`swarm-core-pool`**. The **`templates.warm_pool_ref`** column points at that pool name; workflow YAML is loaded **per run** from Postgres, so the same image serves every template.

## Manifests

- **Local / Kind:** `infra/k8s/warmpool-swarm-core.yaml`
- **AWS EKS:** `infra/k8s-aws/warmpool-swarm-core.yaml` (replace image registry placeholders with your ECR URLs after `terraform apply`)

Both define a **SandboxTemplate** and **SandboxWarmPool** with the same metadata name (`swarm-core-pool` in Kind), `replicas` (e.g. 5 in Kind), and env wiring to **`adk-secrets`**.

## Runtime behavior

1. Load **`templates`** row for **`template_id`** → read **`warm_pool_ref`** (e.g. `swarm-core-pool`).
2. Create a **SandboxClaim** in **`SANDBOX_NAMESPACE`** referencing that template.
3. Wait until a pod is assigned; persist **`assigned_pod`** / **`sandbox_claim_name`** on the run.
4. **`POST http://{pod}:{ENTRYPOINT_PORT}/run`** with JSON **`{ "run_id", "payload" }`** (async work continues inside the pod).

## Claim reconciler

A background task (**`claim_reconciler`**) deletes **SandboxClaim** objects for runs that have reached a **terminal** state (for example **`completed`**, **`failed`**, **`waiting_for_followup`**, **`exhausted`**) when the claim was not yet cleaned up — so Kubernetes does not retain stale claims.

## Further reading

- [Architecture](/concepts/architecture)
- [Data flow](/concepts/data-flow)
- [Templates](/guides/templates)
