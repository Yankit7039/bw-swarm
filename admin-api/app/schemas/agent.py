from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel


class StepSummary(BaseModel):
    id: UUID
    step_id: str
    step_name: str
    step_type: str
    status: str
    duration_ms: int | None = None


class StepDetail(BaseModel):
    id: UUID
    step_id: str
    step_name: str
    step_type: str
    status: str
    input: dict[str, Any] | None = None
    output: dict[str, Any] | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_ms: int | None = None


class AgentSummary(BaseModel):
    id: UUID
    template_id: UUID
    template_name: str
    status: str
    current_step: str | None = None
    triggered_by: str
    started_at: datetime
    duration_ms: int | None = None


class AgentDetail(BaseModel):
    id: UUID
    template_id: UUID
    template_name: str
    status: str
    triggered_by: str
    trigger_payload: dict[str, Any] | None = None
    started_at: datetime
    completed_at: datetime | None = None
    duration_ms: int | None = None
    steps: list[StepDetail]


class CreateAgentRequest(BaseModel):
    template_id: UUID
    trigger_payload: dict[str, Any] = {}


class AgentResponse(BaseModel):
    id: UUID
    template_id: UUID
    status: str
    started_at: datetime


class AgentStateResponse(BaseModel):
    id: UUID
    status: str
    paused_at: datetime | None = None
    resumed_at: datetime | None = None
    cancelled_at: datetime | None = None


class StepListResponse(BaseModel):
    agent_run_id: UUID
    steps: list[StepDetail]


class AgentFilters(BaseModel):
    status: str | None = None
    template_id: UUID | None = None
    from_: datetime | None = None
    to: datetime | None = None
    limit: int = 20
    offset: int = 0
