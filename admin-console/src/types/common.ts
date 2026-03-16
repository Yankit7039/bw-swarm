export interface ApiError {
  error: string
  message: string
  details?: Array<{ field: string; message: string }>
}

export interface Run {
  run_id: string
  template_id: string
  status: string
  payload: Record<string, unknown>
  result?: Record<string, unknown> | null
  error_message?: string | null
  created_at?: string | null
  updated_at?: string | null
  completed_at?: string | null
}
