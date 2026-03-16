FROM python:3.12-slim

WORKDIR /app

COPY runtime/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY runtime ./runtime
ENV PYTHONPATH=/app

EXPOSE 8000
CMD ["uvicorn", "runtime.app:app", "--host", "0.0.0.0", "--port", "8000"]
