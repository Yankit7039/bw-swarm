"""Database layer for templates, runs, run_events — async SQLAlchemy with Postgres."""

import os
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import DateTime, JSON, text
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
        if status in ("completed", "failed"):
            row.completed_at = now
        await session.commit()


async def get_runs_with_uncleaned_claims() -> list[tuple[UUID, str]]:
    """Returns (run_id, sandbox_claim_name) for terminal runs with a claim not yet deleted."""
    async with async_session_factory() as session:
        result = await session.execute(
            text(
                "SELECT run_id, sandbox_claim_name FROM runs "
                "WHERE status IN ('completed', 'failed') "
                "AND sandbox_claim_name IS NOT NULL AND claim_deleted_at IS NULL"
            ),
        )
        rows = result.fetchall()
        return [(r[0], r[1]) for r in rows]


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
