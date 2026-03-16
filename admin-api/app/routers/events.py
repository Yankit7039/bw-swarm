from __future__ import annotations

import asyncio
import json
from datetime import datetime
from typing import AsyncIterator
from uuid import UUID
from fastapi import APIRouter, Depends, Query, Request, Header
from fastapi.responses import StreamingResponse

from app.services.event_service import EventService, parse_json_field
from app.repositories.event_repo import EventRepo
from app.infra.sse_manager import SSEManager
from app.domain.event import AgentEvent
from app.schemas.event import EventSummary, MetricsSnapshot
from app.schemas.common import PaginatedResponse

router = APIRouter()


def get_event_service(request: Request) -> EventService:
    pool = request.app.state.db_pool
    event_repo = EventRepo(pool)
    sse_manager = request.app.state.sse_manager
    return EventService(event_repo, sse_manager)


def get_sse_manager(request: Request) -> SSEManager:
    return request.app.state.sse_manager


async def event_generator(
    request: Request,
    sse_manager: SSEManager,
    event_svc: EventService,
) -> AsyncIterator[str]:
    import uuid

    client_id = str(uuid.uuid4())
    queue = await sse_manager.register(client_id)

    try:
        # Replay recent events
        await event_svc.replay_missed_events(queue, seconds=60)

        while True:
            if await request.is_disconnected():
                break

            try:
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
                # Serialize payload to JSON string
                payload = parse_json_field(event.payload)
                data = json.dumps({
                    "id": str(event.id),
                    "agent_run_id": str(event.agent_run_id),
                    "event_type": event.event_type,
                    "level": event.level,
                    "payload": payload,
                    "created_at": event.created_at.isoformat() if event.created_at else None,
                })
                yield f"id: {event.id}\nevent: {event.event_type}\ndata: {data}\n\n"
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
    finally:
        await sse_manager.deregister(client_id)


@router.get("/stream")
async def stream_events(
    request: Request,
    event_svc: EventService = Depends(get_event_service),
    sse_manager: SSEManager = Depends(get_sse_manager),
):
    return StreamingResponse(
        event_generator(request, sse_manager, event_svc),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/logs", response_model=PaginatedResponse[EventSummary])
async def get_logs(
    agent_id: UUID | None = None,
    step_id: str | None = None,
    event_type: str | None = None,
    level: str | None = None,
    from_: str | None = Query(None, alias="from"),
    to: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    svc: EventService = Depends(get_event_service),
):
    # Parse datetime strings if provided
    from_dt = None
    to_dt = None
    
    if from_ and from_.strip():
        try:
            from_dt = datetime.fromisoformat(from_.replace('Z', '+00:00'))
        except ValueError:
            pass  # Invalid datetime format, ignore filter
    
    if to and to.strip():
        try:
            to_dt = datetime.fromisoformat(to.replace('Z', '+00:00'))
        except ValueError:
            pass  # Invalid datetime format, ignore filter
    
    return await svc.get_logs(agent_id, step_id, event_type, level, from_dt, to_dt, limit, offset)


@router.get("/metrics", response_model=MetricsSnapshot)
async def get_metrics(
    svc: EventService = Depends(get_event_service),
):
    return await svc.get_metrics()
