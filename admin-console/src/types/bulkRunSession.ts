export interface BulkRunConfig {
  batch_size: number
  order_prefix: string
  start_order_id: number
  interval_ms: number
}

export interface BulkRunStats {
  total: number
  success: number
  failed: number
  pending: number
}

export interface BulkRunItem {
  order_id: string
  run_id?: string
  status: 'pending' | 'success' | 'failed'
  triggered_at?: string
  completed_at?: string
  error?: string
}

export interface BulkRunSession {
  session_id: string
  template_id: string
  name?: string
  status: 'running' | 'completed' | 'failed'
  config: BulkRunConfig
  runs: BulkRunItem[]
  stats: BulkRunStats
  created_at?: string
  updated_at?: string
  completed_at?: string
}

export interface CreateBulkRunSessionRequest {
  template_id: string
  name?: string
  config: BulkRunConfig
}

export interface UpdateBulkRunSessionRunsRequest {
  runs: BulkRunItem[]
  stats: BulkRunStats
}

export interface CompleteBulkRunSessionRequest {
  status: 'completed' | 'failed'
  stats: BulkRunStats
}
