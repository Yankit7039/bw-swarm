import contextlib
import logging
import os

from fastapi import FastAPI

from app.mcp_server import create_mcp_app, get_mcp_session_manager
from app.tool_registry_db import ensure_schema_and_upsert_tools

logger = logging.getLogger(__name__)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await ensure_schema_and_upsert_tools()
    except Exception as e:
        logger.error("tool registry: startup sync failed: %s", e)

    session_manager = get_mcp_session_manager()
    if session_manager is None:
        yield
        return
    async with session_manager.run():
        yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="swarm-adapter",
        description="SWARM Adapter Service (FastAPI + MCP).",
        lifespan=lifespan,
    )

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok"}

    mcp_mount_path = os.environ.get("MCP_MOUNT_PATH", "/mcp")
    mcp_asgi_app = create_mcp_app()
    app.mount(mcp_mount_path, mcp_asgi_app)
    return app


app = create_app()

