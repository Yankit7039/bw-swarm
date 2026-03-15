from __future__ import annotations

from fastapi import APIRouter, Request, Depends
import asyncpg

router = APIRouter()


def get_db_pool(request: Request) -> asyncpg.Pool:
    return request.app.state.db_pool


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/ready")
async def ready(pool: asyncpg.Pool = Depends(get_db_pool)):
    checks = {}

    try:
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        checks["postgres"] = "ok"
    except Exception as e:
        checks["postgres"] = f"error: {str(e)}"

    all_ok = all(v == "ok" for v in checks.values())

    return {
        "status": "ready" if all_ok else "not_ready",
        "checks": checks,
    }
