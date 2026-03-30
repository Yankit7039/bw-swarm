from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, MetaData, Table, Column, String, Text, DateTime, select, update
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine


DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://swarm:swarm@postgres:5432/swarm"
).replace("postgresql://", "postgresql+asyncpg://", 1)


metadata = MetaData()

templates_table = Table(
    "templates",
    metadata,
    Column("template_id", String, primary_key=True),
    Column("name", String, nullable=False),
    Column("image", String, nullable=False),
    Column("warm_pool_ref", String, nullable=True),
    Column("config", JSON, nullable=True),
    Column("workflow_yaml", String, nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

runs_table = Table(
    "runs",
    metadata,
    Column("run_id", PG_UUID(as_uuid=True), primary_key=True),
    Column("template_id", String, nullable=False),
    Column("status", String, nullable=False),
    Column("payload", JSON, nullable=False),
    Column("result", JSON, nullable=True),
    Column("error_message", Text, nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
    Column("completed_at", DateTime(timezone=True), nullable=True),
)

run_events_table = Table(
    "run_events",
    metadata,
    Column("id", PG_UUID, primary_key=True),
    Column("run_id", PG_UUID(as_uuid=True), nullable=False),
    Column("event_type", String, nullable=False),
    Column("event", Text, nullable=False),
    Column("payload", JSON, nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

adapter_tool_registry_table = Table(
    "adapter_tool_registry",
    metadata,
    Column("adapter_name", String, primary_key=True),
    Column("tool_name", String, primary_key=True),
    Column("mcp_tool_name", String, nullable=False),
    Column("description", Text, nullable=True),
    Column("input_schema", JSON, nullable=False),
    Column("docstring_warnings", JSON, nullable=True),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)


engine: AsyncEngine = create_async_engine(DATABASE_URL, echo=False)
session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine, expire_on_commit=False
)


async def init_db() -> None:
    """Lightweight connectivity check; does not manage schema."""
    async with engine.connect() as conn:
        await conn.execute(select(1))


def _serialize_dt(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _normalize_docstring_warnings(raw: Any) -> list[str] | None:
    if raw is None:
        return None
    if isinstance(raw, list):
        return [str(x) for x in raw]
    return None


def _adapter_tool_row_to_dict(row: dict[str, Any]) -> dict[str, Any]:
    data = dict(row)
    data["updated_at"] = _serialize_dt(data.get("updated_at"))
    data["docstring_warnings"] = _normalize_docstring_warnings(data.get("docstring_warnings"))
    return data


async def list_templates(limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
    async with session_factory() as session:
        stmt = (
            select(templates_table)
            .order_by(templates_table.c.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await session.execute(stmt)
        rows = result.fetchall()
        out: list[dict[str, Any]] = []
        for row in rows:
            data = dict(row._mapping)
            data["created_at"] = _serialize_dt(data.get("created_at"))
            data["updated_at"] = _serialize_dt(data.get("updated_at"))
            out.append(data)
        return out


async def get_template(template_id: str) -> dict[str, Any] | None:
    async with session_factory() as session:
        stmt = select(templates_table).where(templates_table.c.template_id == template_id)
        result = await session.execute(stmt)
        row = result.fetchone()
        if row is None:
            return None
        data = dict(row._mapping)
        data["created_at"] = _serialize_dt(data.get("created_at"))
        data["updated_at"] = _serialize_dt(data.get("updated_at"))
        return data


async def update_template_workflow_yaml(template_id: str, workflow_yaml: str | None) -> bool:
    async with session_factory() as session:
        now = datetime.now(timezone.utc)
        stmt = (
            update(templates_table)
            .where(templates_table.c.template_id == template_id)
            .values(workflow_yaml=workflow_yaml, updated_at=now)
        )
        result = await session.execute(stmt)
        await session.commit()
        return (result.rowcount or 0) > 0


async def list_runs(
    *,
    template_id: str | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    async with session_factory() as session:
        stmt = select(runs_table)
        if template_id:
            stmt = stmt.where(runs_table.c.template_id == template_id)
        if status:
            stmt = stmt.where(runs_table.c.status == status)
        stmt = stmt.order_by(runs_table.c.created_at.desc()).limit(limit).offset(offset)
        result = await session.execute(stmt)
        rows = result.fetchall()
        out: list[dict[str, Any]] = []
        for row in rows:
            data = dict(row._mapping)
            for key in ("created_at", "updated_at", "completed_at"):
                data[key] = _serialize_dt(data.get(key))
            data["run_id"] = str(data.get("run_id")) if data.get("run_id") is not None else None
            out.append(data)
        return out


async def get_run(run_id: UUID) -> dict[str, Any] | None:
    async with session_factory() as session:
        stmt = select(runs_table).where(runs_table.c.run_id == run_id)
        result = await session.execute(stmt)
        row = result.fetchone()
        if row is None:
            return None
        data = dict(row._mapping)
        for key in ("created_at", "updated_at", "completed_at"):
            data[key] = _serialize_dt(data.get(key))
        data["run_id"] = str(data.get("run_id")) if data.get("run_id") is not None else None
        return data


async def get_run_events(run_id: UUID) -> list[dict[str, Any]]:
    async with session_factory() as session:
        stmt = (
            select(
                run_events_table.c.event_type,
                run_events_table.c.event,
                run_events_table.c.created_at,
                run_events_table.c.payload,
            )
            .where(run_events_table.c.run_id == run_id)
            .order_by(run_events_table.c.created_at)
        )
        result = await session.execute(stmt)
        rows = result.fetchall()
        out: list[dict[str, Any]] = []
        for row in rows:
            data = dict(row._mapping)
            data["created_at"] = _serialize_dt(data.get("created_at"))
            out.append(data)
        return out


async def list_adapters_with_tools() -> list[dict[str, Any]]:
    """Single query; group rows by adapter_name in Python (no N+1)."""
    async with session_factory() as session:
        stmt = select(adapter_tool_registry_table).order_by(
            adapter_tool_registry_table.c.adapter_name,
            adapter_tool_registry_table.c.tool_name,
        )
        result = await session.execute(stmt)
        rows = result.fetchall()
        by_adapter: dict[str, list[dict[str, Any]]] = {}
        for row in rows:
            data = _adapter_tool_row_to_dict(dict(row._mapping))
            name = data["adapter_name"]
            by_adapter.setdefault(name, []).append(data)
        out: list[dict[str, Any]] = []
        for adapter_name in sorted(by_adapter.keys()):
            tools = by_adapter[adapter_name]
            out.append(
                {
                    "adapter_name": adapter_name,
                    "tool_count": len(tools),
                    "tools": tools,
                }
            )
        return out


async def get_adapter_tools(adapter_name: str) -> dict[str, Any] | None:
    async with session_factory() as session:
        stmt = (
            select(adapter_tool_registry_table)
            .where(adapter_tool_registry_table.c.adapter_name == adapter_name)
            .order_by(adapter_tool_registry_table.c.tool_name)
        )
        result = await session.execute(stmt)
        rows = result.fetchall()
        if not rows:
            return None
        tools = [_adapter_tool_row_to_dict(dict(row._mapping)) for row in rows]
        return {
            "adapter_name": adapter_name,
            "tool_count": len(tools),
            "tools": tools,
        }
