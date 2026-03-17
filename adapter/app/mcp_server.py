from __future__ import annotations

import inspect
from typing import Any, Callable, Optional

from starlette.applications import Starlette

from app.adapters.amdocs_oms.adapter import register_amdocs_oms_tools
from app.adapters.ericsson.adapter import register_ericsson_tools
from app.adapters.netcracker.adapter import register_netcracker_tools
from app.adapters.siebel_crm.adapter import register_siebel_crm_tools


def _create_mcp_server():
    """
    Create an MCP server instance while tolerating MCP SDK API changes.

    MCP SDK has moved transport params between constructor and run()/app methods.
    We target a stateless StreamableHTTP server with JSON responses.
    """

    # Prefer FastMCP (decorator-based), but fall back to MCPServer if needed.
    try:
        from mcp.server.fastmcp import FastMCP  # type: ignore
        from mcp.server.transport_security import TransportSecuritySettings

        kwargs: dict[str, Any] = {}
        sig = inspect.signature(FastMCP.__init__)
        if "stateless_http" in sig.parameters:
            kwargs["stateless_http"] = True
        if "json_response" in sig.parameters:
            kwargs["json_response"] = True
        # We mount the ASGI app under /mcp in FastAPI. Set MCP's internal path to "/"
        # so the effective endpoint becomes /mcp (not /mcp/mcp).
        if "streamable_http_path" in sig.parameters:
            kwargs["streamable_http_path"] = "/"
        # Disable DNS rebinding protection for internal ClusterIP service; Host header
        # from K8s service names (e.g. adapter:8080) would otherwise trigger 421.
        if "transport_security" in sig.parameters:
            kwargs["transport_security"] = TransportSecuritySettings(
                enable_dns_rebinding_protection=False
            )
        mcp = FastMCP("swarm-adapter", **kwargs)
        return mcp
    except Exception:
        from mcp.server.mcpserver import MCPServer  # type: ignore

        return MCPServer("swarm-adapter")


_MCP_SERVER = _create_mcp_server()


def _register_all_tools(mcp: Any) -> None:
    register_amdocs_oms_tools(mcp)
    register_siebel_crm_tools(mcp)
    register_ericsson_tools(mcp)
    register_netcracker_tools(mcp)


_register_all_tools(_MCP_SERVER)


def get_mcp_session_manager() -> Optional[Any]:
    return getattr(_MCP_SERVER, "session_manager", None)


def _streamable_http_app(server: Any) -> Callable[..., Any]:
    # FastMCP and MCPServer both expose streamable_http_app().
    app_factory = getattr(server, "streamable_http_app", None)
    if app_factory is None:
        raise RuntimeError("MCP server does not support streamable_http_app()")

    sig = inspect.signature(app_factory)
    kwargs: dict[str, Any] = {}
    if "stateless_http" in sig.parameters:
        kwargs["stateless_http"] = True
    if "json_response" in sig.parameters:
        kwargs["json_response"] = True
    return app_factory(**kwargs)


def create_mcp_app() -> Starlette:
    # Mount this under /mcp in FastAPI; keep the MCP server's internal path default.
    return _streamable_http_app(_MCP_SERVER)

