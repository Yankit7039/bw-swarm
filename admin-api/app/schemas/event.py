from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel


class EventSummary(BaseModel):
    id: UUID
    agent_run_id: UUID
    event_type: str
    level: str
    payload: dict[str, Any]
    created_at: datetime


class LogFilters(BaseModel):
    agent_id: UUID | None = None
    step_id: str | None = None
    event_type: str | None = None
    level: str | None = None
    from_: datetime | None = None
    to: datetime | None = None
    limit: int = 50
    offset: int = 0


class MetricsSnapshot(BaseModel):
    snapshot_at: datetime
    agents: dict[str, Any]
    queue: dict[str, Any]
    throughput: dict[str, Any]
    error_rate: dict[str, Any]
    adapters: dict[str, Any]
