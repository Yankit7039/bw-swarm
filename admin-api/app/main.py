from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError

from app.core.config import settings
from app.core.exceptions import app_error_handler, validation_error_handler, AppError
from app.infra.database import setup_database
from app.infra.sse_manager import SSEManager
from app.routers.templates import router as templates_router
from app.routers.agents import router as agents_router
from app.routers.events import router as events_router
from app.routers.health import router as health_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="SWARM Admin API",
        version="0.1.0",
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Database setup (creates pool and tables on startup)
    setup_database(app)

    # SSE manager
    @app.on_event("startup")
    async def setup_sse():
        app.state.sse_manager = SSEManager()

    # Exception handlers
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)

    # Routers
    app.include_router(templates_router, prefix="/templates", tags=["templates"])
    app.include_router(agents_router, prefix="/agents", tags=["agents"])
    app.include_router(events_router, prefix="/events", tags=["events"])
    app.include_router(health_router, tags=["health"])

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.port)
