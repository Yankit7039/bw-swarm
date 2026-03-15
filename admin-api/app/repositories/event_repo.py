from __future__ import annotations

import asyncpg
import json
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from app.domain.event import AgentEvent, EventType


class EventRepo:
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool

    async def create(
        self,
        agent_run_id: UUID,
        event_type: str,
        level: str,
        payload: dict[str, Any],
    ) -> AgentEvent:
        async with self.pool.acquire() as conn:
            payload_json = json.dumps(payload) if payload else '{}'
            row = await conn.fetchrow(
                """
                INSERT INTO agent_events (agent_run_id, event_type, level, payload)
                VALUES ($1, $2, $3, $4::jsonb)
                RETURNING *
                """,
                agent_run_id, event_type, level, payload_json
            )
        return AgentEvent(**dict(row))

    async def get_recent(self, seconds: int = 60) -> List[AgentEvent]:
        since = datetime.utcnow() - timedelta(seconds=seconds)
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM agent_events
                WHERE created_at > $1
                ORDER BY created_at ASC
                """,
                since
            )
        return [AgentEvent(**dict(row)) for row in rows]

    async def list(
        self,
        agent_id: UUID | None = None,
        step_id: str | None = None,
        event_type: str | None = None,
        level: str | None = None,
        from_: datetime | None = None,
        to: datetime | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[AgentEvent], int]:
        conditions = []
        params = []
        param_idx = 1

        if agent_id:
            conditions.append(f"agent_run_id = ${param_idx}")
            params.append(agent_id)
            param_idx += 1

        if step_id:
            conditions.append(f"payload->>'step_id' = ${param_idx}")
            params.append(step_id)
            param_idx += 1

        if event_type:
            conditions.append(f"event_type = ${param_idx}")
            params.append(event_type)
            param_idx += 1

        if level:
            conditions.append(f"level = ${param_idx}")
            params.append(level)
            param_idx += 1

        if from_:
            conditions.append(f"created_at >= ${param_idx}")
            params.append(from_)
            param_idx += 1

        if to:
            conditions.append(f"created_at <= ${param_idx}")
            params.append(to)
            param_idx += 1

        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

        async with self.pool.acquire() as conn:
            query = f"""
                SELECT * FROM agent_events
                {where_clause}
                ORDER BY created_at DESC
                LIMIT ${param_idx} OFFSET ${param_idx + 1}
            """
            params.extend([limit, offset])
            rows = await conn.fetch(query, *params)

            count_query = f"""
                SELECT COUNT(*) as total FROM agent_events
                {where_clause}
            """
            count_row = await conn.fetchrow(count_query, *params[:-2])

        return [AgentEvent(**dict(row)) for row in rows], count_row["total"]

    async def get_metrics(self) -> dict[str, Any]:
        async with self.pool.acquire() as conn:
            # Agent counts by status
            agent_rows = await conn.fetch(
                "SELECT status, COUNT(*) as count FROM agent_runs GROUP BY status"
            )

            # Agents completed/failed in last hour
            hour_ago = datetime.utcnow() - timedelta(hours=1)
            recent_rows = await conn.fetch(
                """
                SELECT status, COUNT(*) as count
                FROM agent_runs
                WHERE completed_at > $1
                GROUP BY status
                """,
                hour_ago
            )

            # Events per minute (last 10 minutes)
            ten_min_ago = datetime.utcnow() - timedelta(minutes=10)
            events_count = await conn.fetchval(
                "SELECT COUNT(*) FROM agent_events WHERE created_at > $1",
                ten_min_ago
            )

            # Steps completed per minute
            steps_count = await conn.fetchval(
                """
                SELECT COUNT(*) FROM agent_steps
                WHERE completed_at > $1 AND status = 'completed'
                """,
                ten_min_ago
            )

        agents = {row["status"]: row["count"] for row in agent_rows}
        recent = {row["status"]: row["count"] for row in recent_rows}

        return {
            "snapshot_at": datetime.utcnow().isoformat(),
            "agents": {
                "running": agents.get("running", 0),
                "paused": agents.get("paused", 0),
                "completed_last_hour": recent.get("completed", 0),
                "failed_last_hour": recent.get("failed", 0),
            },
            "queue": {
                "pending_triggers": 0,
                "depth": 0,
            },
            "throughput": {
                "events_per_minute": events_count / 10,
                "steps_completed_per_minute": steps_count / 10,
            },
            "error_rate": {
                "last_hour_percent": 0.0,  # Simplified for demo
            },
            "adapters": {
                "total_calls_last_hour": 0,
                "total_errors_last_hour": 0,
            },
        }
