# Build swarm-core first: docker build -t swarm-core:latest swarm-core/
# Then: docker build -t number-porting-adk:latest templates/number-porting-resolution
# AWS: pass --build-arg BASE_IMAGE=<account>.dkr.ecr.<region>.amazonaws.com/swarm-core:latest

ARG BASE_IMAGE=swarm-core:latest
FROM ${BASE_IMAGE}
COPY number-porting-resolution.yaml /app/workflow.yaml
