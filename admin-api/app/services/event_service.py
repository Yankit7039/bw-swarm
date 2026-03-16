from __future__ import annotations

import asyncio
import json
from datetime import datetime
from typing import AsyncIterator, Any
from uuid import UUID

from app.repositories.event_repo import EventRepo
from app.infra.sse_manager import SSEManager
from app.domain.event import AgentEvent, EventType


def parse_json_field(value: Any) -> Any:
    """Parse JSON field from database - handles both dict and JSON strings."""
    if value is None:
        return None
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


class EventService:
    def __init__(self, event_repo: EventRepo, sse_manager: SSEManager):
        self.event_repo = event_repo
        self.sse_manager = sse_manager

    async def replay_missed_events(
        self, queue: asyncio.Queue[AgentEvent], seconds: int = 60
    ) -> None:
        """Replay events from the last N seconds for SSE reconnect."""
        events = await self.event_repo.get_recent(seconds)
        for event in events:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                break

    async def get_logs(
        self,
        agent_id: UUID | None = None,
        step_id: str | None = None,
        event_type: str | None = None,
        level: str | None = None,
        from_: datetime | None = None,
        to: datetime | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        events, total = await self.event_repo.list(
            agent_id, step_id, event_type, level, from_, to, limit, offset
        )

        return {
            "data": [
                {
                    "id": e.id,
                    "agent_run_id": e.agent_run_id,
                    "event_type": e.event_type,
                    "level": e.level,
                    "payload": parse_json_field(e.payload),
                    "created_at": e.created_at.isoformat(),
                }
                for e in events
            ],
            "pagination": {
                "total": total,
                "limit": limit,
                "offset": offset,
            }
        }

    async def get_metrics(self) -> dict:
        return await self.event_repo.get_metrics()
