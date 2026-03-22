from __future__ import annotations

from typing import Any

from app.adapters._mcp_register import register_tool

from .correct_and_resubmit import correct_and_resubmit
from .get_rejection_reason import get_rejection_reason
from .get_validation_status import get_validation_status
from .retry_port_request import retry_port_request


def register_porting_gateway_tools(mcp: Any) -> None:
    register_tool(mcp, name="porting_gateway__get_validation_status", fn=get_validation_status)
    register_tool(mcp, name="porting_gateway__get_rejection_reason", fn=get_rejection_reason)
    register_tool(mcp, name="porting_gateway__correct_and_resubmit", fn=correct_and_resubmit)
    register_tool(mcp, name="porting_gateway__retry_port_request", fn=retry_port_request)
