from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ToolMeta(BaseModel):
    adapter: str
    tool: str
    mock: bool = True


class AdapterResponse(BaseModel):
    ok: bool = True
    meta: ToolMeta
    data: Any = None
    error: Optional[str] = None


class OrderStatus(BaseModel):
    order_id: str
    status: str
    fulfillment_stage: Optional[str] = None
    error_code: Optional[str] = None


class RetryResult(BaseModel):
    order_id: str
    queued: bool
    message: str

