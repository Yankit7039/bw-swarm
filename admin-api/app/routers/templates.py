from typing import List

from fastapi import APIRouter, HTTPException, Query

from app import db
from app.schemas.template import Template


router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/", response_model=List[Template])
async def list_templates(
  limit: int = Query(50, ge=1, le=500),
  offset: int = Query(0, ge=0),
) -> list[Template]:
  rows = await db.list_templates(limit=limit, offset=offset)
  return [Template.model_validate(row) for row in rows]


@router.get("/{template_id}", response_model=Template)
async def get_template(template_id: str) -> Template:
  row = await db.get_template(template_id)
  if row is None:
    raise HTTPException(status_code=404, detail="Template not found")
  return Template.model_validate(row)

