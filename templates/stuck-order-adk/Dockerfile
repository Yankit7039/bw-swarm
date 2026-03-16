FROM python:3.12-slim

WORKDIR /app

# Install the package and its dependencies directly from pyproject.toml
COPY pyproject.toml README.md ./
RUN pip install --no-cache-dir .

RUN adduser --disabled-password --gecos "" appuser && chown -R appuser:appuser /app

# Copy the rest of the application code
COPY . .

USER appuser

ENV PATH="/home/appuser/.local/bin:$PATH"

EXPOSE 8888

# Sandbox pods run entrypoint on 8888; runtime POSTs /run with run_id + payload.
CMD ["uvicorn", "entrypoint:app", "--host", "0.0.0.0", "--port", "8888"]
