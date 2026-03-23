from __future__ import annotations

from typing import Any

from app.adapters._mcp_register import register_tool

from .lookup import lookup


def register_escalation_matrix_tools(mcp: Any) -> None:
    register_tool(mcp, name="escalation_matrix__lookup", fn=lookup)
