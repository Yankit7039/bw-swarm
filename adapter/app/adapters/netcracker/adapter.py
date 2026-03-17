from __future__ import annotations

from typing import Any

from app.adapters._mcp_register import register_tool

from .get_dependency_map import get_dependency_map
from .get_inventory_snapshot import get_inventory_snapshot
from .get_provisioning_status import get_provisioning_status
from .get_resource_allocation import get_resource_allocation
from .get_serial_lookup import get_serial_lookup


def register_netcracker_tools(mcp: Any) -> None:
    register_tool(mcp, name="netcracker__get_resource_allocation", fn=get_resource_allocation)
    register_tool(mcp, name="netcracker__get_serial_lookup", fn=get_serial_lookup)
    register_tool(mcp, name="netcracker__get_provisioning_status", fn=get_provisioning_status)
    register_tool(mcp, name="netcracker__get_inventory_snapshot", fn=get_inventory_snapshot)
    register_tool(mcp, name="netcracker__get_dependency_map", fn=get_dependency_map)

