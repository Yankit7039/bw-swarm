from __future__ import annotations

from typing import Any

from app.adapters._mcp_register import register_tool

from .send_email import send_email


def register_agentmail_tools(mcp: Any) -> None:
    register_tool(mcp, name="agentmail__send_email", fn=send_email)
