# Build swarm-core first: docker build -t swarm-core:latest swarm-core/
# Then: docker build -t esim-activation-adk:latest templates/esim-activation-resolution
# AWS: pass --build-arg BASE_IMAGE=<account>.dkr.ecr.<region>.amazonaws.com/swarm-core:latest

ARG BASE_IMAGE=swarm-core:latest
FROM ${BASE_IMAGE}
# COPY esim-activation-resolution.yaml /app/workflow.yaml
