"""Postgres client for template pods: runs, run_events, follow-up, communication threads."""

import os
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import bindparam, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.types import Boolean, Text

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
    state: dict | None = None,
    followup_due_at: datetime | None = None,
    follow_up_in_progress: bool | None = None,
    followup_due_at_clear: bool = False,
) -> None:
    """Update runs table: status, optional result/error_message, follow-up columns."""
    now = datetime.now(timezone.utc)
    async with async_session_factory() as session:
        stmt = text("""
            UPDATE runs SET status = :status, updated_at = :now,
                completed_at = CASE WHEN :status IN ('completed', 'failed', 'exhausted') THEN :now ELSE completed_at END
            WHERE run_id = :run_id
        """).bindparams(bindparam("status", type_=Text))
        await session.execute(stmt, {"run_id": str(run_id), "status": status, "now": now})
        if followup_due_at_clear:
            await session.execute(
                text("UPDATE runs SET followup_due_at = NULL WHERE run_id = :run_id"),
                {"run_id": str(run_id)},
            )
        elif followup_due_at is not None:
            await session.execute(
                text("UPDATE runs SET followup_due_at = :fd WHERE run_id = :run_id"),
                {"run_id": str(run_id), "fd": followup_due_at},
            )
        if result is not None:
            await session.execute(
                text("UPDATE runs SET result = :result WHERE run_id = :run_id").bindparams(
                    bindparam("result", type_=JSONB)
                ),
                {"run_id": str(run_id), "result": result},
            )
        if error_message is not None:
            await session.execute(
                text("UPDATE runs SET error_message = :error_message WHERE run_id = :run_id"),
                {"run_id": str(run_id), "error_message": error_message},
            )
        elif status == "completed":
            await session.execute(
                text("UPDATE runs SET error_message = NULL WHERE run_id = :run_id"),
                {"run_id": str(run_id)},
            )
        if state is not None:
            await session.execute(
                text("UPDATE runs SET state = :state WHERE run_id = :run_id").bindparams(
                    bindparam("state", type_=JSONB)
                ),
                {"run_id": str(run_id), "state": state},
            )
        if follow_up_in_progress is not None:
            await session.execute(
                text("UPDATE runs SET follow_up_in_progress = :fup WHERE run_id = :run_id").bindparams(
                    bindparam("fup", type_=Boolean)
                ),
                {"run_id": str(run_id), "fup": follow_up_in_progress},
            )
        await session.commit()


async def clear_followup_columns(run_id: UUID) -> None:
    """Null state and followup_due_at (e.g. on terminal completion)."""
    async with async_session_factory() as session:
        await session.execute(
            text(
                "UPDATE runs SET state = NULL, followup_due_at = NULL, follow_up_in_progress = false "
                "WHERE run_id = :run_id"
            ),
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


def followup_due_after_seconds(seconds: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=seconds)


async def insert_communication_thread(
    channel_thread_id: str, run_id: UUID, template_id: str
) -> None:
    """Register inbound routing for this channel thread (idempotent)."""
    if not channel_thread_id or not str(channel_thread_id).strip():
        return
    async with async_session_factory() as session:
        await session.execute(
            text(
                "INSERT INTO communication_threads (channel_thread_id, run_id, template_id, created_at) "
                "VALUES (:tid, :run_id, :tpl, :now) "
                "ON CONFLICT (channel_thread_id) DO NOTHING"
            ),
            {
                "tid": str(channel_thread_id).strip(),
                "run_id": str(run_id),
                "tpl": template_id,
                "now": datetime.now(timezone.utc),
            },
        )
        await session.commit()


async def mark_pending_processed_for_thread(channel_thread_id: str) -> int:
    """Mark all unprocessed pending inbound rows for this thread; returns row count."""
    if not channel_thread_id or not str(channel_thread_id).strip():
        return 0
    async with async_session_factory() as session:
        result = await session.execute(
            text(
                "UPDATE pending_inbound_interactions SET processed = true "
                "WHERE channel_thread_id = :tid AND processed = false"
            ),
            {"tid": str(channel_thread_id).strip()},
        )
        await session.commit()
        rc = result.rowcount
        return int(rc) if rc is not None else 0


async def mark_pending_processed_by_id(pending_id: int) -> bool:
    """Mark one pending row processed. Returns True if a row was updated."""
    async with async_session_factory() as session:
        result = await session.execute(
            text(
                "UPDATE pending_inbound_interactions SET processed = true "
                "WHERE id = :id AND processed = false"
            ),
            {"id": pending_id},
        )
        await session.commit()
        rc = result.rowcount
        return rc is not None and rc > 0
