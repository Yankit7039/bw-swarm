from __future__ import annotations

from typing import Any

from app.adapters._mcp_register import register_tool

from .get_ticket import get_ticket
from .transition_ticket import transition_ticket


def register_jira_tools(mcp: Any) -> None:
    register_tool(mcp, name="jira__get_ticket", fn=get_ticket)
    register_tool(mcp, name="jira__transition_ticket", fn=transition_ticket)
