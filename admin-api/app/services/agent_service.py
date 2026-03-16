from __future__ import annotations

import asyncio
import json
import random
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from app.repositories.agent_repo import AgentRepo
from app.repositories.template_repo import TemplateRepo
from app.repositories.event_repo import EventRepo
from app.infra.sse_manager import SSEManager
from app.domain.agent import AgentStatus
from app.domain.event import EventType
from app.core.exceptions import AppError


def parse_json_field(value: Any) -> Any:
    """Parse JSON field from database - handles both dict and JSON strings."""
    if value is None:
        return None
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


class AgentService:
    def __init__(
        self,
        agent_repo: AgentRepo,
        template_repo: TemplateRepo,
        event_repo: EventRepo,
        sse_manager: SSEManager,
    ):
        self.agent_repo = agent_repo
        self.template_repo = template_repo
        self.event_repo = event_repo
        self.sse_manager = sse_manager

    async def create_agent(self, template_id: UUID, trigger_payload: dict[str, Any]) -> dict:
        # Verify template exists
        template = await self.template_repo.get_by_id(template_id)

        # Parse template definition (handle JSON string from DB)
        definition = parse_json_field(template.definition)

        # Create agent run
        agent = await self.agent_repo.create(template_id, "manual", trigger_payload)

        # Emit agent.created event
        event = await self.event_repo.create(
            agent.id,
            EventType.AGENT_CREATED,
            "info",
            {
                "agent_run_id": str(agent.id),
                "template_name": template.name,
                "triggered_by": "manual",
            }
        )
        await self.sse_manager.broadcast(event)

        # Launch simulation as background task
        asyncio.create_task(
            self._simulate_run(agent.id, definition, template.name)
        )

        return {
            "id": agent.id,
            "template_id": agent.template_id,
            "status": agent.status,
            "started_at": agent.started_at.isoformat() if agent.started_at else None,
        }

    async def _simulate_run(
        self,
        agent_id: UUID,
        template_definition: dict[str, Any],
        template_name: str,
    ) -> None:
        """Background task that simulates agent execution."""
        try:
            print(f"[SIMULATION] Starting for agent {agent_id}")
            print(f"[SIMULATION] Definition: {template_definition}")

            # Set agent to running
            await self.agent_repo.update_status(agent_id, "running")

            # Emit state change
            event = await self.event_repo.create(
                agent_id,
                EventType.AGENT_STATE_CHANGED,
                "info",
                {
                    "agent_run_id": str(agent_id),
                    "old_status": "created",
                    "new_status": "running",
                }
            )
            await self.sse_manager.broadcast(event)

            steps = template_definition.get("steps", [])
            started_at = datetime.now(timezone.utc)

            for step_def in steps:
                # Check if paused or cancelled
                agent = await self.agent_repo.get_by_id(agent_id)
                if agent.status == "cancelled":
                    break

                while agent.status == "paused":
                    await asyncio.sleep(1)
                    agent = await self.agent_repo.get_by_id(agent_id)
                    if agent.status == "cancelled":
                        break

                if agent.status == "cancelled":
                    break

                # Create step
                step = await self.agent_repo.create_step(
                    agent_id,
                    step_def["id"],
                    step_def.get("name", step_def["id"]),
                    step_def.get("type", "subagent"),
                    step_def.get("input", {}),
                )

                # Update current step
                await self.agent_repo.update_status(agent_id, "running", step_def["id"])

                # Emit step started
                event = await self.event_repo.create(
                    agent_id,
                    EventType.AGENT_STEP_STARTED,
                    "info",
                    {
                        "agent_run_id": str(agent_id),
                        "step_id": step_def["id"],
                        "step_name": step_def.get("name", step_def["id"]),
                    }
                )
                await self.sse_manager.broadcast(event)

                # Simulate work
                sleep_time = random.uniform(1.5, 3.5)
                await asyncio.sleep(sleep_time)

                # Check again after work
                agent = await self.agent_repo.get_by_id(agent_id)
                if agent.status == "cancelled":
                    await self.agent_repo.update_step_status(step.id, "cancelled")
                    break

                # Complete step
                output = self._generate_mock_output(step_def)
                duration_ms = int(sleep_time * 1000)
                await self.agent_repo.update_step_status(step.id, "completed", output, duration_ms)

                # Emit step completed
                event = await self.event_repo.create(
                    agent_id,
                    EventType.AGENT_STEP_COMPLETED,
                    "info",
                    {
                        "agent_run_id": str(agent_id),
                        "step_id": step_def["id"],
                        "step_name": step_def.get("name", step_def["id"]),
                        "duration_ms": duration_ms,
                        "output": output,
                    }
                )
                await self.sse_manager.broadcast(event)

            # Complete or fail agent
            agent = await self.agent_repo.get_by_id(agent_id)
            if agent.status != "cancelled":
                duration_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
                await self.agent_repo.update_status(agent_id, "completed")
                await self.agent_repo.update_duration(agent_id, duration_ms)

                event = await self.event_repo.create(
                    agent_id,
                    EventType.AGENT_COMPLETED,
                    "info",
                    {
                        "agent_run_id": str(agent_id),
                        "duration_ms": duration_ms,
                    }
                )
                await self.sse_manager.broadcast(event)

        except Exception as e:
            print(f"[SIMULATION] ERROR for agent {agent_id}: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()

            # Mark as failed
            await self.agent_repo.update_status(agent_id, "failed")
            event = await self.event_repo.create(
                agent_id,
                EventType.AGENT_FAILED,
                "error",
                {
                    "agent_run_id": str(agent_id),
                    "error": str(e),
                }
            )
            await self.sse_manager.broadcast(event)

    def _generate_mock_output(self, step_def: dict[str, Any]) -> dict[str, Any]:
        """Generate mock output based on output_schema or defaults."""
        output_schema = step_def.get("output_schema", {})
        output = {}

        for key, type_hint in output_schema.items():
            if type_hint == "string":
                output[key] = f"mock_{key}_value"
            elif type_hint == "number":
                output[key] = random.randint(1, 100)
            elif type_hint == "boolean":
                output[key] = random.choice([True, False])
            else:
                output[key] = f"mock_{key}"

        # Default outputs if no schema
        if not output:
            if step_def.get("type") == "subagent":
                output = {"result": "success", "data": f"completed_{step_def['id']}"}
            elif step_def.get("type") == "deterministic":
                output = {"status": "ok", "adapter_response": "mock_data"}

        return output

    async def list_agents(
        self,
        status: str | None = None,
        template_id: UUID | None = None,
        from_: datetime | None = None,
        to: datetime | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> dict:
        agents, total = await self.agent_repo.list(status, template_id, from_, to, limit, offset)

        # Get template names
        data = []
        for agent in agents:
            template = await self.template_repo.get_by_id(agent.template_id)
            duration_ms = None
            if agent.duration_ms:
                duration_ms = agent.duration_ms
            elif agent.started_at and agent.status == "running":
                # Handle both naive and timezone-aware datetimes
                now = datetime.now(timezone.utc)
                if agent.started_at.tzinfo is None:
                    started_at = agent.started_at.replace(tzinfo=timezone.utc)
                else:
                    started_at = agent.started_at
                duration_ms = int((now - started_at).total_seconds() * 1000)

            data.append({
                "id": agent.id,
                "template_id": agent.template_id,
                "template_name": template.name if template else "Unknown",
                "status": agent.status,
                "current_step": agent.current_step,
                "triggered_by": agent.triggered_by,
                "started_at": agent.started_at.isoformat() if agent.started_at else None,
                "duration_ms": duration_ms,
            })

        return {
            "data": data,
            "pagination": {
                "total": total,
                "limit": limit,
                "offset": offset,
            }
        }

    async def get_agent(self, agent_id: UUID) -> dict:
        agent = await self.agent_repo.get_by_id(agent_id)
        template = await self.template_repo.get_by_id(agent.template_id)

        steps_data = []
        for step in agent.steps:
            steps_data.append({
                "id": step.id,
                "step_id": step.step_id,
                "step_name": step.step_name,
                "step_type": step.step_type,
                "status": step.status,
                "input": parse_json_field(step.input),
                "output": parse_json_field(step.output),
                "started_at": step.started_at.isoformat() if step.started_at else None,
                "completed_at": step.completed_at.isoformat() if step.completed_at else None,
                "duration_ms": step.duration_ms,
            })

        return {
            "id": agent.id,
            "template_id": agent.template_id,
            "template_name": template.name if template else "Unknown",
            "status": agent.status,
            "triggered_by": agent.triggered_by,
            "trigger_payload": parse_json_field(agent.trigger_payload) or {},
            "started_at": agent.started_at.isoformat() if agent.started_at else None,
            "completed_at": agent.completed_at.isoformat() if agent.completed_at else None,
            "duration_ms": agent.duration_ms,
            "steps": steps_data,
        }

    async def get_agent_steps(self, agent_id: UUID) -> dict:
        agent = await self.agent_repo.get_by_id(agent_id)
        steps = await self.agent_repo.get_steps(agent_id)

        steps_data = []
        for step in steps:
            steps_data.append({
                "step_id": step.step_id,
                "step_name": step.step_name,
                "status": step.status,
                "duration_ms": step.duration_ms,
            })

        return {
            "agent_run_id": agent_id,
            "steps": steps_data,
        }

    async def pause_agent(self, agent_id: UUID) -> dict:
        agent = await self.agent_repo.get_by_id(agent_id)

        if agent.status != "running":
            raise AppError(
                "invalid_state_transition",
                f"Agent is not in a pausable state (current: {agent.status})",
                409,
            )

        await self.agent_repo.update_status(agent_id, "paused")

        event = await self.event_repo.create(
            agent_id,
            EventType.AGENT_PAUSED,
            "info",
            {"agent_run_id": str(agent_id), "old_status": "running", "new_status": "paused"}
        )
        await self.sse_manager.broadcast(event)

        return {
            "id": agent_id,
            "status": "paused",
            "paused_at": datetime.utcnow().isoformat(),
        }

    async def resume_agent(self, agent_id: UUID) -> dict:
        agent = await self.agent_repo.get_by_id(agent_id)

        if agent.status != "paused":
            raise AppError(
                "invalid_state_transition",
                f"Agent is not in a resumable state (current: {agent.status})",
                409,
            )

        await self.agent_repo.update_status(agent_id, "running")

        event = await self.event_repo.create(
            agent_id,
            EventType.AGENT_RESUMED,
            "info",
            {"agent_run_id": str(agent_id), "old_status": "paused", "new_status": "running"}
        )
        await self.sse_manager.broadcast(event)

        return {
            "id": agent_id,
            "status": "running",
            "resumed_at": datetime.utcnow().isoformat(),
        }

    async def cancel_agent(self, agent_id: UUID) -> dict:
        agent = await self.agent_repo.get_by_id(agent_id)

        if agent.status not in ["running", "paused"]:
            raise AppError(
                "invalid_state_transition",
                f"Agent cannot be cancelled from state: {agent.status}",
                409,
            )

        await self.agent_repo.update_status(agent_id, "cancelled")

        event = await self.event_repo.create(
            agent_id,
            EventType.AGENT_CANCELLED,
            "info",
            {"agent_run_id": str(agent_id), "old_status": agent.status, "new_status": "cancelled"}
        )
        await self.sse_manager.broadcast(event)

        return {
            "id": agent_id,
            "status": "cancelled",
            "cancelled_at": datetime.utcnow().isoformat(),
        }
