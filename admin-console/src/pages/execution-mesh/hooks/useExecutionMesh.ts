import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { runsApi } from '../../../api/runs'
import type { Run } from '../../../types/common'
import type {
  OrderCard,
  SwarmCluster,
  ExecutionMeshState,
  OrchestratorState,
} from '../../../types/executionMesh'

interface UseExecutionMeshOptions {
  templateId: string
  prefix: string
  start: number
  count: number
  startedAt?: string // Timestamp when the batch started
  selectedOrderId?: string | null // Currently selected order to view
}

// Generate expected order IDs based on params
function generateOrderIds(prefix: string, start: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const num = start + i
    return `${prefix}${String(num)}`
  })
}

// Find matching run by order ID, optionally filtered by start time
function findMatchingRun(orderId: string, runs: Run[], startedAt?: string): Run | undefined {
  // Filter runs to only those created after the batch started
  const validRuns = startedAt
    ? runs.filter((r) => {
        const runCreated = r.created_at ? new Date(r.created_at).getTime() : 0
        const batchStart = new Date(startedAt).getTime()
        return runCreated >= batchStart - 60000 // Allow 1 minute buffer
      })
    : runs

  const exactMatch = validRuns.find((r) => r.payload?.order_id === orderId)
  if (exactMatch) return exactMatch

  const numericMatch = orderId.match(/(\d+)$/)
  if (!numericMatch) return undefined

  const num = parseInt(numericMatch[1], 10)
  const prefixMatch = orderId.match(/^([A-Za-z]+-)/)
  const prefix = prefixMatch ? prefixMatch[1] : ''

  const variations = [
    `${prefix}${num}`,
    `${prefix}${num.toString().padStart(3, '0')}`,
    `${prefix}${num.toString().padStart(4, '0')}`,
  ]

  return validRuns.find((r) => {
    const runOrderId = String(r.payload?.order_id || '')
    return variations.some((v) => runOrderId.toLowerCase() === v.toLowerCase())
  })
}

function classifyStatus(run: Run | null): OrderCard['status'] {
  if (!run) return 'pending'
  if (run.status === 'completed') return 'completed'
  if (run.status === 'failed') return 'critical'
  if (run.status === 'running') return 'evaluating'
  return 'pending'
}

function getStatusText(run: Run | null): string {
  if (!run) return 'Waiting in queue...'
  if (run.status === 'completed') return 'Processing complete'
  if (run.status === 'failed') return 'Provisioning Timeout'
  if (run.status === 'running') return 'Scanning Anomaly...'
  return 'Waiting in queue...'
}

function calculateProgress(run: Run | null): number {
  if (!run) return 0
  if (run.status === 'completed') return 100
  if (run.status === 'failed') return 100
  if (run.status === 'running') {
    const created = run.created_at ? new Date(run.created_at).getTime() : Date.now()
    const elapsed = Date.now() - created
    const estimatedDuration = 30000
    return Math.min(95, Math.floor((elapsed / estimatedDuration) * 100))
  }
  return 0
}

// Swarm clusters - reset for each run
const SWARM_CLUSTERS: SwarmCluster[] = [
  {
    id: 'diagnosis',
    name: 'Diagnosis Cluster',
    icon: 'diagnosis',
    status: 'system_ready',
    subTasks: [
      { id: 'oms-sync', name: 'OMS Sync', status: 'pending' },
      { id: 'provision-check', name: 'Provision Check', status: 'pending' },
      { id: 'ping-network', name: 'Ping Network Elements', status: 'pending' },
      { id: 'verify-ports', name: 'Verify Logical Ports', status: 'pending' },
      { id: 'validate-bgp', name: 'Validate BGP Routes', status: 'pending' },
      { id: 'billing-state', name: 'Billing State', status: 'pending' },
      { id: 'id-verification', name: 'ID Verification', status: 'pending' },
    ],
  },
  {
    id: 'healing',
    name: 'Healing Cluster',
    icon: 'healing',
    status: 'system_ready',
    subTasks: [
      { id: 'deep-search', name: 'Deep Search', status: 'pending' },
      { id: 'db-index', name: 'Database Index', status: 'pending' },
      { id: 'connect-oracle', name: 'Connect to Oracle DB', status: 'pending' },
      { id: 'oracle-sync', name: 'Customer Order Oracle Sync', status: 'pending' },
      { id: 'query-table', name: 'Query Order Event Table', status: 'pending' },
      { id: 'auto-sql', name: 'Auto-SQL Fix', status: 'pending' },
      { id: 'generate-query', name: 'Generate Remediation Query', status: 'pending' },
      { id: 'dry-run', name: 'Run Dry-Run Analysis', status: 'pending' },
      { id: 'execute-update', name: 'Execute Production Update', status: 'pending' },
    ],
  },
  {
    id: 'alerting',
    name: 'Alerting Cluster',
    icon: 'alerting',
    status: 'system_ready',
    subTasks: [
      { id: 'escalation-tree', name: 'Escalation Tree', status: 'pending' },
      { id: 'ms-teams', name: 'MS Teams Notify', status: 'pending' },
      { id: 'format-card', name: 'Format Alert Adaptive Card', status: 'pending' },
      { id: 'resolve-webhook', name: 'Resolve Channel Webhook', status: 'pending' },
      { id: 'post-message', name: 'Post Priority Message', status: 'pending' },
      { id: 'email-dispatch', name: 'Email Dispatch', status: 'pending' },
      { id: 'queue-manager', name: 'Queue Manager', status: 'pending' },
    ],
  },
  {
    id: 'followup',
    name: 'Follow-up Cluster',
    icon: 'followup',
    status: 'system_ready',
    subTasks: [
      { id: 'ai-summarize', name: 'AI Summarize', status: 'pending' },
      { id: 'tracker-sequence', name: 'Tracker Sequence', status: 'pending' },
      { id: 'schedule-retry', name: 'Schedule Retry', status: 'pending' },
    ],
  },
]

export function useExecutionMesh({ templateId, prefix, start, count, startedAt, selectedOrderId }: UseExecutionMeshOptions) {
  // Force update trigger for progress animation - faster updates
  const [updateTick, setUpdateTick] = useState(0)
  
  useEffect(() => {
    const interval = setInterval(() => setUpdateTick((t) => t + 1), 500)
    return () => clearInterval(interval)
  }, [])

  // Fetch runs data
  const { data: runsData, isLoading } = useQuery({
    queryKey: ['execution-mesh-runs', templateId, prefix, start, count],
    enabled: !!templateId,
    queryFn: async () => {
      const response = await runsApi.list({
        template_id: templateId,
        limit: 500,
      })
      return { ...response, _fetchedAt: Date.now() }
    },
    refetchInterval: 2000,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  })

  const expectedOrderIds = useMemo(() => generateOrderIds(prefix, start, count), [prefix, start, count])
  const allRuns = runsData?.data || []

  // Transform runs into order cards
  const orders: OrderCard[] = useMemo(() => {
    return expectedOrderIds.map((orderId) => {
      const matchingRun = findMatchingRun(orderId, allRuns, startedAt)
      return {
        orderId,
        status: classifyStatus(matchingRun || null),
        statusText: getStatusText(matchingRun || null),
        progress: calculateProgress(matchingRun || null),
        runId: matchingRun?.run_id,
        templateId: matchingRun?.template_id,
        apiStatus: matchingRun?.status,
        createdAt: matchingRun?.created_at,
        updatedAt: matchingRun?.updated_at,
        completedAt: matchingRun?.completed_at,
        errorMessage: matchingRun?.error_message,
      }
    })
  }, [expectedOrderIds, allRuns, startedAt, updateTick])

  // Find any running orders (for orchestrator animation)
  const hasActiveRun = useMemo(() => orders.some((o) => o.status === 'evaluating'), [orders])
  const allRunsComplete = orders.length > 0 && orders.every((o) => o.status === 'completed' || o.status === 'critical')

  // Get the order to display: selected order, first evaluating order, or first order
  const displayOrder = useMemo(() => {
    if (selectedOrderId) {
      const selected = orders.find((o) => o.orderId === selectedOrderId)
      if (selected) return selected
    }
    // Fallback to first evaluating order
    const evaluating = orders.find((o) => o.status === 'evaluating')
    if (evaluating) return evaluating
    // Fallback to first completed/critical order
    const completed = orders.find((o) => o.status === 'completed' || o.status === 'critical')
    if (completed) return completed
    // Fallback to first order
    return orders[0] || null
  }, [orders, selectedOrderId])

  // Calculate cluster states based on the DISPLAY order (selected or active)
  const clusters: SwarmCluster[] = useMemo(() => {
    // If no order to display, all clusters are idle
    if (!displayOrder) {
      return SWARM_CLUSTERS.map((cluster) => ({
        ...cluster,
        status: 'system_ready' as const,
        subTasks: cluster.subTasks.map((task) => ({ ...task, status: 'pending' as const })),
      }))
    }

    // Get current cluster based on display order's progress
    const progress = displayOrder.progress
    let currentClusterId: string
    let clusterProgress: number

    if (progress < 25) {
      currentClusterId = 'diagnosis'
      clusterProgress = (progress / 25) * 100
    } else if (progress < 50) {
      currentClusterId = 'healing'
      clusterProgress = ((progress - 25) / 25) * 100
    } else if (progress < 75) {
      currentClusterId = 'alerting'
      clusterProgress = ((progress - 50) / 25) * 100
    } else {
      currentClusterId = 'followup'
      clusterProgress = ((progress - 75) / 25) * 100
    }

    // Mark previous clusters as completed, current as active, next as pending
    return SWARM_CLUSTERS.map((cluster) => {
      const clusterOrder = ['diagnosis', 'healing', 'alerting', 'followup']
      const clusterIndex = clusterOrder.indexOf(cluster.id)
      const currentIndex = clusterOrder.indexOf(currentClusterId)

      let isActive = cluster.id === currentClusterId
      let isCompleted = clusterIndex < currentIndex

      // Update subtask statuses
      const updatedSubTasks = cluster.subTasks.map((task, taskIndex) => {
        if (isCompleted) {
          return { ...task, status: 'done' as const }
        }
        if (isActive) {
          const taskCount = cluster.subTasks.length
          const taskStart = (taskIndex / taskCount) * 100
          const taskEnd = ((taskIndex + 1) / taskCount) * 100

          if (clusterProgress >= taskEnd) {
            return { ...task, status: 'done' as const }
          } else if (clusterProgress >= taskStart) {
            return { ...task, status: 'running' as const }
          }
          return { ...task, status: 'pending' as const }
        }
        return { ...task, status: 'pending' as const }
      })

      return {
        ...cluster,
        status: isActive ? ('actively_processing' as const) : isCompleted ? ('system_ready' as const) : ('system_ready' as const),
        subTasks: updatedSubTasks,
      }
    })
  }, [displayOrder, updateTick])

  // Determine orchestrator state
  const orchestrator: OrchestratorState = useMemo(() => {
    if (allRunsComplete) {
      return {
        isActive: false,
        currentAction: 'All Runs Complete',
      }
    }

    if (!hasActiveRun || !displayOrder) {
      return {
        isActive: false,
        currentAction: 'Waiting for orders...',
      }
    }

    const progress = displayOrder.progress
    let action: string
    let targetClusterId: string

    if (progress < 25) {
      action = 'diagnosis'
      targetClusterId = 'diagnosis'
    } else if (progress < 50) {
      action = 'healing'
      targetClusterId = 'healing'
    } else if (progress < 75) {
      action = 'alerting'
      targetClusterId = 'alerting'
    } else {
      action = 'follow-up'
      targetClusterId = 'followup'
    }

    return {
      isActive: true,
      currentAction: action,
      targetClusterId,
    }
  }, [displayOrder, hasActiveRun, allRunsComplete, updateTick])

  // Active connections - only show for current active run's cluster
  const activeConnections: string[] = useMemo(() => {
    if (!orchestrator.isActive || !orchestrator.targetClusterId) return []
    return [orchestrator.targetClusterId]
  }, [orchestrator])

  const state: ExecutionMeshState = {
    orders,
    orchestrator,
    clusters,
    activeConnections,
  }

  const stats = useMemo(() => {
    const total = orders.length
    const completed = orders.filter((o) => o.status === 'completed').length
    const failed = orders.filter((o) => o.status === 'critical').length
    const running = orders.filter((o) => o.status === 'evaluating').length
    const pending = orders.filter((o) => o.status === 'pending').length
    const progress = total > 0 ? ((completed + failed) / total) * 100 : 0

    return {
      total,
      completed,
      failed,
      running,
      pending,
      progress,
    }
  }, [orders, updateTick])

  return {
    state,
    stats,
    isLoading,
    hasActiveRun,
    allRunsComplete,
    displayOrder,
  }
}
