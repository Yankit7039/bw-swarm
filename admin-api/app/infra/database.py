from __future__ import annotations

import asyncpg
from fastapi import FastAPI

from app.core.config import settings


async def init_db() -> asyncpg.Pool:
    print(f"[DB] Connecting to database...")
    pool = await asyncpg.create_pool(
        settings.postgres_url,
        min_size=5,
        max_size=20,
    )
    print(f"[DB] Connected successfully")

    async with pool.acquire() as conn:
        print(f"[DB] Creating tables...")
        # Create tables if they don't exist
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS templates (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL UNIQUE,
                version INTEGER NOT NULL DEFAULT 1,
                definition JSONB NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS agent_runs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                template_id UUID REFERENCES templates(id),
                status TEXT NOT NULL DEFAULT 'created',
                current_step TEXT,
                triggered_by TEXT DEFAULT 'manual',
                trigger_payload JSONB,
                started_at TIMESTAMPTZ DEFAULT NOW(),
                completed_at TIMESTAMPTZ,
                duration_ms INTEGER
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS agent_steps (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                agent_run_id UUID REFERENCES agent_runs(id),
                step_id TEXT NOT NULL,
                step_name TEXT NOT NULL,
                step_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                input JSONB,
                output JSONB,
                started_at TIMESTAMPTZ,
                completed_at TIMESTAMPTZ,
                duration_ms INTEGER,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS agent_events (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                agent_run_id UUID REFERENCES agent_runs(id),
                event_type TEXT NOT NULL,
                level TEXT DEFAULT 'info',
                payload JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        # Migration: Add created_at to agent_steps if it doesn't exist
        try:
            await conn.execute("""
                ALTER TABLE agent_steps 
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()
            """)
        except Exception as e:
            print(f"[DB] Migration warning: {e}")

        # Verify tables exist
        tables = await conn.fetch("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        print(f"[DB] Tables created: {[t['table_name'] for t in tables]}")

    return pool


def setup_database(app: FastAPI) -> None:
    @app.on_event("startup")
    async def startup() -> None:
        app.state.db_pool = await init_db()

    @app.on_event("shutdown")
    async def shutdown() -> None:
        if hasattr(app.state, "db_pool"):
            await app.state.db_pool.close()
