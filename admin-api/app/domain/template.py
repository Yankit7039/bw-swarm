from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID


@dataclass
class Template:
    id: UUID
    name: str
    version: int
    definition: dict[str, Any]
    created_at: datetime
    updated_at: datetime
