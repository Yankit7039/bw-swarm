FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN adduser --disabled-password --gecos "" appuser && chown -R appuser:appuser /app

COPY . .

USER appuser

ENV PATH="/home/appuser/.local/bin:$PATH"

EXPOSE 8888

# Sandbox pods run entrypoint on 8888; runtime POSTs /run with run_id + payload.
CMD ["uvicorn", "entrypoint:app", "--host", "0.0.0.0", "--port", "8888"]
