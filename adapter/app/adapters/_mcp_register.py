from __future__ import annotations

import inspect
from typing import Any, Callable

_REGISTERED_TOOLS: list[tuple[str, Callable[..., Any]]] = []


def get_registered_tools() -> list[tuple[str, Callable[..., Any]]]:
    """Snapshot of (mcp_tool_name, fn) pairs registered via register_tool."""
    return list(_REGISTERED_TOOLS)


def register_tool(mcp: Any, *, name: str, fn: Callable[..., Any]) -> None:
    """
    Register a tool on an MCP server while tolerating SDK signature changes.

    Some versions accept @mcp.tool(name="..."), others accept @mcp.tool().
    We always want stable externally-visible names like `amdocs_oms__get_order_status`.
    """
    tool_decorator = getattr(mcp, "tool", None)
    if tool_decorator is None:
        raise RuntimeError("MCP server does not expose a tool() decorator")

    sig = inspect.signature(tool_decorator)
    if "name" in sig.parameters:
        tool_decorator(name=name)(fn)
        _REGISTERED_TOOLS.append((name, fn))
        return

    # Fallback: register without explicit name. We set __name__ to our desired tool name.
    # Note: this relies on the SDK using function.__name__ as the tool name.
    try:
        fn.__name__ = name
    except Exception:
        pass
    tool_decorator()(fn)
    _REGISTERED_TOOLS.append((name, fn))

