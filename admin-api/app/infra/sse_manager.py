from __future__ import annotations

import asyncio
import uuid
from datetime import datetime
from typing import Any

from app.domain.event import AgentEvent, EventType


class SSEManager:
    def __init__(self, buffer_size: int = 256):
        self._clients: dict[str, asyncio.Queue[AgentEvent]] = {}
        self._lock = asyncio.Lock()
        self._buffer_size = buffer_size

    async def register(self, client_id: str) -> asyncio.Queue[AgentEvent]:
        queue: asyncio.Queue[AgentEvent] = asyncio.Queue(maxsize=self._buffer_size)
        async with self._lock:
            self._clients[client_id] = queue
        return queue

    async def deregister(self, client_id: str) -> None:
        async with self._lock:
            self._clients.pop(client_id, None)

    async def broadcast(self, event: AgentEvent) -> None:
        async with self._lock:
            queues = list(self._clients.values())

        for queue in queues:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                # Drop event if client is too slow
                pass

    async def create_and_broadcast(
        self,
        agent_run_id: uuid.UUID,
        event_type: EventType,
        payload: dict[str, Any],
        level: str = "info",
    ) -> AgentEvent:
        from app.infra.database import asyncpg
        from app.core.config import settings

        event = AgentEvent(
            id=uuid.uuid4(),
            agent_run_id=agent_run_id,
            event_type=event_type,
            level=level,
            payload=payload,
            created_at=datetime.utcnow(),
        )

        # Store in DB and broadcast
        # Note: DB insertion happens via event_repo, this just broadcasts
        await self.broadcast(event)
        return event
