"""Postgres tool registry: DDL and upsert for MCP adapter tools (owned by adapter service)."""

from __future__ import annotations

import inspect
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Callable
from urllib.parse import quote

from app.adapters._mcp_register import get_registered_tools

logger = logging.getLogger(__name__)

_WEAK_DOC_MIN_LEN = 40

_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS adapter_tool_registry (
    adapter_name TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    mcp_tool_name TEXT NOT NULL,
    description TEXT,
    input_schema JSONB NOT NULL,
    docstring_warnings JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    PRIMARY KEY (adapter_name, tool_name),
    CONSTRAINT uq_adapter_tool_registry_mcp UNIQUE (mcp_tool_name)
);
"""

_UPSERT_SQL = """
INSERT INTO adapter_tool_registry (
    adapter_name, tool_name, mcp_tool_name, description, input_schema, docstring_warnings, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (adapter_name, tool_name) DO UPDATE SET
    mcp_tool_name = EXCLUDED.mcp_tool_name,
    description = EXCLUDED.description,
    input_schema = EXCLUDED.input_schema,
    docstring_warnings = EXCLUDED.docstring_warnings,
    updated_at = EXCLUDED.updated_at;
"""


def _asyncpg_dsn() -> str | None:
    """Return a Postgres URI string safe for ``asyncpg.connect(dsn=...)``.

    Percent-encodes the password so ``#``, ``:``, ``@``, etc. do not break URL parsing (Pydantic
    and naive parsers treat ``#`` as a fragment). Matches the spirit of SQLAlchemy's URL handling.
    """
    raw = (os.environ.get("DATABASE_URL") or "").strip()
    if not raw:
        return None
    for prefix, replacement in [
        ("postgresql+asyncpg://", "postgresql://"),
        ("postgres+asyncpg://", "postgresql://"),
        ("postgres://", "postgresql://"),
    ]:
        if raw.startswith(prefix):
            raw = replacement + raw[len(prefix) :]
            break
    try:
        scheme, rest = raw.split("://", 1)
        at_idx = rest.rfind("@")
        if at_idx == -1:
            return raw
        userinfo, hostpart = rest[:at_idx], rest[at_idx + 1 :]
        colon_idx = userinfo.find(":")
        if colon_idx == -1:
            return raw
        user, password = userinfo[:colon_idx], userinfo[colon_idx + 1 :]
        return f"{scheme}://{user}:{quote(password, safe='')}@{hostpart}"
    except Exception as e:
        logger.error("tool registry: invalid or unparsable DATABASE_URL: %s", e)
        return None


def _format_annotation(tp: Any) -> str:
    if tp is inspect.Parameter.empty:
        return ""
    try:
        return inspect.formatannotation(tp)
    except Exception:
        return str(tp)


def _default_repr(default: Any) -> Any:
    if default is inspect.Parameter.empty:
        return None
    if isinstance(default, (str, int, float, bool, type(None))):
        return default
    try:
        json.dumps(default)
        return default
    except (TypeError, ValueError):
        return repr(default)


def _parameter_kind_name(kind: inspect._ParameterKind) -> str:
    names = {
        inspect.Parameter.POSITIONAL_ONLY: "POSITIONAL_ONLY",
        inspect.Parameter.POSITIONAL_OR_KEYWORD: "POSITIONAL_OR_KEYWORD",
        inspect.Parameter.VAR_POSITIONAL: "VAR_POSITIONAL",
        inspect.Parameter.KEYWORD_ONLY: "KEYWORD_ONLY",
        inspect.Parameter.VAR_KEYWORD: "VAR_KEYWORD",
    }
    return names.get(kind, str(kind))


def build_input_schema(fn: Callable[..., Any]) -> dict[str, Any]:
    """Structured parameter metadata derived from the tool function signature."""
    sig = inspect.signature(fn)
    try:
        hints = inspect.get_type_hints(fn, include_extras=True)
    except Exception:
        hints = {}
    parameters: list[dict[str, Any]] = []
    for pname, param in sig.parameters.items():
        entry: dict[str, Any] = {
            "name": pname,
            "kind": _parameter_kind_name(param.kind),
            "required": param.default is inspect.Parameter.empty
            and param.kind
            not in (inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD),
        }
        if param.default is not inspect.Parameter.empty:
            entry["default"] = _default_repr(param.default)
        th = hints.get(pname, param.annotation)
        if th is not inspect.Parameter.empty and th is not None:
            entry["type_hint"] = _format_annotation(th)
        parameters.append(entry)
    return {"parameters": parameters}


def _docstring_and_warnings(fn: Callable[..., Any]) -> tuple[str | None, dict[str, bool] | None]:
    raw = inspect.getdoc(fn)
    text = (raw or "").strip()
    warnings: dict[str, bool] = {}
    if not text:
        warnings["missing"] = True
        return None, warnings if warnings else None
    if len(text) < _WEAK_DOC_MIN_LEN:
        warnings["weak"] = True
    return text, warnings if warnings else None


def _parse_mcp_name(mcp_tool_name: str) -> tuple[str, str] | None:
    if "__" not in mcp_tool_name:
        logger.warning("tool registry: MCP name has no '__' separator, skipping: %s", mcp_tool_name)
        return None
    adapter_name, tool_name = mcp_tool_name.split("__", 1)
    if not adapter_name or not tool_name:
        logger.warning("tool registry: empty adapter or tool segment, skipping: %s", mcp_tool_name)
        return None
    return adapter_name, tool_name


async def ensure_schema_and_upsert_tools() -> None:
    """Create registry table if needed and upsert all tools from get_registered_tools()."""
    dsn = _asyncpg_dsn()
    if not dsn:
        logger.info("tool registry: DATABASE_URL not set, skipping DB registration")
        return

    import asyncpg  # type: ignore[import-untyped]

    tools = get_registered_tools()
    if not tools:
        logger.warning("tool registry: no registered tools to upsert")
        return

    now = datetime.now(timezone.utc)
    try:
        conn = await asyncpg.connect(dsn)
    except Exception as e:
        logger.error("tool registry: could not connect to database: %s", e)
        return

    try:
        await conn.execute(_CREATE_TABLE_SQL)
        logger.info("tool registry: schema ready")
        upserted = 0
        for mcp_tool_name, fn in tools:
            parsed = _parse_mcp_name(mcp_tool_name)
            if parsed is None:
                continue
            adapter_name, tool_name = parsed
            description, doc_warnings = _docstring_and_warnings(fn)
            input_schema = build_input_schema(fn)
            await conn.execute(
                _UPSERT_SQL,
                adapter_name,
                tool_name,
                mcp_tool_name,
                description,
                json.dumps(input_schema),
                json.dumps(doc_warnings) if doc_warnings is not None else None,
                now,
            )
            upserted += 1
        logger.info("tool registry: upserted %d tools", upserted)
    except Exception as e:
        logger.error("tool registry: upsert failed: %s", e)
    finally:
        await conn.close()
