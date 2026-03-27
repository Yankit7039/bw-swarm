from __future__ import annotations

from typing import Any

from app.adapters._mcp_register import register_tool

from .add_comment import add_comment
from .get_ticket import get_ticket
from .transition_ticket import transition_ticket
from .update_labels import update_labels
from .update_priority import update_priority


def register_jira_tools(mcp: Any) -> None:
    register_tool(mcp, name="jira__get_ticket", fn=get_ticket)
    register_tool(mcp, name="jira__transition_ticket", fn=transition_ticket)
    register_tool(mcp, name="jira__add_comment", fn=add_comment)
    register_tool(mcp, name="jira__update_priority", fn=update_priority)
    register_tool(mcp, name="jira__update_labels", fn=update_labels)
