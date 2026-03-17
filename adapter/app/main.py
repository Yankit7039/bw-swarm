import contextlib
import os

from fastapi import FastAPI

from app.mcp_server import create_mcp_app, get_mcp_session_manager


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
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

