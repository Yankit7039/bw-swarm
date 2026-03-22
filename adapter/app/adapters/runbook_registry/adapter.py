from __future__ import annotations

from typing import Any

from app.adapters._mcp_register import register_tool

from .get_escalation_contact import get_escalation_contact
from .get_runbook import get_runbook


def register_runbook_registry_tools(mcp: Any) -> None:
    register_tool(mcp, name="runbook_registry__get_runbook", fn=get_runbook)
    register_tool(mcp, name="runbook_registry__get_escalation_contact", fn=get_escalation_contact)
