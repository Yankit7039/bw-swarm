from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID


class AgentStatus(str, Enum):
    CREATED = "created"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StepType(str, Enum):
    SUBAGENT = "subagent"
    DETERMINISTIC = "deterministic"
    PARALLEL = "parallel"


@dataclass
class Step:
    id: UUID
    agent_run_id: UUID
    step_id: str
    step_name: str
    step_type: str
    status: str
    input: dict[str, Any] | None = None
    output: dict[str, Any] | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_ms: int | None = None
    created_at: datetime | None = None


@dataclass
class AgentRun:
    id: UUID
    template_id: UUID
    status: str
    current_step: str | None = None
    triggered_by: str = "manual"
    trigger_payload: dict[str, Any] | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_ms: int | None = None
    steps: list[Step] = field(default_factory=list)
