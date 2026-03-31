import os
from contextlib import asynccontextmanager

import redis.asyncio as redis_async
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.routers import health as health_router
from app.routers import templates as templates_router
from app.routers import runs as runs_router
from app.routers import webhooks as webhooks_router
from app.routers import adapters as adapters_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379").strip()
    app.state.redis = redis_async.from_url(redis_url, decode_responses=True)
    try:
        yield
    finally:
        await app.state.redis.aclose()


app = FastAPI(
    title="SWARM Admin API",
    description="Admin API for templates (including PATCH workflow YAML), runs, and run_events over the shared runtime Postgres database.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router.router)
app.include_router(templates_router.router)
app.include_router(runs_router.router)
app.include_router(webhooks_router.router)
app.include_router(adapters_router.router)
