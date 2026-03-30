# Build swarm-core first: docker build -t swarm-core:latest swarm-core/
# Then: docker build -t stuck-order-adk:latest templates/stuck-order-adk
# AWS: pass --build-arg BASE_IMAGE=<account>.dkr.ecr.<region>.amazonaws.com/swarm-core:latest

ARG BASE_IMAGE=swarm-core:latest
FROM ${BASE_IMAGE}
# Optional: COPY the YAML so the pod can validate at startup and run offline.
# Remove this line once templates.workflow_yaml is populated in the DB for this template.

