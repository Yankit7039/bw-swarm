from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel, Field


class StepDefinition(BaseModel):
    id: str
    name: str
    type: str = Field(..., pattern="^(subagent|deterministic|parallel)$")
    depends_on: list[str] = Field(default_factory=list)
    task: str | None = None
    adapter: str | None = None
    action: str | None = None
    input: dict[str, Any] = Field(default_factory=dict)
    output_schema: dict[str, Any] = Field(default_factory=dict)
    parallel: list[dict[str, Any]] = Field(default_factory=list)


class WorkflowDefinition(BaseModel):
    version: str = "1.0"
    steps: list[StepDefinition]


class TemplateSummary(BaseModel):
    id: UUID
    name: str
    version: int
    created_at: datetime
    updated_at: datetime


class TemplateDetail(BaseModel):
    id: UUID
    name: str
    version: int
    definition: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class CreateTemplateRequest(BaseModel):
    name: str
    definition: dict[str, Any]


class TemplateResponse(BaseModel):
    id: UUID
    name: str
    version: int
    created_at: datetime


class ValidationError(BaseModel):
    field: str
    message: str


class ValidateTemplateResponse(BaseModel):
    valid: bool
    errors: list[ValidationError] = []
