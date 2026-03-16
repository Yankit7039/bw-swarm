from typing import List
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app import db
from app.schemas.run import Run
from app.schemas.event import RunEvent


router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("/", response_model=List[Run])
async def list_runs(
  template_id: str | None = None,
  status: str | None = None,
  limit: int = Query(50, ge=1, le=200),
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

