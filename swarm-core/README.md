# swarm-core

Shared Python runtime for SWARM template pods: YAML-defined workflows, Google ADK `LlmAgent`, MCP tools, Postgres `run_events`.

**Production builds**: Build this image first, then template images that extend it and only copy their workflow YAML (e.g. [`templates/stuck-order-adk/Dockerfile`](../templates/stuck-order-adk/Dockerfile)):

```bash
docker build -t swarm-core:latest swarm-core/
docker build -t stuck-order-adk:latest templates/stuck-order-adk
```

On AWS, push `swarm-core` to ECR and pass `--build-arg BASE_IMAGE=<ecr>/swarm-core:latest` when building the template (see root `Makefile` `_build-push`).

[`Dockerfile`](Dockerfile) in this directory is the base layer for all such templates.
