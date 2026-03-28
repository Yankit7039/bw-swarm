# Base image for ADK templates. Build: docker build -t swarm-core:latest .
# Templates use FROM swarm-core (or ECR) and COPY their workflow YAML to /app/workflow.yaml.
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY swarm_core ./swarm_core

RUN pip install --no-cache-dir .

ENV PYTHONPATH=/app
ENV YAML_PATH=/app/workflow.yaml

EXPOSE 8888

CMD ["python", "-m", "uvicorn", "swarm_core.entrypoint:app", "--host", "0.0.0.0", "--port", "8888"]
