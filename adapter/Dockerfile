FROM python:3.12-slim

WORKDIR /app

# Install the package and its dependencies directly from pyproject.toml
COPY pyproject.toml README.md ./
RUN pip install --no-cache-dir .

# Copy application code
COPY app ./app

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
