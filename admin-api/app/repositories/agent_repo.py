from __future__ import annotations

import asyncpg
import json
from datetime import datetime
from typing import Any
from uuid import UUID

from app.domain.agent import AgentRun, Step, AgentStatus
from app.core.exceptions import AppError


class AgentRepo:
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool

    async def get_by_id(self, agent_id: UUID) -> AgentRun:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT ar.*, t.name as template_name
                FROM agent_runs ar
                JOIN templates t ON ar.template_id = t.id
                WHERE ar.id = $1
                """,
                agent_id
            )
            if row is None:
                raise AppError("not_found", f"Agent {agent_id} not found", 404)

            # Get steps
            step_rows = await conn.fetch(
                "SELECT * FROM agent_steps WHERE agent_run_id = $1 ORDER BY created_at",
                agent_id
            )

        data = dict(row)
        template_name = data.pop("template_name", None)
        steps = [Step(**dict(s)) for s in step_rows]

        agent = AgentRun(**data)
        agent.steps = steps
        return agent

    async def list(
        self,
        status: str | None = None,
        template_id: UUID | None = None,
        from_: datetime | None = None,
        to: datetime | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[AgentRun], int]:
        conditions = []
        params = []
        param_idx = 1

        if status:
            conditions.append(f"status = ${param_idx}")
            params.append(status)
            param_idx += 1

        if template_id:
            conditions.append(f"template_id = ${param_idx}")
            params.append(template_id)
            param_idx += 1

        if from_:
            conditions.append(f"started_at >= ${param_idx}")
            params.append(from_)
            param_idx += 1

        if to:
            conditions.append(f"started_at <= ${param_idx}")
            params.append(to)
            param_idx += 1

        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

        async with self.pool.acquire() as conn:
            query = f"""
                SELECT ar.*, t.name as template_name
                FROM agent_runs ar
                JOIN templates t ON ar.template_id = t.id
                {where_clause}
                ORDER BY ar.started_at DESC
                LIMIT ${param_idx} OFFSET ${param_idx + 1}
            """
            params.extend([limit, offset])
            rows = await conn.fetch(query, *params)

            count_query = f"""
                SELECT COUNT(*) as total
                FROM agent_runs ar
                {where_clause}
            """
            count_row = await conn.fetchrow(count_query, *params[:-2])

        agents = []
        for row in rows:
            data = dict(row)
            data.pop("template_name", None)
            agents.append(AgentRun(**data))

        return agents, count_row["total"]

    async def create(
        self, template_id: UUID, triggered_by: str, trigger_payload: dict[str, Any]
    ) -> AgentRun:
        async with self.pool.acquire() as conn:
            payload_json = json.dumps(trigger_payload) if trigger_payload else '{}'
            row = await conn.fetchrow(
                """
                INSERT INTO agent_runs (template_id, status, triggered_by, trigger_payload)
                VALUES ($1, 'created', $2, $3::jsonb)
                RETURNING *
                """,
                template_id, triggered_by, payload_json
            )
        return AgentRun(**dict(row))

    async def update_status(
        self, agent_id: UUID, status: str, current_step: str | None = None
    ) -> None:
        async with self.pool.acquire() as conn:
            if status in ["completed", "failed", "cancelled"]:
                await conn.execute(
                    """
                    UPDATE agent_runs
                    SET status = $2, current_step = $3, completed_at = NOW()
                    WHERE id = $1
                    """,
                    agent_id, status, current_step
                )
            else:
                await conn.execute(
                    """
                    UPDATE agent_runs
                    SET status = $2, current_step = $3
                    WHERE id = $1
                    """,
                    agent_id, status, current_step
                )

    async def update_duration(self, agent_id: UUID, duration_ms: int) -> None:
        async with self.pool.acquire() as conn:
            await conn.execute(
                "UPDATE agent_runs SET duration_ms = $2 WHERE id = $1",
                agent_id, duration_ms
            )

    async def create_step(
        self,
        agent_run_id: UUID,
        step_id: str,
        step_name: str,
        step_type: str,
        input_data: dict[str, Any] | None = None,
    ) -> Step:
        async with self.pool.acquire() as conn:
            input_json = json.dumps(input_data) if input_data else '{}'
            row = await conn.fetchrow(
                """
                INSERT INTO agent_steps (agent_run_id, step_id, step_name, step_type, status, input)
                VALUES ($1, $2, $3, $4, 'pending', $5::jsonb)
                RETURNING *
                """,
                agent_run_id, step_id, step_name, step_type, input_json
            )
        return Step(**dict(row))

    async def update_step_status(
        self,
        step_id: UUID,
        status: str,
        output: dict[str, Any] | None = None,
        duration_ms: int | None = None,
    ) -> None:
        async with self.pool.acquire() as conn:
            if status == "running":
                await conn.execute(
                    """
                    UPDATE agent_steps
                    SET status = $2, started_at = NOW()
                    WHERE id = $1
                    """,
                    step_id, status
                )
            elif status in ["completed", "failed", "cancelled"]:
                output_json = json.dumps(output) if output else '{}'
                await conn.execute(
                    """
                    UPDATE agent_steps
                    SET status = $2, output = $3::jsonb, completed_at = NOW(), duration_ms = $4
                    WHERE id = $1
                    """,
                    step_id, status, output_json, duration_ms
                )

    async def get_steps(self, agent_run_id: UUID) -> List[Step]:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM agent_steps WHERE agent_run_id = $1 ORDER BY created_at",
                agent_run_id
            )
        return [Step(**dict(row)) for row in rows]
