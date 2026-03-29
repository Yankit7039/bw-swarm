from typing import List

from fastapi import APIRouter, HTTPException

from app import db
from app.schemas.adapter import Adapter


router = APIRouter(prefix="/adapters", tags=["adapters"])


@router.get("/", response_model=List[Adapter])
async def list_adapters() -> list[Adapter]:
    rows = await db.list_adapters_with_tools()
    return [Adapter.model_validate(row) for row in rows]


@router.get("/{adapter_name}", response_model=Adapter)
async def get_adapter(adapter_name: str) -> Adapter:
    row = await db.get_adapter_tools(adapter_name)
    if row is None:
        raise HTTPException(status_code=404, detail="Adapter not found")
    return Adapter.model_validate(row)
