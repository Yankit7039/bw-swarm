FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml README.md ./
RUN pip install --no-cache-dir .

RUN adduser --disabled-password --gecos "" appuser && chown -R appuser:appuser /app

COPY . .

USER appuser

ENV PATH="/home/appuser/.local/bin:$PATH"

EXPOSE 8888

CMD ["uvicorn", "entrypoint:app", "--host", "0.0.0.0", "--port", "8888"]
