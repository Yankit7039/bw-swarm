from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from app.services.template_service import TemplateService
from app.repositories.template_repo import TemplateRepo
from app.schemas.template import (
    CreateTemplateRequest,
    TemplateResponse,
    TemplateSummary,
    TemplateDetail,
    ValidateTemplateResponse,
    ValidationError,
)
from app.schemas.common import PaginatedResponse

router = APIRouter()


def get_template_service(request: Request) -> TemplateService:
    pool = request.app.state.db_pool
    repo = TemplateRepo(pool)
    return TemplateService(repo)


@router.get("/", response_model=PaginatedResponse[TemplateSummary])
async def list_templates(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    svc: TemplateService = Depends(get_template_service),
):
    return await svc.list_templates(limit, offset)


@router.post("/", response_model=TemplateResponse, status_code=201)
async def create_template(
    req: CreateTemplateRequest,
    svc: TemplateService = Depends(get_template_service),
):
    return await svc.create_template(req.name, req.definition)


@router.get("/{template_id}", response_model=TemplateDetail)
async def get_template(
    template_id: UUID,
    svc: TemplateService = Depends(get_template_service),
):
    return await svc.get_template(template_id)


@router.post("/{template_id}/validate", response_model=ValidateTemplateResponse)
async def validate_template(
    template_id: UUID,
    req: CreateTemplateRequest,
    svc: TemplateService = Depends(get_template_service),
):
    return await svc.validate_existing(template_id, req.definition)
