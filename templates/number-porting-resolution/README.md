# Number Porting Resolution

Hybrid YAML-driven workflow for resolving stuck mobile number port-in orders.

## Build

1. Build the swarm-core base image (from repo root):

   ```bash
   docker build -t swarm-core:latest swarm-core/
   ```

2. Build this template:

   ```bash
   docker build -t number-porting-adk:latest templates/number-porting-resolution
   ```

   For AWS/ECR, pass `--build-arg BASE_IMAGE=<account>.dkr.ecr.<region>.amazonaws.com/swarm-core:latest`.

## Run

Use the runtime service to trigger runs with `template_id: number-porting-resolution`, or run the `number-porting-adk` service from `infra/docker/docker-compose.yml` (port **8890** on the host).
