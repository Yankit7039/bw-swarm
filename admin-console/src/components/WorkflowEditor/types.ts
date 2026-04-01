/**
 * Workflow document types aligned with swarm_core.schema.WorkflowSchema
 */

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export interface WorkflowInput {
  required: string[]
}

export interface FollowUpConfig {
  mode: 'none' | 'agentmail'
  limit: number
  interval_seconds: number
  email_result_key?: string
}

export interface McpCallStep {
  type: 'mcp_call'
  name?: string | null
  tool: string
  input: Record<string, unknown>
  output_key?: string
  skip_if?: string | null
  input_bindings?: Record<string, string> | null
  event_parent_agent?: string | null
}

export interface LlmAgentStep {
  type: 'llm_agent'
  name?: string | null
  description?: string
  instruction: string
  output_key?: string
  tool_filter?: string[] | null
  fallback_state?: Record<string, unknown> | null
  input_keys?: string[] | null
  skip_if?: string | null
}

export interface ConditionBranch {
  if?: string | null
  else?: boolean | null
  set: Record<string, unknown>
}

export interface ConditionStep {
  type: 'condition'
  name?: string | null
  branches: ConditionBranch[]
  skip_if?: string | null
}

export type Step = McpCallStep | LlmAgentStep | ConditionStep

export interface StandardStage {
  type: 'deterministic' | 'hybrid'
  name?: string | null
  skip_if?: string | null
  steps: Step[]
}

export interface EscalationLadderEntry {
  iteration: number
  level?: string
  label?: string
  steps?: McpCallStep[] | null
}

export interface PollLoopStage {
  type: 'poll_loop'
  name?: string | null
  skip_if?: string | null
  interval_seconds: number
  max_iterations: number
  exit_if: string
  poll_steps: McpCallStep[]
  escalation_ladder: EscalationLadderEntry[]
}

export type Stage = StandardStage | PollLoopStage

export interface WorkflowDoc {
  template_id: string
  version: string
  description: string
  model: string | null
  input: WorkflowInput
  adapters: string[]
  tool_labels: Record<string, string>
  result_keys: string[]
  follow_up: FollowUpConfig | null
  escalation_matrix: Record<string, unknown> | null
  stages: Stage[]
}

export function isPollLoopStage(s: Stage): s is PollLoopStage {
  return s.type === 'poll_loop'
}

export function isStandardStage(s: Stage): s is StandardStage {
  return s.type === 'deterministic' || s.type === 'hybrid'
}

export function isMcpCallStep(step: Step): step is McpCallStep {
  return step.type === 'mcp_call'
}

export function isLlmAgentStep(step: Step): step is LlmAgentStep {
  return step.type === 'llm_agent'
}

export function isConditionStep(step: Step): step is ConditionStep {
  return step.type === 'condition'
}
