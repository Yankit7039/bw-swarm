export interface EventSummary {
  id: string
  agent_run_id: string
  event_type: string
  level: string
  payload: Record<string, unknown>
  created_at: string
}

export interface MetricsSnapshot {
  snapshot_at: string
  agents: {
    running: number
    paused: number
    completed_last_hour: number
    failed_last_hour: number
  }
  queue: {
    pending_triggers: number
    depth: number
  }
  throughput: {
    events_per_minute: number
    steps_completed_per_minute: number
  }
  error_rate: {
    last_hour_percent: number
  }
  adapters: {
    total_calls_last_hour: number
    total_errors_last_hour: number
  }
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
