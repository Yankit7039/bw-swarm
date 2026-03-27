from __future__ import annotations

from typing import Any

from app.adapters._mcp_register import register_tool

from .get_similar_incidents import get_similar_incidents


def register_servicenow_kb_tools(mcp: Any) -> None:
    register_tool(mcp, name="servicenow_kb__get_similar_incidents", fn=get_similar_incidents)
