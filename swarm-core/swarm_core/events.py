"""Typed event emission — same DB row shape as legacy templates (event_type, event, payload)."""

from __future__ import annotations

from typing import Any
from uuid import UUID


class EventEmitter:
    """Wraps insert_run_event with consistent payload shapes for the admin console."""

    def __init__(
        self,
        run_id: UUID | None,
        insert_run_event: Any,
    ) -> None:
        self._run_id = run_id
        self._insert = insert_run_event

    async def _emit(self, event_type: str, event: str, payload: dict | None) -> None:
        if self._insert and self._run_id:
            await self._insert(self._run_id, event_type, event, payload)

    async def workflow_started(self) -> None:
        await self._emit("workflow_started", "Workflow started", None)

    async def workflow_completed(self) -> None:
        await self._emit("workflow_completed", "Workflow completed", None)

    async def workflow_stage_started(self, stage: str, stage_type: str) -> None:
        p: dict[str, Any] = {"stage": stage, "stage_type": stage_type}
        if stage:
            p["parent_agent"] = stage
        await self._emit("workflow_stage_started", f"Stage {stage} started", p)

    async def workflow_stage_completed(self, stage: str, stage_type: str) -> None:
        p: dict[str, Any] = {"stage": stage, "stage_type": stage_type}
        if stage:
            p["parent_agent"] = stage
        await self._emit("workflow_stage_completed", f"Stage {stage} completed", p)

    async def agent_started(self, agent: str) -> None:
        await self._emit("agent_started", f"Starting {agent}", {"agent": agent})

    async def agent_completed(self, agent: str) -> None:
        await self._emit("agent_completed", f"Completed {agent}", {"agent": agent})

    async def tool_started(
        self,
        label: str,
        payload: dict[str, Any],
    ) -> None:
        await self._emit("tool_started", label, payload)

    async def tool_completed(self, label: str, payload: dict[str, Any]) -> None:
        await self._emit("tool_completed", f"Completed {label}", dict(payload))

    async def llm_message(self, text: str, agent: str | None, parent_agent: str | None = None) -> None:
        p: dict[str, Any] = {"text": text, "agent": agent}
        if parent_agent or agent:
            p["parent_agent"] = parent_agent or agent
        await self._emit("llm_message", "Model responded", p)

    async def condition_evaluated(self, step_name: str, branch: str, set_keys: list[str]) -> None:
        await self._emit(
            "condition_evaluated",
            f"Condition {step_name or 'step'}: {branch}",
            {"step": step_name, "branch": branch, "set": set_keys},
        )

    async def poll_iteration_started(self, stage: str, iteration: int) -> None:
        await self._emit(
            "poll_iteration_started",
            f"Poll iteration {iteration} ({stage})",
            {"stage": stage, "iteration": iteration},
        )

    async def poll_iteration_completed(
        self, stage: str, iteration: int, *, exit_condition_met: bool
    ) -> None:
        await self._emit(
            "poll_iteration_completed",
            f"Poll iteration {iteration} done ({stage})",
            {"stage": stage, "iteration": iteration, "exit_condition_met": exit_condition_met},
        )

    async def escalation_triggered(
        self, stage: str, iteration: int, level: str, label: str
    ) -> None:
        await self._emit(
            "escalation_triggered",
            f"Escalation {label} ({stage}, iter {iteration})",
            {"stage": stage, "iteration": iteration, "level": level, "label": label},
        )
