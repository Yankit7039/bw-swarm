"""SwarmHybridAgent — YAML workflow with mcp_call, condition, llm_agent, poll_loop."""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Any, AsyncGenerator

from google.adk.agents import BaseAgent, LlmAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.tools import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

from .yaml_runner import (
    _parse_llm_json,
    eval_condition,
    execute_condition,
    execute_mcp_call,
    load_workflow,
    render_template,
)

_logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_API_BASE = os.environ.get("OPENROUTER_API_BASE", "https://openrouter.ai/api/v1")
ADAPTER_URL = os.environ.get("ADAPTER_URL", "http://adapter:8080").rstrip("/")
MCP_URL = f"{ADAPTER_URL}/mcp"

_DEFAULT_MODEL = "openrouter/qwen/qwen3.5-flash-02-23"


def _tool_label_from_mcp_description(description: str | None) -> str | None:
    """First line of MCP tool description (Python docstring convention) for DB logging."""
    if not description:
        return None
    line = description.strip().splitlines()[0].strip()
    return line or None


async def fetch_mcp_tool_labels() -> dict[str, str]:
    """Load short labels from MCP list_tools (first line of each tool description)."""
    async with streamablehttp_client(MCP_URL, timeout=10) as streams:
        recv, send, _ = streams
        async with ClientSession(recv, send) as session:
            await session.initialize()
            result = await session.list_tools()
    out: dict[str, str] = {}
    for t in result.tools:
        label = _tool_label_from_mcp_description(getattr(t, "description", None))
        if label:
            out[t.name] = label
    return out


def _resolve_openrouter_model(workflow: dict) -> str:
    m = workflow.get("model")
    if m and str(m).strip():
        return str(m).strip()
    return os.environ.get("OPENROUTER_MODEL", _DEFAULT_MODEL)


def _render_fallback_value(val: Any, state: dict) -> Any:
    if isinstance(val, str):
        return render_template(val, state)
    if isinstance(val, list):
        return [_render_fallback_value(item, state) for item in val]
    if isinstance(val, dict):
        return {k: _render_fallback_value(v, state) for k, v in val.items()}
    return val


def _render_fallback_state(fallback: dict[str, Any], state: dict) -> dict[str, Any]:
    return {k: _render_fallback_value(v, state) for k, v in fallback.items()}


def _make_instruction_fn(step: dict):
    def fn(ctx: Any) -> str:
        return render_template(step["instruction"], ctx.session.state)

    return fn


def _make_llm_agent(step: dict, mcp_url: str, *, include_tools: bool, model: str) -> LlmAgent:
    name = step.get("name", "llm")
    tool_filter = step.get("tool_filter") or []
    tools_list: list = []
    if include_tools and tool_filter:
        if os.environ.get("SWARM_HYBRID_DEBUG_MCP"):
            _logger.info(
                "hybrid llm_agent with McpToolset name=%s mcp_url=%s tool_filter=%s",
                name,
                mcp_url,
                tool_filter,
            )
        tools_list.append(
            McpToolset(
                connection_params=StreamableHTTPConnectionParams(url=mcp_url, timeout=30),
                tool_filter=tool_filter,
            )
        )
    return LlmAgent(
        name=name,
        description=step.get("description", ""),
        model=LiteLlm(model=model, api_key=OPENROUTER_API_KEY, api_base=OPENROUTER_API_BASE),
        instruction=_make_instruction_fn(step),
        tools=tools_list,
        output_key=step.get("output_key", "output"),
    )


def _build_llm_agents(workflow: dict, mcp_url: str, model: str) -> list[LlmAgent]:
    agents = []
    by_name: dict[str, dict] = {}
    for stage in workflow.get("stages", []):
        for step in stage.get("steps", []):
            if step.get("type") == "llm_agent":
                by_name[step.get("name", "llm")] = step
    for step in by_name.values():
        agents.append(_make_llm_agent(step, mcp_url, include_tools=False, model=model))
    return agents


def _primary_llm_agent_name(steps: list) -> str | None:
    for step in steps:
        if step.get("type") == "llm_agent":
            return step.get("name") or "llm"
    return None


class SwarmHybridAgent(BaseAgent):
    def __init__(
        self,
        workflow_path: str | Path,
        *,
        run_id: Any = None,
        insert_run_event: Any = None,
        tool_labels: dict | None = None,
    ):
        workflow = load_workflow(workflow_path)
        openrouter_model = _resolve_openrouter_model(workflow)
        sub_agents = _build_llm_agents(workflow, MCP_URL, openrouter_model)
        super().__init__(name="swarm_hybrid", description="YAML-driven hybrid workflow", sub_agents=sub_agents)
        self._workflow = workflow
        self._run_id = run_id
        self._insert_run_event = insert_run_event
        self._tool_labels = tool_labels or {}
        self._step_to_agent = {a.name: a for a in sub_agents}
        self._final_session_state: dict | None = None
        self._openrouter_model = openrouter_model

    async def _run_async_impl(self, ctx: Any) -> AsyncGenerator[Any, None]:
        workflow = self._workflow
        state = ctx.session.state
        self._final_session_state = state
        insert_run_event = self._insert_run_event
        run_id = self._run_id
        model = self._openrouter_model

        async def _emit(*args: Any, **kwargs: Any) -> None:
            if insert_run_event and run_id:
                await insert_run_event(*args, **kwargs)

        async with streamablehttp_client(MCP_URL, timeout=30) as streams:
            recv, send, _ = streams
            async with ClientSession(recv, send) as session:
                await session.initialize()
                list_result = await session.list_tools()
                auto_labels: dict[str, str] = {}
                for t in list_result.tools:
                    label = _tool_label_from_mcp_description(getattr(t, "description", None))
                    if label:
                        auto_labels[t.name] = label
                tool_labels = {**auto_labels, **self._tool_labels}

                for stage in workflow.get("stages", []):
                    skip_if = stage.get("skip_if")
                    if skip_if and eval_condition(skip_if, state):
                        continue
                    stage_name = stage.get("name") or ""
                    stage_type = stage.get("type") or "hybrid"
                    if stage.get("type") == "poll_loop":
                        await _emit(
                            run_id,
                            "workflow_stage_started",
                            f"Stage {stage_name} started",
                            {"stage": stage_name, "stage_type": "poll_loop"},
                        )
                        await self._run_poll_loop(stage, state, session, ctx, _emit, tool_labels)
                        await _emit(
                            run_id,
                            "workflow_stage_completed",
                            f"Stage {stage_name} completed",
                            {"stage": stage_name, "stage_type": "poll_loop"},
                        )
                        continue
                    stage_payload_base = {"stage": stage_name, "stage_type": stage_type}
                    if stage_name:
                        stage_payload_base["parent_agent"] = stage_name
                    await _emit(
                        run_id,
                        "workflow_stage_started",
                        f"Stage {stage_name} started",
                        dict(stage_payload_base),
                    )
                    if stage_type == "deterministic" and stage_name:
                        await _emit(
                            run_id,
                            "agent_started",
                            f"Starting {stage_name}",
                            {"agent": stage_name},
                        )
                    steps = stage.get("steps", [])
                    primary_llm = _primary_llm_agent_name(steps)
                    tool_parent = primary_llm or stage_name or None
                    for step in steps:
                        skip_if = step.get("skip_if")
                        if skip_if and eval_condition(skip_if, state):
                            continue
                        if step.get("type") == "mcp_call":
                            await execute_mcp_call(
                                step,
                                state,
                                session,
                                run_id=run_id,
                                insert_run_event=_emit,
                                tool_labels=tool_labels,
                                render=render_template,
                                parent_agent=tool_parent,
                            )
                        elif step.get("type") == "condition":
                            cond_info = execute_condition(step, state, eval_fn=eval_condition)
                            if cond_info and insert_run_event and run_id:
                                await _emit(
                                    run_id,
                                    "condition_evaluated",
                                    f"Condition: {cond_info.get('branch', '')}",
                                    {
                                        "step": cond_info.get("step", ""),
                                        "branch": cond_info.get("branch", ""),
                                        "set": cond_info.get("set", []),
                                    },
                                )
                        elif step.get("type") == "llm_agent":
                            tool_filter = step.get("tool_filter") or []
                            if tool_filter:
                                agent = _make_llm_agent(step, MCP_URL, include_tools=True, model=model)
                            else:
                                agent = self._step_to_agent.get(step.get("name"))
                            if agent:
                                await _emit(
                                    run_id,
                                    "agent_started",
                                    f"Starting {agent.name}",
                                    {"agent": agent.name},
                                )
                                final_text = None
                                async for event in agent.run_async(ctx):
                                    yield event
                                    if hasattr(event, "content") and event.content and getattr(
                                        event.content, "parts", None
                                    ):
                                        for p in event.content.parts:
                                            if getattr(p, "text", None):
                                                final_text = p.text
                                if final_text:
                                    parsed = _parse_llm_json(final_text)
                                    output_key = step.get("output_key", "")
                                    if parsed:
                                        if output_key:
                                            state[output_key] = parsed
                                    else:
                                        fallback = step.get("fallback_state") or {}
                                        if output_key and fallback:
                                            state[output_key] = _render_fallback_state(fallback, state)
                                        elif insert_run_event and run_id:
                                            await _emit(
                                                run_id,
                                                "llm_message",
                                                "Model responded (parse fallback)",
                                                {
                                                    "text": final_text,
                                                    "agent": agent.name,
                                                    "parent_agent": agent.name,
                                                },
                                            )
                                await _emit(
                                    run_id,
                                    "agent_completed",
                                    f"Completed {agent.name}",
                                    {"agent": agent.name},
                                )
                    if stage_type == "deterministic" and stage_name:
                        await _emit(
                            run_id,
                            "agent_completed",
                            f"Completed {stage_name}",
                            {"agent": stage_name},
                        )
                    await _emit(
                        run_id,
                        "workflow_stage_completed",
                        f"Stage {stage_name} completed",
                        dict(stage_payload_base),
                    )

    async def _run_poll_loop(
        self,
        stage: dict,
        state: dict,
        session: Any,
        ctx: Any,
        insert_run_event: Any,
        tool_labels: dict,
    ) -> None:
        poll_steps = stage.get("poll_steps", [])
        interval = stage.get("interval_seconds", 10)
        max_iter = stage.get("max_iterations", 3)
        exit_if = stage.get("exit_if", "")
        ladder = stage.get("escalation_ladder", [])
        tid = self._workflow.get("template_id", "")
        order_type = "esim_activation" if "esim" in tid else "number_porting"
        run_id = self._run_id
        stage_name = stage.get("name") or "follow_up"

        for i in range(1, max_iter + 1):
            if insert_run_event and run_id:
                await insert_run_event(
                    run_id,
                    "poll_iteration_started",
                    f"Poll iteration {i} ({stage_name})",
                    {"stage": stage_name, "iteration": i},
                )
            for ps in poll_steps:
                if ps.get("type") == "mcp_call":
                    await execute_mcp_call(
                        ps,
                        state,
                        session,
                        run_id=run_id,
                        insert_run_event=insert_run_event,
                        tool_labels=tool_labels,
                        render=render_template,
                        parent_agent=stage_name,
                        iteration=i,
                    )
            exit_met = bool(exit_if and eval_condition(exit_if, state))
            if exit_met:
                if insert_run_event and run_id:
                    await insert_run_event(
                        run_id,
                        "poll_iteration_completed",
                        f"Poll iteration {i} done ({stage_name})",
                        {"stage": stage_name, "iteration": i, "exit_condition_met": True},
                    )
                return
            for entry in ladder:
                if entry.get("iteration") == i:
                    level = entry.get("level", "L1")
                    label = entry.get("label", "Escalation")
                    decl_steps = entry.get("steps") or []
                    if decl_steps:
                        if insert_run_event and run_id:
                            await insert_run_event(
                                run_id,
                                "escalation_triggered",
                                f"Escalation {label} ({stage_name}, iter {i})",
                                {
                                    "stage": stage_name,
                                    "iteration": i,
                                    "level": level,
                                    "label": label,
                                },
                            )
                        for ps in decl_steps:
                            if ps.get("type") == "mcp_call":
                                await execute_mcp_call(
                                    ps,
                                    state,
                                    session,
                                    run_id=run_id,
                                    insert_run_event=insert_run_event,
                                    tool_labels=tool_labels,
                                    render=render_template,
                                    parent_agent=stage_name,
                                    iteration=i,
                                    escalation_label=label,
                                )
                    else:
                        classify_result = state.get("classify_result") or {}
                        if isinstance(classify_result, dict):
                            priority = classify_result.get("priority", "P1")
                            root_cause_detail = classify_result.get("root_cause_detail", "")
                        else:
                            priority = "P1"
                            root_cause_detail = ""
                        if insert_run_event and run_id:
                            await insert_run_event(
                                run_id,
                                "escalation_triggered",
                                f"Escalation {label} ({stage_name}, iter {i})",
                                {
                                    "stage": stage_name,
                                    "iteration": i,
                                    "level": level,
                                    "label": label,
                                },
                            )
                        await execute_mcp_call(
                            {
                                "tool": "runbook_registry__get_escalation_contact",
                                "input": {
                                    "priority": priority,
                                    "level": level,
                                    "order_type": order_type,
                                },
                                "output_key": "escalation_contact",
                            },
                            state,
                            session,
                            run_id=run_id,
                            insert_run_event=insert_run_event,
                            tool_labels=tool_labels,
                            render=render_template,
                            parent_agent=stage_name,
                            iteration=i,
                            escalation_label=label,
                        )
                        esc = state.get("escalation_contact", {})
                        await execute_mcp_call(
                            {
                                "tool": "notification__send_alert",
                                "input": {
                                    "to": esc.get("contact", "ops@carrier.com"),
                                    "subject": f"[{label}] Order {state.get('order_id', '')}",
                                    "body": (
                                        f"Order {state.get('order_id')}, root cause: {root_cause_detail}. {label}."
                                    ),
                                },
                                "output_key": "alert_sent",
                            },
                            state,
                            session,
                            run_id=run_id,
                            insert_run_event=insert_run_event,
                            tool_labels=tool_labels,
                            render=render_template,
                            parent_agent=stage_name,
                            iteration=i,
                            escalation_label=label,
                        )
                    break
            if insert_run_event and run_id:
                await insert_run_event(
                    run_id,
                    "poll_iteration_completed",
                    f"Poll iteration {i} done ({stage_name})",
                    {"stage": stage_name, "iteration": i, "exit_condition_met": False},
                )
            if i < max_iter:
                await asyncio.sleep(interval)


def build_root_agent(
    workflow_path: str | Path,
    *,
    run_id: Any = None,
    insert_run_event: Any = None,
    tool_labels: dict | None = None,
) -> SwarmHybridAgent:
    return SwarmHybridAgent(
        workflow_path,
        run_id=run_id,
        insert_run_event=insert_run_event,
        tool_labels=tool_labels,
    )
