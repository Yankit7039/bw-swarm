export interface StepSummary {
  id: string
  step_id: string
  step_name: string
  step_type: string
  status: string
  duration_ms?: number
}

export interface StepDetail extends StepSummary {
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  started_at?: string
  completed_at?: string
}

export interface AgentSummary {
  id: string
  template_id: string
  template_name: string
  status: string
  current_step?: string
  triggered_by: string
  started_at: string
  duration_ms?: number
}

export interface AgentDetail {
  id: string
  template_id: string
  template_name: string
  status: string
  triggered_by: string
  trigger_payload?: Record<string, unknown>
  started_at: string
  completed_at?: string
  duration_ms?: number
  steps: StepDetail[]
}

export interface CreateAgentRequest {
  template_id: string
  trigger_payload?: Record<string, unknown>
}

export interface AgentResponse {
  id: string
  template_id: string
  status: string
  started_at: string
}

export interface AgentStateResponse {
  id: string
  status: string
  paused_at?: string
  resumed_at?: string
  cancelled_at?: string
}

export interface StepListResponse {
  agent_run_id: string
  steps: StepDetail[]
}

export interface Pagination {
  total: number
  limit: number
  offset: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: Pagination
}
