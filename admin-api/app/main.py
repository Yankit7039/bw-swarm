from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.routers import health as health_router
from app.routers import templates as templates_router
from app.routers import runs as runs_router


app = FastAPI(
  title="SWARM Admin API",
  description="Read-only Admin API for templates, runs, and run_events over the shared runtime Postgres database.",
)

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=False,
  allow_methods=["*"],
  allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
  await init_db()


app.include_router(health_router.router)
app.include_router(templates_router.router)
app.include_router(runs_router.router)
