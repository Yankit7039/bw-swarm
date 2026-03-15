from __future__ import annotations

from typing import Any
from uuid import UUID

from app.repositories.template_repo import TemplateRepo
from app.schemas.template import ValidationError
from app.core.exceptions import AppError


class TemplateService:
    def __init__(self, repo: TemplateRepo):
        self.repo = repo

    def validate_template(self, definition: dict[str, Any]) -> List[ValidationError]:
        errors = []

        if "steps" not in definition or not isinstance(definition["steps"], list):
            errors.append(ValidationError(field="steps", message="Steps must be a list"))
            return errors

        steps = definition["steps"]
        step_ids = set()
        depends_on_map: dict[str, list[str]] = {}

        for i, step in enumerate(steps):
            # Check unique IDs
            step_id = step.get("id")
            if not step_id:
                errors.append(ValidationError(field=f"steps[{i}].id", message="Step ID is required"))
                continue

            if step_id in step_ids:
                errors.append(ValidationError(field=f"steps[{i}].id", message=f"Duplicate step ID: {step_id}"))
            else:
                step_ids.add(step_id)

            # Store depends_on for circular check
            depends_on = step.get("depends_on", [])
            if depends_on:
                depends_on_map[step_id] = depends_on

                # Validate depends_on references exist
                for dep in depends_on:
                    if dep not in step_ids and dep not in [s.get("id") for s in steps]:
                        errors.append(ValidationError(
                            field=f"steps[{i}].depends_on",
                            message=f"References unknown step ID: {dep}"
                        ))

            # Validate parallel steps
            step_type = step.get("type")
            if step_type == "parallel":
                parallel = step.get("parallel", [])
                if not parallel:
                    errors.append(ValidationError(
                        field=f"steps[{i}].parallel",
                        message="Parallel steps must have at least one child"
                    ))

        # Check for circular dependencies using DFS
        def has_cycle(node: str, visited: set[str], rec_stack: set[str]) -> bool:
            visited.add(node)
            rec_stack.add(node)

            for neighbor in depends_on_map.get(node, []):
                if neighbor not in visited:
                    if has_cycle(neighbor, visited, rec_stack):
                        return True
                elif neighbor in rec_stack:
                    return True

            rec_stack.remove(node)
            return False

        visited: set[str] = set()
        for step_id in step_ids:
            if step_id not in visited:
                if has_cycle(step_id, visited, set()):
                    errors.append(ValidationError(
                        field="steps",
                        message=f"Circular dependency detected involving step: {step_id}"
                    ))
                    break

        return errors

    async def create_template(self, name: str, definition: dict[str, Any]) -> dict:
        errors = self.validate_template(definition)
        if errors:
            raise AppError(
                "validation_failed",
                "Workflow definition has errors",
                400,
                details=[e.model_dump() for e in errors]
            )

        template = await self.repo.create(name, definition)
        return {
            "id": template.id,
            "name": template.name,
            "version": template.version,
            "created_at": template.created_at.isoformat(),
        }

    async def validate_existing(self, template_id: UUID, definition: dict[str, Any]) -> dict:
        # Just validate, don't save
        errors = self.validate_template(definition)
        return {
            "valid": len(errors) == 0,
            "errors": [e.model_dump() for e in errors]
        }

    async def list_templates(self, limit: int = 20, offset: int = 0) -> dict:
        templates, total = await self.repo.list(limit, offset)
        return {
            "data": [
                {
                    "id": t.id,
                    "name": t.name,
                    "version": t.version,
                    "created_at": t.created_at.isoformat(),
                    "updated_at": t.updated_at.isoformat(),
                }
                for t in templates
            ],
            "pagination": {
                "total": total,
                "limit": limit,
                "offset": offset,
            }
        }

    async def get_template(self, template_id: UUID) -> dict:
        template = await self.repo.get_by_id(template_id)
        return {
            "id": template.id,
            "name": template.name,
            "version": template.version,
            "definition": template.definition,
            "created_at": template.created_at.isoformat(),
            "updated_at": template.updated_at.isoformat(),
        }
