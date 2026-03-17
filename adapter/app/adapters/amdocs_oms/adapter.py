from __future__ import annotations

from typing import Any

from app.adapters._mcp_register import register_tool

from .get_error_codes import get_error_codes
from .get_order_history import get_order_history
from .get_order_status import get_order_status
from .get_workflow_state import get_workflow_state
from .retry_order import retry_order


def register_amdocs_oms_tools(mcp: Any) -> None:
    register_tool(mcp, name="amdocs_oms__get_order_status", fn=get_order_status)
    register_tool(mcp, name="amdocs_oms__get_workflow_state", fn=get_workflow_state)
    register_tool(mcp, name="amdocs_oms__get_error_codes", fn=get_error_codes)
    register_tool(mcp, name="amdocs_oms__retry_order", fn=retry_order)
    register_tool(mcp, name="amdocs_oms__get_order_history", fn=get_order_history)

