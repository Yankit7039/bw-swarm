import json
import uuid
from uuid import UUID
from typing import List

from fastapi import APIRouter, HTTPException, Query, Request

from app import db
from app.schemas.run import Run
from app.schemas.event import RunEvent


router = APIRouter(prefix="/runs", tags=["runs"])


@router.post("/enqueue")
async def enqueue_run(request: Request, body: dict) -> dict:
    """Create a run row (status ``queued``), push to Redis Stream, return immediately."""
    template_id = body.get("template_id")
    payload = body.get("payload")
    if not template_id:
        raise HTTPException(status_code=422, detail="template_id is required")
    if payload is None:
        payload = {}
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="payload must be an object")

    template = await db.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

    run_id = uuid.uuid4()
    await db.create_run_queued(run_id, template_id, payload)

    redis_client = request.app.state.redis
    await redis_client.xadd(
        "swarm:runs:queue",
        {
            "run_id": str(run_id),
            "template_id": template_id,
            "payload": json.dumps(payload),
        },
    )
    return {"run_id": str(run_id), "template_id": template_id, "status": "queued"}


@router.get("/", response_model=List[Run])
async def list_runs(
  template_id: str | None = None,
  status: str | None = None,
  limit: int = Query(50, ge=1, le=500),
  offset: int = Query(0, ge=0),
) -> list[Run]:
  rows = await db.list_runs(
    template_id=template_id,
    status=status,
    limit=limit,
    offset=offset,
  )
  return [Run.model_validate(row) for row in rows]


@router.get("/{run_id}", response_model=Run)
async def get_run(run_id: UUID) -> Run:
  row = await db.get_run(run_id)
  if row is None:
    raise HTTPException(status_code=404, detail="Run not found")
  return Run.model_validate(row)


@router.get("/{run_id}/events", response_model=List[RunEvent])
async def get_run_events(run_id: UUID) -> list[RunEvent]:
  rows = await db.get_run_events(run_id)
  return [RunEvent.model_validate(row) for row in rows]

