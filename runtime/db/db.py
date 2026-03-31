"""Database layer for templates, runs, run_events — async SQLAlchemy with Postgres."""

import os
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Boolean, DateTime, JSON, bindparam, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://swarm:swarm@localhost:5432/swarm"
).replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, echo=False)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Template(Base):
    __tablename__ = "templates"

    template_id: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(nullable=False)
    image: Mapped[str] = mapped_column(nullable=False)
    warm_pool_ref: Mapped[str | None] = mapped_column(nullable=True)
    config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class Run(Base):
    __tablename__ = "runs"

    run_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    template_id: Mapped[str] = mapped_column(nullable=False, index=True)
    status: Mapped[str] = mapped_column(nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    assigned_pod: Mapped[str | None] = mapped_column(nullable=True)
    sandbox_claim_name: Mapped[str | None] = mapped_column(nullable=True)
    claim_deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    state: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    followup_due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    follow_up_in_progress: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class RunEvent(Base):
    __tablename__ = "run_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    run_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(nullable=False)
    event: Mapped[str] = mapped_column(nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


async def init_db() -> None:
    """Create tables if they do not exist (matches migrations 001)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_template(template_id: str) -> dict | None:
    async with async_session_factory() as session:
        row = await session.get(Template, template_id)
        if row is None:
            return None
        return {
            "template_id": row.template_id,
            "name": row.name,
            "image": row.image,
            "warm_pool_ref": row.warm_pool_ref,
            "config": row.config,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }


async def create_run(
    run_id: UUID,
    template_id: str,
    payload: dict,
    *,
    sandbox_claim_name: str | None = None,
) -> None:
    async with async_session_factory() as session:
        session.add(
            Run(
                run_id=run_id,
                template_id=template_id,
                status="pending",
                payload=payload,
                sandbox_claim_name=sandbox_claim_name,
            )
        )
        await session.commit()


async def reset_run_for_queue_retry(run_id: UUID) -> None:
    """Set status back to queued and clear orchestration fields after a retryable sandbox timeout."""
    now = datetime.now(timezone.utc)
    async with async_session_factory() as session:
        row = await session.get(Run, run_id)
        if row is None:
            return
        row.status = "queued"
        row.updated_at = now
        row.error_message = None
        row.assigned_pod = None
        row.sandbox_claim_name = None
        await session.commit()


async def get_run(run_id: UUID) -> dict | None:
    async with async_session_factory() as session:
        row = await session.get(Run, run_id)
        if row is None:
            return None
        return {
            "run_id": str(row.run_id),
            "template_id": row.template_id,
            "status": row.status,
            "payload": row.payload,
            "result": row.result,
            "error_message": row.error_message,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            "completed_at": row.completed_at.isoformat() if row.completed_at else None,
            "assigned_pod": row.assigned_pod,
            "sandbox_claim_name": row.sandbox_claim_name,
            "claim_deleted_at": row.claim_deleted_at.isoformat() if row.claim_deleted_at else None,
            "state": row.state,
            "followup_due_at": row.followup_due_at.isoformat() if row.followup_due_at else None,
            "follow_up_in_progress": row.follow_up_in_progress,
        }


async def update_run_status(
    run_id: UUID,
    status: str,
    *,
    result: dict | None = None,
    error_message: str | None = None,
    assigned_pod: str | None = None,
    sandbox_claim_name: str | None = None,
) -> None:
    now = datetime.now(timezone.utc)
    async with async_session_factory() as session:
        row = await session.get(Run, run_id)
        if row is None:
            return
        row.status = status
        row.updated_at = now
        if result is not None:
            row.result = result
        if error_message is not None:
            row.error_message = error_message
        if assigned_pod is not None:
            row.assigned_pod = assigned_pod
        if sandbox_claim_name is not None:
            row.sandbox_claim_name = sandbox_claim_name
            row.claim_deleted_at = None
        if status == "failed":
            row.follow_up_in_progress = False
        if status in ("completed", "failed", "exhausted"):
            row.completed_at = now
        await session.commit()


async def get_runs_with_uncleaned_claims() -> list[tuple[UUID, str]]:
    """Returns (run_id, sandbox_claim_name) for terminal runs with a claim not yet deleted.

    Do not add 'processing_reply' to the status list — those runs may still have an active pod.
    """
    async with async_session_factory() as session:
        result = await session.execute(
            text(
                "SELECT run_id, sandbox_claim_name FROM runs "
                "WHERE status IN ('completed', 'failed', 'waiting_for_followup', 'exhausted') "
                "AND sandbox_claim_name IS NOT NULL AND claim_deleted_at IS NULL "
                "AND NOT (status = 'running' AND follow_up_in_progress = true)"
            ),
        )
        rows = result.fetchall()
        return [(r[0], r[1]) for r in rows]


async def fetch_due_followup_runs() -> list[tuple[UUID, str, dict, dict | None]]:
    """Runs ready for follow-up: (run_id, template_id, payload, state). Single query."""
    async with async_session_factory() as session:
        result = await session.execute(
            text(
                "SELECT run_id, template_id, payload, state FROM runs "
                "WHERE status = 'waiting_for_followup' "
                "AND status <> 'processing_reply' "
                "AND followup_due_at IS NOT NULL AND followup_due_at <= NOW() "
                "AND follow_up_in_progress = false"
            ),
        )
        rows = result.fetchall()
        return [(r[0], r[1], r[2] or {}, r[3]) for r in rows]


async def claim_followup_run(run_id: UUID) -> bool:
    """Atomically move run from waiting_for_followup to running with follow_up_in_progress. Returns True if claimed."""
    now = datetime.now(timezone.utc)
    async with async_session_factory() as session:
        result = await session.execute(
            text(
                "UPDATE runs SET status = 'running', follow_up_in_progress = true, updated_at = :now "
                "WHERE run_id = :run_id AND status = 'waiting_for_followup' "
                "AND status <> 'processing_reply' "
                "AND followup_due_at IS NOT NULL AND followup_due_at <= :now "
                "AND follow_up_in_progress = false"
            ),
            {"run_id": str(run_id), "now": now},
        )
        await session.commit()
        rc = result.rowcount
        return rc is not None and rc > 0


async def mark_claim_deleted(run_id: UUID) -> None:
    """Set claim_deleted_at = now() for the run after SandboxClaim is deleted."""
    now = datetime.now(timezone.utc)
    async with async_session_factory() as session:
        row = await session.get(Run, run_id)
        if row is None:
            return
        row.claim_deleted_at = now
        await session.commit()


async def insert_run_event(
    run_id: UUID,
    event_type: str,
    event: str,
    payload: dict | None = None,
) -> None:
    async with async_session_factory() as session:
        session.add(
            RunEvent(run_id=run_id, event_type=event_type, event=event, payload=payload)
        )
        await session.commit()


async def get_run_events(run_id: UUID) -> list[dict]:
    async with async_session_factory() as session:
        result = await session.execute(
            text(
                "SELECT event_type, event, created_at, payload FROM run_events WHERE run_id = :run_id ORDER BY created_at"
            ),
            {"run_id": str(run_id)},
        )
        rows = result.fetchall()
        return [
            {
                "event_type": r[0],
                "event": r[1],
                "created_at": r[2].isoformat() if r[2] else None,
                "payload": r[3],
            }
            for r in rows
        ]


async def get_communication_route(channel_thread_id: str) -> tuple[UUID, str] | None:
    """Return (run_id, template_id) if this channel thread is registered."""
    if not channel_thread_id or not str(channel_thread_id).strip():
        return None
    async with async_session_factory() as session:
        result = await session.execute(
            text(
                "SELECT run_id, template_id FROM communication_threads WHERE channel_thread_id = :tid"
            ),
            {"tid": str(channel_thread_id).strip()},
        )
        row = result.fetchone()
        if row is None:
            return None
        return (row[0], row[1])


async def enqueue_pending_inbound(channel_thread_id: str, payload: dict) -> None:
    async with async_session_factory() as session:
        await session.execute(
            text(
                "INSERT INTO pending_inbound_interactions (channel_thread_id, payload, processed, created_at) "
                "VALUES (:tid, :payload, false, :now)"
            ).bindparams(bindparam("payload", type_=JSONB)),
            {
                "tid": channel_thread_id,
                "payload": payload,
                "now": datetime.now(timezone.utc),
            },
        )
        await session.commit()


async def try_claim_run_for_reply(run_id: UUID) -> bool:
    """Atomically transition waiting_for_followup or exhausted -> processing_reply. Returns True if one row updated."""
    now = datetime.now(timezone.utc)
    async with async_session_factory() as session:
        result = await session.execute(
            text(
                "UPDATE runs SET status = 'processing_reply', updated_at = :now, follow_up_in_progress = false "
                "WHERE run_id = :run_id AND follow_up_in_progress = false "
                "AND status IN ('waiting_for_followup', 'exhausted')"
            ),
            {"run_id": str(run_id), "now": now},
        )
        await session.commit()
        rc = result.rowcount
        return rc is not None and rc > 0


async def fetch_oldest_unprocessed_pending() -> tuple[int, str, object] | None:
    """Oldest unprocessed pending row (FIFO by created_at). Returns (id, channel_thread_id, payload) or None.

    Payload is returned as stored (typically a dict); non-dict JSON is preserved so callers can dead-letter.
    """
    async with async_session_factory() as session:
        result = await session.execute(
            text(
                "SELECT id, channel_thread_id, payload FROM pending_inbound_interactions "
                "WHERE processed = false ORDER BY created_at ASC LIMIT 1"
            ),
        )
        row = result.fetchone()
        if row is None:
            return None
        pid, tid, payload = row[0], row[1], row[2]
        if payload is None:
            payload = {}
        return (int(pid), str(tid), payload)


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


async def mark_pending_processed_for_thread(channel_thread_id: str) -> int:
    """Mark all unprocessed pending rows for this thread processed; returns number of rows updated."""
    async with async_session_factory() as session:
        result = await session.execute(
            text(
                "UPDATE pending_inbound_interactions SET processed = true "
                "WHERE channel_thread_id = :tid AND processed = false"
            ),
            {"tid": channel_thread_id},
        )
        await session.commit()
        rc = result.rowcount
        return int(rc) if rc is not None else 0
