"""Pydantic schema for workflow YAML — validated at pod startup (fail fast)."""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# --- Steps ---


class McpCallStep(BaseModel):
    model_config = ConfigDict(extra="allow")

    type: Literal["mcp_call"]
    name: str | None = None
    tool: str
    input: dict[str, Any] = Field(default_factory=dict)
    output_key: str = ""
    skip_if: str | None = None
    input_bindings: dict[str, str] | None = None
    event_parent_agent: str | None = None


class LlmAgentStep(BaseModel):
    model_config = ConfigDict(extra="allow")

    type: Literal["llm_agent"]
    name: str | None = None
    description: str = ""
    instruction: str
    output_key: str = ""
    tool_filter: list[str] | None = None
    fallback_state: dict[str, Any] | None = None
    input_keys: list[str] | None = None
    skip_if: str | None = None


class ConditionBranch(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    if_: str | None = Field(None, validation_alias="if", serialization_alias="if")
    else_: bool | None = Field(None, validation_alias="else", serialization_alias="else")
    set: dict[str, Any] = Field(default_factory=dict)


class ConditionStep(BaseModel):
    model_config = ConfigDict(extra="allow")

    type: Literal["condition"]
    name: str | None = None
    branches: list[ConditionBranch] = Field(default_factory=list)
    skip_if: str | None = None


class EscalationLadderEntry(BaseModel):
    """Poll-loop escalation. When ``steps`` is set, run those MCP calls; otherwise legacy hardcoded path is used."""

    model_config = ConfigDict(extra="allow")

    iteration: int
    level: str = "L1"
    label: str = "Escalation"
    steps: list[McpCallStep] | None = None


class PollLoopStage(BaseModel):
    model_config = ConfigDict(extra="allow")

    type: Literal["poll_loop"]
    name: str | None = None
    skip_if: str | None = None
    interval_seconds: int = 10
    max_iterations: int = 3
    exit_if: str = ""
    poll_steps: list[McpCallStep] = Field(default_factory=list)
    escalation_ladder: list[EscalationLadderEntry] = Field(default_factory=list)


class StandardStage(BaseModel):
    """deterministic | hybrid — stages with a ``steps`` list."""

    model_config = ConfigDict(extra="allow")

    type: Literal["deterministic", "hybrid"] = "hybrid"
    name: str | None = None
    skip_if: str | None = None
    steps: list[dict[str, Any]] = Field(default_factory=list)


class WorkflowInput(BaseModel):
    model_config = ConfigDict(extra="allow")

    required: list[str] = Field(default_factory=list)


class FollowUpConfig(BaseModel):
    """Intra-pod only: used by workflow_runner after a run. Runtime poller does not read YAML."""

    model_config = ConfigDict(extra="allow")

    mode: Literal["none", "agentmail"] = "none"
    limit: int = 3
    interval_seconds: int = 120
    email_result_key: str = "email_result"


class WorkflowSchema(BaseModel):
    """Top-level workflow document."""

    model_config = ConfigDict(extra="allow")

    template_id: str
    version: str = "1.0"
    description: str = ""
    model: str | None = None
    input: WorkflowInput = Field(default_factory=WorkflowInput)
    adapters: list[str] = Field(default_factory=list)
    tool_labels: dict[str, str] = Field(default_factory=dict)
    result_keys: list[str] = Field(default_factory=list)
    follow_up: FollowUpConfig | None = Field(default_factory=lambda: FollowUpConfig(mode="none"))
    escalation_matrix: dict[str, Any] | None = None
    stages: list[dict[str, Any]]

    @field_validator("stages")
    @classmethod
    def _stages_non_empty(cls, v: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not v:
            raise ValueError("Workflow must have at least one stage")
        return v

    @model_validator(mode="after")
    def _validate_stages(self) -> WorkflowSchema:
        for i, st in enumerate(self.stages):
            if not isinstance(st, dict):
                raise ValueError(f"stages[{i}] must be a mapping")
            t = st.get("type") or "hybrid"
            if t == "poll_loop":
                PollLoopStage.model_validate(st)
            elif t in ("deterministic", "hybrid"):
                StandardStage.model_validate(st)
            else:
                raise ValueError(f"Unknown stage type: {t!r}")
            for j, step in enumerate(st.get("steps") or []):
                if not isinstance(step, dict):
                    raise ValueError(f"stages[{i}].steps[{j}] must be a mapping")
                stype = step.get("type")
                if stype == "mcp_call":
                    McpCallStep.model_validate(step)
                elif stype == "llm_agent":
                    LlmAgentStep.model_validate(step)
                elif stype == "condition":
                    ConditionStep.model_validate(step)
                else:
                    raise ValueError(f"Unknown step type: {stype!r}")
        return self


def load_and_validate_workflow_yaml(path: str) -> WorkflowSchema:
    """Load YAML from file and validate."""
    from pathlib import Path

    import yaml

    with open(Path(path), encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError("Workflow root must be a mapping")
    return WorkflowSchema.model_validate(data)
