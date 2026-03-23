"""FastAPI server for sandbox pods: POST /run with run_id + payload; write to shared Postgres."""

import os
import uuid

from dotenv import dotenv_values, load_dotenv

_here = os.path.abspath(os.path.dirname(__file__))
_env_path = os.path.normpath(os.path.join(_here, ".env"))
load_dotenv(_env_path)
_values = dotenv_values(_env_path)
if "OPENROUTER_API_KEY" in _values:
    os.environ.setdefault("OPENROUTER_API_KEY", _values["OPENROUTER_API_KEY"])
if "DATABASE_URL" in _values:
    os.environ.setdefault("DATABASE_URL", _values["DATABASE_URL"])

if not os.environ.get("OPENROUTER_API_KEY"):
    raise RuntimeError("OPENROUTER_API_KEY is not set.")
if not os.environ.get("DATABASE_URL"):
    raise RuntimeError("DATABASE_URL is not set.")

import uvicorn
from fastapi import BackgroundTasks, FastAPI, HTTPException

from workflow_runner import run_workflow

app = FastAPI(
    title="ticket-email-routing-entrypoint",
    description="Pod entrypoint: POST /run to execute ticket email routing workflow.",
)


@app.post("/run", status_code=202)
async def run(body: dict, background_tasks: BackgroundTasks) -> dict:
    run_id_raw = body.get("run_id")
    payload = body.get("payload") or {}
    if not run_id_raw:
        raise HTTPException(status_code=422, detail="run_id required")
    try:
        run_id = uuid.UUID(run_id_raw)
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="run_id must be a valid UUID")

    background_tasks.add_task(run_workflow, run_id, payload)
    return {"status": "accepted", "run_id": str(run_id)}


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    port = int(os.environ.get("ENTRYPOINT_PORT", "8888"))
    uvicorn.run(app, host="0.0.0.0", port=port)
