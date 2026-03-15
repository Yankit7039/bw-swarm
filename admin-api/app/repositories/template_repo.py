from __future__ import annotations

import asyncpg
import json
from datetime import datetime
from typing import Any
from uuid import UUID

from app.domain.template import Template
from app.core.exceptions import AppError


class TemplateRepo:
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool

    async def get_by_id(self, template_id: UUID) -> Template:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM templates WHERE id = $1", template_id
            )
        if row is None:
            raise AppError("not_found", f"Template {template_id} not found", 404)
        return Template(**dict(row))

    async def get_by_name(self, name: str) -> Template | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM templates WHERE name = $1", name
            )
        if row is None:
            return None
        return Template(**dict(row))

    async def list(self, limit: int = 20, offset: int = 0) -> tuple[list[Template], int]:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM templates ORDER BY created_at DESC LIMIT $1 OFFSET $2",
                limit, offset
            )
            count_row = await conn.fetchrow("SELECT COUNT(*) as total FROM templates")

        templates = [Template(**dict(row)) for row in rows]
        return templates, count_row["total"]

    async def create(self, name: str, definition: dict[str, Any]) -> Template:
        async with self.pool.acquire() as conn:
            try:
                # Convert dict to JSON string for asyncpg JSONB column
                definition_json = json.dumps(definition)
                row = await conn.fetchrow(
                    """
                    INSERT INTO templates (name, definition, version)
                    VALUES ($1, $2::jsonb, 1)
                    RETURNING *
                    """,
                    name, definition_json
                )
            except asyncpg.UniqueViolationError:
                raise AppError("conflict", f"Template with name '{name}' already exists", 409)

        return Template(**dict(row))

    async def update_version(self, template_id: UUID, definition: dict[str, Any]) -> Template:
        async with self.pool.acquire() as conn:
            definition_json = json.dumps(definition)
            row = await conn.fetchrow(
                """
                UPDATE templates
                SET definition = $2::jsonb, version = version + 1, updated_at = NOW()
                WHERE id = $1
                RETURNING *
                """,
                template_id, definition_json
            )
        if row is None:
            raise AppError("not_found", f"Template {template_id} not found", 404)
        return Template(**dict(row))
