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
import type { SwarmCluster, SubTask } from '../../../types/executionMesh'

interface SwarmNodesPanelProps {
  clusters: SwarmCluster[]
  activeConnections: string[]
  allRunsComplete?: boolean
  selectedOrderId?: string | null
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
    <div className={`flex items-center gap-2.5 py-1.5 px-2 rounded-md text-xs ${
      task.status === 'running' ? 'bg-white shadow-sm border border-slate-100' : ''
    }`}>
      <div className="flex-shrink-0 w-5 flex justify-center">{config.icon}</div>
      <div className="flex-shrink-0 text-slate-400">{taskIcons[task.id] || <div className="w-4 h-4" />}</div>
      <span className={`${config.text} truncate flex-1`}>{task.name}</span>
      {task.status === 'done' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
    </div>
  )
}

function ClusterCard({
  cluster,
  isActive,
  isCompleted,
  isExpanded,
  onToggle,
}: {
  cluster: SwarmCluster
  isActive: boolean
  isCompleted: boolean
  isExpanded: boolean
  onToggle: () => void
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
      className={`group relative rounded-xl overflow-hidden transition-all duration-300 border ${
        isActive
          ? 'bg-white border-indigo-200 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/20'
          : showCompleted
            ? 'bg-slate-50 border-slate-200'
            : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Active indicator bar */}
      {isActive && (
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${colors.text.replace('text-', 'bg-')}`} />
      )}

      {/* Header */}
      <button 
        onClick={onToggle} 
        className="relative w-full flex items-center gap-3 p-4"
      >
        {/* Icon */}
        <div
          className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            isActive
              ? `${colors.iconBg} ${colors.iconColor}`
              : showCompleted
                ? 'bg-emerald-100 text-emerald-600'
                : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
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

        {/* Title & Status */}
        <div className="text-left flex-1 min-w-0">
          <h4 className={`font-semibold text-sm truncate ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
            {cluster.name}
          </h4>
          <div className="flex items-center gap-2 mt-0.5">
            {isActive ? (
              <>
                <span className={`text-xs font-medium ${colors.text}`}>
                  {runningCount > 0 ? `${runningCount} running` : 'Processing'}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              </>
            ) : showCompleted ? (
              <span className="text-xs font-medium text-emerald-600">Completed</span>
            ) : (
              <span className="text-xs text-slate-500">{cluster.subTasks.length} tasks</span>
            )}
          </div>
        </div>

        {/* Progress Badge */}
        <div className="flex items-center gap-3">
          {progress > 0 && (
            <span className={`text-xs font-semibold ${showCompleted ? 'text-emerald-600' : isActive ? colors.text : 'text-slate-500'}`}>
              {Math.round(progress)}%
            </span>
          )}
          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {/* Progress Bar */}
      {(progress > 0 || isActive) && (
        <div className="px-4 pb-3">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                showCompleted ? 'bg-emerald-500' : isActive ? colors.text.replace('text-', 'bg-') : 'bg-slate-300'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Expanded Tasks */}
      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50/50">
          <div className="p-3 space-y-1">
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
}: SwarmNodesPanelProps) {
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set())
  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const activeClusterRef = useRef<HTMLDivElement>(null)

  // Auto-expand active cluster and scroll to it
  useEffect(() => {
    if (hasUserInteracted) return

    if (allRunsComplete) {
      setExpandedClusters(new Set())
    } else if (activeConnections.length > 0) {
      setExpandedClusters(new Set(activeConnections))
      // Scroll to active cluster after a short delay to allow render
      setTimeout(() => {
        if (activeClusterRef.current && scrollContainerRef.current) {
          activeClusterRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    }
  }, [activeConnections.join(','), allRunsComplete, hasUserInteracted])

  const toggleCluster = (clusterId: string) => {
    setHasUserInteracted(true)
    const newExpanded = new Set(expandedClusters)
    if (newExpanded.has(clusterId)) {
      newExpanded.delete(clusterId)
    } else {
      newExpanded.add(clusterId)
    }
    setExpandedClusters(newExpanded)
  }

  // Determine if a cluster is completed (all tasks done)
  const isClusterCompleted = (cluster: SwarmCluster) => {
    return cluster.subTasks.every((t) => t.status === 'done')
  }

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Live Execution</p>
        </div>
        <h2 className="text-lg font-bold text-slate-900">Swarm Nodes</h2>
        {selectedOrderId && (
          <p className="text-xs text-indigo-600 font-medium mt-1">
            Order: {selectedOrderId}
          </p>
        )}
      </div>

      {/* Clusters */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {clusters.map((cluster) => {
          const isActive = activeConnections.includes(cluster.id)
          return (
            <div
              key={cluster.id}
              ref={isActive ? activeClusterRef : null}
            >
              <ClusterCard
                cluster={cluster}
                isActive={isActive}
                isCompleted={isClusterCompleted(cluster)}
                isExpanded={expandedClusters.has(cluster.id)}
                onToggle={() => toggleCluster(cluster.id)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
