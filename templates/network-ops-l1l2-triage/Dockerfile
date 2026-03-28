# Build swarm-core first: docker build -t swarm-core:latest swarm-core/
# Then: docker build -t network-ops-l1l2-triage-adk:latest templates/network-ops-l1l2-triage
# AWS: pass --build-arg BASE_IMAGE=<account>.dkr.ecr.<region>.amazonaws.com/swarm-core:latest

ARG BASE_IMAGE=swarm-core:latest
FROM ${BASE_IMAGE}
COPY network-ops-l1l2-triage.yaml /app/workflow.yaml
