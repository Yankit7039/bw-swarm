"""YAML workflow interpreter for hybrid templates."""

from __future__ import annotations

import ast
import json
import re
from pathlib import Path
from typing import Any, Callable

import yaml


def load_workflow(path: str | Path) -> dict:
    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if "stages" not in data:
        raise ValueError("Workflow must have 'stages'")
    return data


def render_template(text: str, state: dict) -> str:
    """Replace {{ key }} or {{ key['sub'] }} with state values."""
    def repl(m: re.Match) -> str:
        expr = m.group(1).strip()
        try:
            if "." in expr and "[" not in expr:
                parts = expr.split(".")
                obj = state
                for p in parts:
                    obj = obj.get(p)
                return str(obj) if obj is not None else ""
            if "[" in expr or "'" in expr or '"' in expr:
                tree = ast.parse(expr, mode="eval")
                return str(_eval_node(tree.body, state))
            return str(state.get(expr, ""))
        except Exception:
            return m.group(0)
    return re.sub(r"\{\{\s*([^}]+)\s*\}\}", repl, text)


def _eval_node(node: ast.AST, state: dict) -> Any:
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Name):
        return state.get(node.id)
    if isinstance(node, ast.Subscript):
        val = _eval_node(node.value, state)
        if isinstance(node.slice, ast.Constant):
            return val.get(node.slice.value) if isinstance(val, dict) else None
        if hasattr(node.slice, "value") and isinstance(node.slice.value, ast.Constant):
            return val.get(node.slice.value.value) if isinstance(val, dict) else None
    if isinstance(node, ast.Attribute):
        val = _eval_node(node.value, state)
        return getattr(val, node.attr, None) if val is not None else None
    raise ValueError(f"Cannot eval {node}")


def eval_condition(expr: str, state: dict) -> bool:
    """Safe eval of Python expression against state."""
    expr = (expr or "").strip()
    if expr in ("True", "true", "1"):
        return True
    if expr in ("False", "false", "0"):
        return False
    try:
        tree = ast.parse(expr, mode="eval")
        return bool(_eval_condition_node(tree.body, state))
    except Exception:
        return False


def _coerce_bool_pair_for_compare(a: Any, b: Any) -> tuple[Any, Any]:
    """Align bool with YAML/string bool so skip_if like resolved == True works when state has 'True'."""
    if isinstance(a, bool) and isinstance(b, str):
        s = b.strip().lower()
        if s in ("true", "1", "yes"):
            return a, True
        if s in ("false", "0", "no"):
            return a, False
    if isinstance(b, bool) and isinstance(a, str):
        s = a.strip().lower()
        if s in ("true", "1", "yes"):
            return True, b
        if s in ("false", "0", "no"):
            return False, b
    return a, b


def _eval_condition_node(node: ast.AST, state: dict) -> Any:
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Name):
        return state.get(node.id)
    if isinstance(node, ast.Compare):
        left = _eval_condition_node(node.left, state)
        for op, right in zip(node.ops, node.comparators):
            right_val = _eval_condition_node(right, state)
            lcmp, rcmp = _coerce_bool_pair_for_compare(left, right_val)
            if isinstance(op, ast.Eq):
                if lcmp != rcmp:
                    return False
            elif isinstance(op, ast.NotEq):
                if lcmp == rcmp:
                    return False
            else:
                raise ValueError(f"Unsupported operator {op}")
            left = right_val
        return True
    if isinstance(node, ast.Subscript):
        val = _eval_condition_node(node.value, state)
        if isinstance(node.slice, ast.Constant):
            return val.get(node.slice.value) if isinstance(val, dict) else None
        if hasattr(node.slice, "value") and isinstance(node.slice.value, ast.Constant):
            return val.get(node.slice.value.value) if isinstance(val, dict) else None
    if isinstance(node, ast.Attribute):
        val = _eval_condition_node(node.value, state)
        return getattr(val, node.attr, None) if val is not None else None
    if isinstance(node, ast.BoolOp):
        vals = [_eval_condition_node(v, state) for v in node.values]
        if isinstance(node.op, ast.And):
            return all(vals)
        if isinstance(node.op, ast.Or):
            return any(vals)
    raise ValueError(f"Cannot eval {node}")


def normalize_mcp_result(result: Any) -> dict:
    """Extract adapter data dict from MCP CallToolResult or adapter response."""
    if hasattr(result, "structuredContent") and result.structuredContent:
        d = result.structuredContent
        return d.get("data", d) if isinstance(d, dict) and "data" in d else (d if isinstance(d, dict) else {"raw": str(d)})
    if hasattr(result, "content") and result.content:
        for part in result.content:
            text = getattr(part, "text", None)
            if text:
                try:
                    data = json.loads(text)
                    if isinstance(data, dict) and "data" in data:
                        return data["data"]
                    return data if isinstance(data, dict) else {"raw": str(data)}
                except json.JSONDecodeError:
                    return {"raw": text}
    if isinstance(result, dict):
        if "data" in result:
            return result["data"]
        return result
    return {"raw": str(result)}


def _mcp_tool_event_payload(
    tool: str,
    label: str,
    *,
    parent_agent: str | None,
    iteration: int | None = None,
    escalation_label: str | None = None,
) -> dict:
    payload: dict = {"tool": tool, "label": label}
    if parent_agent:
        payload["parent_agent"] = parent_agent
    if iteration is not None:
        payload["iteration"] = iteration
    if escalation_label:
        payload["escalation_label"] = escalation_label
    return payload


async def execute_mcp_call(
    step: dict,
    state: dict,
    session: Any,
    *,
    run_id: Any,
    insert_run_event: Callable,
    tool_labels: dict,
    render: Callable[[str, dict], str],
    parent_agent: str | None = None,
    iteration: int | None = None,
    escalation_label: str | None = None,
) -> None:
    tool = step.get("tool", "")
    inp = step.get("input") or {}
    output_key = step.get("output_key", "")
    skip_if = step.get("skip_if")
    if skip_if and eval_condition(skip_if, state):
        return
    arguments = {k: render(str(v), state) if isinstance(v, str) else v for k, v in inp.items()}
    if isinstance(arguments.get("use_resolution_buckets"), str):
        arguments["use_resolution_buckets"] = arguments["use_resolution_buckets"].lower() in ("true", "1")
    label = tool_labels.get(tool, f"Calling {tool}")
    pa = step.get("event_parent_agent") or parent_agent
    payload = _mcp_tool_event_payload(
        tool, label, parent_agent=pa, iteration=iteration, escalation_label=escalation_label
    )
    await insert_run_event(run_id, "tool_started", label, payload)
    try:
        raw = await session.call_tool(tool, arguments)
        data = normalize_mcp_result(raw)
        state[output_key] = data
    finally:
        await insert_run_event(run_id, "tool_completed", f"Completed {label}", dict(payload))


def execute_condition(step: dict, state: dict, *, eval_fn: Callable[[str, dict], bool]) -> None:
    """Evaluate branches: first matching if wins; if 'True' / 'else' is else fallback."""
    branches = step.get("branches") or []
    for branch in branches:
        if_expr = branch.get("if")
        is_else = "else" in branch or (if_expr and str(if_expr).strip() in ("True", "true", "1"))
        if is_else or (if_expr and eval_fn(if_expr, state)):
            for k, v in (branch.get("set") or {}).items():
                state[k] = v
            return


def _strip_json_fences(text: str) -> str:
    if not text:
        return ""
    text = text.strip()
    for start, end in [("```json", "```"), ("```", "```")]:
        if text.startswith(start):
            text = text[len(start):].strip()
        if text.endswith(end):
            text = text[:-len(end)].strip()
    return text


def _parse_llm_json(text: str) -> dict | None:
    try:
        return json.loads(_strip_json_fences(text))
    except json.JSONDecodeError:
        return None
