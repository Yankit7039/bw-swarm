export interface OrderCard {
  orderId: string
  status: 'evaluating' | 'critical' | 'completed' | 'pending'
  statusText: string
  progress: number
  runId?: string
  /** From API when a run is matched */
  templateId?: string
  apiStatus?: string
  createdAt?: string | null
  updatedAt?: string | null
  completedAt?: string | null
  errorMessage?: string | null
}

export interface SubTask {
  id: string
  name: string
  status: 'pending' | 'running' | 'done' | 'blocked'
  description?: string
}

export interface SwarmCluster {
  id: string
  name: string
  icon: 'diagnosis' | 'healing' | 'alerting' | 'followup'
  status: 'actively_processing' | 'system_ready'
  subTasks: SubTask[]
}

export interface OrchestratorState {
  isActive: boolean
  currentAction: string
  targetClusterId?: string
}

export interface ExecutionMeshState {
  orders: OrderCard[]
  orchestrator: OrchestratorState
  clusters: SwarmCluster[]
  activeConnections: string[] // cluster IDs currently connected to orchestrator
}

export interface ExecutionMeshStats {
  total: number
  completed: number
  failed: number
  running: number
  pending: number
  progress: number
}

export interface ExecutionMeshParams {
  templateId: string
  prefix: string
  start: number
  count: number
  intervalMs: number
}
