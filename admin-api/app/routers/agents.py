from __future__ import annotations

from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, Query, Request

from app.services.agent_service import AgentService
from app.repositories.agent_repo import AgentRepo
from app.repositories.template_repo import TemplateRepo
from app.repositories.event_repo import EventRepo
from app.infra.sse_manager import SSEManager
from app.schemas.agent import (
    CreateAgentRequest,
    AgentResponse,
    AgentSummary,
    AgentDetail,
    AgentStateResponse,
    StepListResponse,
)
from app.schemas.common import PaginatedResponse

router = APIRouter()


def get_agent_service(request: Request) -> AgentService:
    pool = request.app.state.db_pool
    agent_repo = AgentRepo(pool)
    template_repo = TemplateRepo(pool)
    event_repo = EventRepo(pool)
    sse_manager = request.app.state.sse_manager
    return AgentService(agent_repo, template_repo, event_repo, sse_manager)


@router.get("/", response_model=PaginatedResponse[AgentSummary])
async def list_agents(
    status: str | None = None,
    template_id: UUID | None = None,
    from_: datetime | None = Query(None, alias="from"),
    to: datetime | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    svc: AgentService = Depends(get_agent_service),
):
    return await svc.list_agents(status, template_id, from_, to, limit, offset)


@router.post("/", response_model=AgentResponse, status_code=201)
async def create_agent(
    req: CreateAgentRequest,
    svc: AgentService = Depends(get_agent_service),
):
    return await svc.create_agent(req.template_id, req.trigger_payload)


@router.get("/{agent_id}", response_model=AgentDetail)
async def get_agent(
    agent_id: UUID,
    svc: AgentService = Depends(get_agent_service),
):
    return await svc.get_agent(agent_id)


@router.get("/{agent_id}/steps", response_model=StepListResponse)
async def get_agent_steps(
    agent_id: UUID,
    svc: AgentService = Depends(get_agent_service),
):
    return await svc.get_agent_steps(agent_id)


@router.post("/{agent_id}/pause", response_model=AgentStateResponse)
async def pause_agent(
    agent_id: UUID,
    svc: AgentService = Depends(get_agent_service),
):
    return await svc.pause_agent(agent_id)


@router.post("/{agent_id}/resume", response_model=AgentStateResponse)
async def resume_agent(
    agent_id: UUID,
    svc: AgentService = Depends(get_agent_service),
):
    return await svc.resume_agent(agent_id)


@router.post("/{agent_id}/cancel", response_model=AgentStateResponse)
async def cancel_agent(
    agent_id: UUID,
    svc: AgentService = Depends(get_agent_service),
):
    return await svc.cancel_agent(agent_id)
