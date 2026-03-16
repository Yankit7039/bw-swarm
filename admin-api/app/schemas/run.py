from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class Run(BaseModel):
  run_id: UUID
  template_id: str
  status: str
  payload: dict[str, Any]
  result: dict[str, Any] | None = None
  error_message: str | None = None
  created_at: datetime | None = None
  updated_at: datetime | None = None
  completed_at: datetime | None = None

