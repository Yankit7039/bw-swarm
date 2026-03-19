"""Thin client for template: write run status and run_events to shared Postgres."""

import os
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import text, bindparam
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.types import Text

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://swarm:swarm@localhost:5432/swarm"
).replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, echo=False, connect_args={"ssl": None})
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def update_run_status(
    run_id: UUID,
    status: str,
    *,
    result: dict | None = None,
    error_message: str | None = None,
) -> None:
    """Update runs table: status, optional result/error_message; set completed_at if completed/failed.
    When status is 'completed', error_message is cleared (avoids stale error from earlier timeouts)."""
    now = datetime.now(timezone.utc)
    async with async_session_factory() as session:
        stmt = text("""
            UPDATE runs SET status = :status, updated_at = :now,
                completed_at = CASE WHEN :status IN ('completed', 'failed') THEN :now ELSE completed_at END
            WHERE run_id = :run_id
        """).bindparams(bindparam("status", type_=Text))
        await session.execute(stmt, {"run_id": str(run_id), "status": status, "now": now})
        if result is not None:
            stmt = text("UPDATE runs SET result = :result WHERE run_id = :run_id").bindparams(
                bindparam("result", type_=JSONB)
            )
            await session.execute(stmt, {"run_id": str(run_id), "result": result})
        if error_message is not None:
            await session.execute(
                text("UPDATE runs SET error_message = :error_message WHERE run_id = :run_id"),
                {"run_id": str(run_id), "error_message": error_message},
            )
        elif status == "completed":
            # Clear stale error_message (e.g. from runtime POST timeout before pod finished)
            await session.execute(
                text("UPDATE runs SET error_message = NULL WHERE run_id = :run_id"),
                {"run_id": str(run_id)},
            )
        await session.commit()


async def insert_run_event(
    run_id: UUID,
    event_type: str,
    event: str,
    payload: dict | None = None,
) -> None:
    """Insert one row into run_events."""
    async with async_session_factory() as session:
        await session.execute(
            text("""
                INSERT INTO run_events (run_id, event_type, event, payload, created_at)
                VALUES (:run_id, :event_type, :event, :payload, :now)
            """).bindparams(bindparam("payload", type_=JSONB)),
            {
                "run_id": str(run_id),
                "event_type": event_type,
                "event": event,
                "payload": payload,
                "now": datetime.now(timezone.utc),
            },
        )
        await session.commit()
