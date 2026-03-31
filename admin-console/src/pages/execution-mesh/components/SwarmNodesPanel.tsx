import { useEffect, useState, useRef } from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Clock,
  Database,
  History,
  Mail,
  MessageSquare,
  Network,
  RefreshCw,
  Scan,
  Search,
  Settings,
  Shield,
  Sparkles,
  Wrench,
  Zap,
} from 'lucide-react'
import type { OrderCard, SwarmCluster, SubTask } from '../../../types/executionMesh'
import { formatRelativeTime } from '../../../utils/formatRelativeTime'

interface SwarmNodesPanelProps {
  clusters: SwarmCluster[]
  activeConnections: string[]
  allRunsComplete?: boolean
  selectedOrderId?: string | null
  /** Mesh-focused order (API-backed fields for the right column). */
  focusedOrder?: OrderCard | null
}

const clusterIcons = {
  diagnosis: Scan,
  healing: Sparkles,
  alerting: AlertCircle,
  followup: History,
}

const clusterColors = {
  diagnosis: {
    border: 'border-t-indigo-500/40',
    bg: 'bg-indigo-500/5',
    iconBg: 'bg-indigo-500/10',
    iconColor: 'text-indigo-600',
    ring: 'ring-indigo-500/20',
    text: 'text-indigo-600',
    doneBg: 'bg-emerald-500/10',
    doneIcon: 'text-emerald-600',
  },
  healing: {
    border: 'border-t-emerald-500/40',
    bg: 'bg-emerald-500/5',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-600',
    ring: 'ring-emerald-500/20',
    text: 'text-emerald-600',
    doneBg: 'bg-emerald-500/10',
    doneIcon: 'text-emerald-600',
  },
  alerting: {
    border: 'border-t-rose-500/40',
    bg: 'bg-rose-500/5',
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-600',
    ring: 'ring-rose-500/20',
    text: 'text-rose-600',
    doneBg: 'bg-emerald-500/10',
    doneIcon: 'text-emerald-600',
  },
  followup: {
    border: 'border-t-violet-500/40',
    bg: 'bg-violet-500/5',
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-600',
    ring: 'ring-violet-500/20',
    text: 'text-violet-600',
    doneBg: 'bg-emerald-500/10',
    doneIcon: 'text-emerald-600',
  },
}

const taskIcons: Record<string, React.ReactNode> = {
  'oms-sync': <Network className="w-3.5 h-3.5" />,
  'provision-check': <Shield className="w-3.5 h-3.5" />,
  'ping-network': <Activity className="w-3.5 h-3.5" />,
  'verify-ports': <CheckCircle className="w-3.5 h-3.5" />,
  'validate-bgp': <Network className="w-3.5 h-3.5" />,
  'billing-state': <Database className="w-3.5 h-3.5" />,
  'id-verification': <Shield className="w-3.5 h-3.5" />,
  'deep-search': <Search className="w-3.5 h-3.5" />,
  'db-index': <Database className="w-3.5 h-3.5" />,
  'connect-oracle': <Database className="w-3.5 h-3.5" />,
  'oracle-sync': <RefreshCw className="w-3.5 h-3.5" />,
  'query-table': <Database className="w-3.5 h-3.5" />,
  'auto-sql': <Wrench className="w-3.5 h-3.5" />,
  'generate-query': <Sparkles className="w-3.5 h-3.5" />,
  'dry-run': <CheckCircle className="w-3.5 h-3.5" />,
  'execute-update': <Database className="w-3.5 h-3.5" />,
  'escalation-tree': <AlertCircle className="w-3.5 h-3.5" />,
  'ms-teams': <MessageSquare className="w-3.5 h-3.5" />,
  'format-card': <Sparkles className="w-3.5 h-3.5" />,
  'resolve-webhook': <Network className="w-3.5 h-3.5" />,
  'post-message': <MessageSquare className="w-3.5 h-3.5" />,
  'email-dispatch': <Mail className="w-3.5 h-3.5" />,
  'queue-manager': <Settings className="w-3.5 h-3.5" />,
  'ai-summarize': <Sparkles className="w-3.5 h-3.5" />,
  'tracker-sequence': <Clock className="w-3.5 h-3.5" />,
  'schedule-retry': <RefreshCw className="w-3.5 h-3.5" />,
}

const statusConfig = {
  pending: {
    icon: <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />,
    text: 'text-slate-500',
  },
  running: {
    icon: <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_5px_#4f46e5]" />,
    text: 'text-indigo-600 font-medium',
  },
  done: {
    icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />,
    text: 'text-emerald-600',
  },
  blocked: {
    icon: <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />,
    text: 'text-slate-400',
  },
}

function SubTaskItem({ task }: { task: SubTask }) {
  const config = statusConfig[task.status]
  return (
    <div
      className={`flex items-center gap-2.5 border-b border-slate-100/80 py-2 pl-1 pr-2 text-xs last:border-b-0 ${
        task.status === 'running' ? 'rounded-md bg-indigo-50/60 ring-1 ring-indigo-100' : ''
      }`}
    >
      <div className="flex w-5 shrink-0 justify-center">{config.icon}</div>
      <div className="shrink-0 text-slate-400">{taskIcons[task.id] || <div className="h-4 w-4" />}</div>
      <span className={`min-w-0 flex-1 truncate ${config.text}`}>{task.name}</span>
      {task.status === 'done' && <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
    </div>
  )
}

function ClusterCard({
  cluster,
  isActive,
  isCompleted,
  isExpanded,
  onToggle,
  runSyncHint,
}: {
  cluster: SwarmCluster
  isActive: boolean
  isCompleted: boolean
  isExpanded: boolean
  onToggle: () => void
  /** Real run refresh time when this cluster is active. */
  runSyncHint?: string | null
}) {
  const Icon = clusterIcons[cluster.icon]
  const colors = clusterColors[cluster.icon]
  const doneCount = cluster.subTasks.filter((t) => t.status === 'done').length
  const runningCount = cluster.subTasks.filter((t) => t.status === 'running').length
  const allDone = cluster.subTasks.every((t) => t.status === 'done')
  const progress = cluster.subTasks.length > 0 ? (doneCount / cluster.subTasks.length) * 100 : 0

  // Show as completed if all tasks are done
  const showCompleted = isCompleted || allDone

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
        isActive
          ? 'border-indigo-200/90 bg-white shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/15'
          : showCompleted
            ? 'border-slate-200/90 bg-slate-50/80'
            : 'border-slate-200/80 bg-white hover:border-slate-300'
      }`}
    >
      <div
        className={`h-0.5 w-full ${isActive ? colors.text.replace('text-', 'bg-') : showCompleted ? 'bg-emerald-400/60' : 'bg-slate-200'}`}
      />

      {/* Header */}
      <button type="button" onClick={onToggle} className="relative flex w-full items-center gap-3 px-4 py-3.5 text-left">
        {/* Icon */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
            isActive
              ? `${colors.iconBg} ${colors.iconColor}`
              : showCompleted
                ? 'bg-emerald-100 text-emerald-600'
                : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200/90'
          }`}
        >
          {showCompleted && !isActive ? (
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          ) : isActive ? (
            <Zap className="w-5 h-5" />
          ) : (
            <Icon className="w-5 h-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h4 className={`truncate text-sm font-semibold tracking-tight ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
            {cluster.name}
          </h4>
          <div className="mt-0.5 flex items-center gap-2">
            {isActive ? (
              <>
                <span className={`text-[11px] font-medium ${colors.text}`}>
                  {runningCount > 0 ? `${runningCount} running` : 'Processing'}
                </span>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
              </>
            ) : showCompleted ? (
              <span className="text-[11px] font-medium text-emerald-600">Completed</span>
            ) : (
              <span className="text-[11px] text-slate-500">{cluster.subTasks.length} tasks</span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {progress > 0 && (
            <span
              className={`tabular-nums text-xs font-semibold ${showCompleted ? 'text-emerald-600' : isActive ? colors.text : 'text-slate-500'}`}
            >
              {Math.round(progress)}%
            </span>
          )}
          <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {(progress > 0 || isActive) && (
        <div className="px-4 pb-2">
          <div className="h-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                showCompleted ? 'bg-emerald-500' : isActive ? colors.text.replace('text-', 'bg-') : 'bg-slate-300'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {isActive && runSyncHint && (
        <p className="px-4 pb-1.5 text-[10px] text-slate-500">Run data · {runSyncHint}</p>
      )}

      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50/70">
          <div className="px-2 py-1">
            {cluster.subTasks.map((task) => (
              <SubTaskItem key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function SwarmNodesPanel({
  clusters,
  activeConnections,
  allRunsComplete,
  selectedOrderId,
  focusedOrder,
}: SwarmNodesPanelProps) {
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set())
  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Auto-expand active cluster and scroll to it
  useEffect(() => {
    if (hasUserInteracted) return

    if (allRunsComplete) {
      setExpandedClusters(new Set())
    } else if (activeConnections.length > 0) {
      const id = activeConnections[0]
      setExpandedClusters(new Set(activeConnections))
      setTimeout(() => {
        const root = scrollContainerRef.current
        const el = root?.querySelector<HTMLElement>(`[data-mesh-cluster="${CSS.escape(id)}"]`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [activeConnections.join(','), allRunsComplete, hasUserInteracted])

  /** Accordion: at most one cluster expanded at a time. */
  const toggleCluster = (clusterId: string) => {
    setHasUserInteracted(true)
    setExpandedClusters((prev) => {
      if (prev.has(clusterId)) return new Set()
      return new Set([clusterId])
    })
  }

  // Determine if a cluster is completed (all tasks done)
  const isClusterCompleted = (cluster: SwarmCluster) => {
    return cluster.subTasks.every((t) => t.status === 'done')
  }

  return (
    <div className="flex h-full flex-col border-l border-slate-200/80 bg-white">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-100 bg-gradient-to-b from-slate-50/95 to-white px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Execute</p>
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Swarm nodes</h2>
        {selectedOrderId && (
          <p className="mt-1 font-mono text-xs text-slate-600">
            Mesh order <span className="font-semibold text-slate-900">{selectedOrderId}</span>
          </p>
        )}
      </div>

      {/* Clusters */}
      <div ref={scrollContainerRef} className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
        {clusters.map((cluster) => {
          const isActive = activeConnections.includes(cluster.id)
          const runSyncHint =
            isActive && focusedOrder?.updatedAt
              ? `refreshed ${formatRelativeTime(focusedOrder.updatedAt)}`
              : null
          return (
            <div key={cluster.id} data-mesh-cluster={cluster.id}>
              <ClusterCard
                cluster={cluster}
                isActive={isActive}
                isCompleted={isClusterCompleted(cluster)}
                isExpanded={expandedClusters.has(cluster.id)}
                onToggle={() => toggleCluster(cluster.id)}
                runSyncHint={runSyncHint}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
