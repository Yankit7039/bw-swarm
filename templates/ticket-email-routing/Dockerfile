# Build swarm-core first: docker build -t swarm-core:latest swarm-core/
# Then: docker build -t ticket-email-routing-adk:latest templates/ticket-email-routing
# AWS: pass --build-arg BASE_IMAGE=<account>.dkr.ecr.<region>.amazonaws.com/swarm-core:latest

ARG BASE_IMAGE=swarm-core:latest
FROM ${BASE_IMAGE}
# COPY ticket-email-routing.yaml /app/workflow.yaml
