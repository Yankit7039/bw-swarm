"""Runtime service: template-agnostic API for runs. FastAPI, Postgres only."""

import asyncio
import uuid

from fastapi import BackgroundTasks, FastAPI, HTTPException

from runtime.claim_reconciler import claim_reconciler
from runtime.db import (
    create_run,
    get_run,
    get_run_events,
    get_template,
    init_db,
    update_run_status,
)
from runtime.db.run_migrations import run_migrations

app = FastAPI(
    title="Runtime",
    description="Template-agnostic orchestrator: POST /runs (template_id + payload), GET /runs, GET /runs/events.",
)


@app.on_event("startup")
async def startup():
    await init_db()
    await run_migrations()
    asyncio.create_task(claim_reconciler())


@app.post("/runs")
async def submit_run(body: dict, background_tasks: BackgroundTasks) -> dict:
    """Create a run and enqueue sandbox trigger. Body: { "template_id": string, "payload": object }."""
    template_id = body.get("template_id")
    payload = body.get("payload")
    if not template_id:
        raise HTTPException(status_code=422, detail="template_id is required")
    if payload is None:
        payload = {}

    template = await get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

    run_id = uuid.uuid4()
    await create_run(run_id, template_id, payload)

    from runtime.sandbox_trigger import trigger_run

    background_tasks.add_task(trigger_run, run_id, template_id, payload)
    return {"run_id": str(run_id), "template_id": template_id, "status": "pending"}


@app.get("/runs/{run_id}")
async def get_run_status(run_id: uuid.UUID) -> dict:
    """Return run status, result, error_message, timestamps."""
    row = await get_run(run_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return row


@app.get("/runs/{run_id}/events")
async def get_run_events_endpoint(run_id: uuid.UUID) -> list:
    """Return run_events for live step-by-step UI."""
    events = await get_run_events(run_id)
    return events


@app.get("/health")
async def health():
    return {"status": "ok"}
