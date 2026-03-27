from __future__ import annotations

from typing import Any

from app.adapters._mcp_register import register_tool

from .get_correlated_alarms import get_correlated_alarms


def register_ericsson_oss_tools(mcp: Any) -> None:
    register_tool(mcp, name="ericsson_oss__get_correlated_alarms", fn=get_correlated_alarms)
