export interface StepDefinition {
  id: string
  name: string
  type: 'subagent' | 'deterministic' | 'parallel'
  depends_on: string[]
  task?: string
  adapter?: string
  action?: string
  input: Record<string, unknown>
  output_schema: Record<string, string>
  parallel: Array<Record<string, unknown>>
}

export interface WorkflowDefinition {
  version: string
  steps: StepDefinition[]
}

export interface TemplateSummary {
  id: string
  name: string
  version: number
  config?: Record<string, unknown> | null
  workflow_yaml?: string | null
  created_at: string
  updated_at: string
}

export interface TemplateDetail {
  id: string
  name: string
  version: number
  config?: Record<string, unknown> | null
  workflow_yaml?: string | null
  definition?: WorkflowDefinition
  created_at: string
  updated_at: string
}

export interface CreateTemplateRequest {
  name: string
  definition: WorkflowDefinition
}

export interface UpdateTemplateWorkflowRequest {
  workflow_yaml: string
}

export interface TemplateResponse {
  id: string
  name: string
  version: number
  created_at: string
}

export interface ValidationError {
  field: string
  message: string
}

export interface ValidateTemplateResponse {
  valid: boolean
  errors: ValidationError[]
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
