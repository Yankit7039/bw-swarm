from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class AdapterTool(BaseModel):
    model_config = ConfigDict(extra="ignore")

    tool_name: str
    mcp_tool_name: str
    description: str | None
    input_schema: dict[str, Any]
    docstring_warnings: list[str] | None
    updated_at: datetime | None


class Adapter(BaseModel):
    adapter_name: str
    tool_count: int
    tools: list[AdapterTool]
