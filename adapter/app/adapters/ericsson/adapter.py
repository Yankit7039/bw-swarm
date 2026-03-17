from __future__ import annotations

from typing import Any

from app.adapters._mcp_register import register_tool

from .get_activation_logs import get_activation_logs
from .get_device_serial import get_device_serial
from .get_network_inventory import get_network_inventory
from .get_port_status import get_port_status
from .retry_activation import retry_activation


def register_ericsson_tools(mcp: Any) -> None:
    register_tool(mcp, name="ericsson__get_port_status", fn=get_port_status)
    register_tool(mcp, name="ericsson__get_device_serial", fn=get_device_serial)
    register_tool(mcp, name="ericsson__retry_activation", fn=retry_activation)
    register_tool(mcp, name="ericsson__get_activation_logs", fn=get_activation_logs)
    register_tool(mcp, name="ericsson__get_network_inventory", fn=get_network_inventory)

