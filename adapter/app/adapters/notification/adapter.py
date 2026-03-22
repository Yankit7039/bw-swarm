from __future__ import annotations

from typing import Any

from app.adapters._mcp_register import register_tool

from .send_alert import send_alert


def register_notification_tools(mcp: Any) -> None:
    register_tool(mcp, name="notification__send_alert", fn=send_alert)
