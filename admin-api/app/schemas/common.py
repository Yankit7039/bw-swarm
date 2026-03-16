from __future__ import annotations

from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class Pagination(BaseModel):
    total: int
    limit: int
    offset: int


class PaginatedResponse(BaseModel, Generic[T]):
    data: list[T]
    pagination: Pagination


class ErrorResponse(BaseModel):
    error: str
    message: str
    details: list[dict] = []
