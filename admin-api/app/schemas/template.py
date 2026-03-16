from datetime import datetime
from typing import Any

from pydantic import BaseModel


class Template(BaseModel):
  template_id: str
  name: str
  image: str
  warm_pool_ref: str | None = None
  config: dict[str, Any] | None = None
  created_at: datetime | None = None
  updated_at: datetime | None = None

