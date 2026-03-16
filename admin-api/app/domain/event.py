from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID


class EventType(str, Enum):
    AGENT_CREATED = "agent.created"
    AGENT_STATE_CHANGED = "agent.state_changed"
    AGENT_STEP_STARTED = "agent.step_started"
    AGENT_STEP_COMPLETED = "agent.step_completed"
    AGENT_STEP_FAILED = "agent.step_failed"
    AGENT_COMPLETED = "agent.completed"
    AGENT_FAILED = "agent.failed"
    AGENT_CANCELLED = "agent.cancelled"
    AGENT_PAUSED = "agent.paused"
    AGENT_RESUMED = "agent.resumed"


@dataclass
class AgentEvent:
    id: UUID
    agent_run_id: UUID
    event_type: EventType | str
    level: str
    payload: dict[str, Any]
    created_at: datetime
