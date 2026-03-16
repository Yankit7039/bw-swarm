from datetime import datetime
from typing import Any

from pydantic import BaseModel


class RunEvent(BaseModel):
  event_type: str
  event: str
  created_at: datetime | None = None
  payload: dict[str, Any] | None = None

