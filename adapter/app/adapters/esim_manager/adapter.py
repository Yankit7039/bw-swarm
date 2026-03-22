from __future__ import annotations

from typing import Any

from app.adapters._mcp_register import register_tool

from .check_activation_status import check_activation_status
from .retry_activation import retry_activation


def register_esim_manager_tools(mcp: Any) -> None:
    register_tool(mcp, name="esim_manager__check_activation_status", fn=check_activation_status)
    register_tool(mcp, name="esim_manager__retry_activation", fn=retry_activation)
