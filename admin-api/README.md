# SWARM Admin API

FastAPI backend for the SWARM multi-agent orchestration system.

## Quick Start

Run the startup script to start both PostgreSQL and the API server:

```bash
./start.sh          # Start all services
./start.sh stop     # Stop all services
./start.sh restart  # Restart all services
```

The script will:
1. Create/start the PostgreSQL Docker container
2. Wait for the database to be ready
3. Set up the Python virtual environment
4. Install dependencies (if needed)
5. Start the FastAPI server with auto-reload

API will be available at: http://localhost:8000

## Manual Setup

If you prefer to start components manually:

### 1. Start PostgreSQL

```bash
docker run -d \
  --name swarm-postgres \
  -e POSTGRES_USER=swarm \
  -e POSTGRES_PASSWORD=swarm \
  -e POSTGRES_DB=swarm \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. Install Dependencies

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -e .
```

### 3. Configure Environment

Create `.env`:
```
POSTGRES_URL=postgresql://swarm:swarm@localhost:5432/swarm
PORT=8000
LOG_LEVEL=info
```

### 4. Start API Server

```bash
python -m uvicorn app.main:app --reload --port 8000
```

## API Endpoints

- `GET /health` - Health check
- `GET /ready` - Readiness check
- `GET /templates` - List templates
- `POST /templates` - Create template
- `GET /agents` - List agents
- `POST /agents` - Create/run agent
- `GET /events/stream` - SSE event stream
- `GET /events/logs` - Event logs
- `GET /events/metrics` - System metrics

## Development

The API uses:
- **FastAPI** - Web framework
- **asyncpg** - Async PostgreSQL driver
- **Pydantic** - Data validation
- **SSE** - Server-Sent Events for real-time updates

## Project Structure

```
app/
├── main.py              # FastAPI app entry point
├── core/                # Config, exceptions
├── routers/             # API endpoints
├── services/            # Business logic
├── repositories/        # Database access
├── schemas/             # Pydantic models
├── domain/              # Domain models
└── infra/               # Database, SSE manager
```
