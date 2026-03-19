import { useEffect, useState } from 'react'
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
    <div className="flex items-center gap-2 py-1 text-[11px]">
      <div className="flex-shrink-0 w-5 flex justify-center">{config.icon}</div>
      <div className="flex-shrink-0 text-slate-400">{taskIcons[task.id] || <div className="w-3.5 h-3.5" />}</div>
      <span className={`${config.text} truncate`}>{task.name}</span>
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
      className={`relative rounded-2xl p-4 border-t-2 ${colors.border} overflow-hidden transition-all duration-300 ${
        isActive
          ? `${colors.bg} ring-1 ${colors.ring}`
          : showCompleted
            ? 'bg-emerald-50/30 border-t-emerald-500/40 ring-1 ring-emerald-500/20'
            : 'bg-white/60 border-slate-200/40'
      }`}
    >
      {/* Glow effect for active */}
      {isActive && (
        <div className={`absolute -right-8 -top-8 w-24 h-24 ${colors.bg.replace('/5', '/10')} rounded-full blur-3xl`} />
      )}

      {/* Header */}
      <button onClick={onToggle} className="relative w-full flex items-center gap-3 mb-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ring-1 ${
            isActive
              ? `${colors.iconBg} ${colors.iconColor} ${colors.ring}`
              : showCompleted
                ? 'bg-emerald-100 text-emerald-600 ring-emerald-500/20'
                : 'bg-slate-100 text-slate-500 ring-slate-200'
          }`}
        >
          {showCompleted && !isActive ? (
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          ) : (
            <Icon className="w-5 h-5" />
          )}
        </div>
        <div className="text-left flex-1">
          <h4 className={`font-bold text-sm ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>{cluster.name}</h4>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] ${isActive ? colors.text : showCompleted ? 'text-emerald-600 font-medium' : 'text-slate-500'}`}>
              {isActive ? `${runningCount > 0 ? runningCount : doneCount} Agents ${runningCount > 0 ? 'Running' : 'Done'}` : showCompleted ? 'Completed' : 'Ready'}
            </span>
            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />}
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Progress */}
      {(isActive || progress > 0 || showCompleted) && (
        <div className="relative mb-3">
          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
            <span>{runningCount > 0 ? `${runningCount} running` : `${doneCount} done`}</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
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
        <div className="relative bg-white/60 rounded-xl border border-slate-200/40 p-3">
          {cluster.subTasks.map((task) => (
            <SubTaskItem key={task.id} task={task} />
          ))}
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

  // Auto-expand active cluster, collapse when all done
  useEffect(() => {
    if (hasUserInteracted) return // Don't auto-expand if user has manually interacted

    if (allRunsComplete) {
      setExpandedClusters(new Set())
    } else if (activeConnections.length > 0) {
      setExpandedClusters(new Set(activeConnections))
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
    <div className="h-full flex flex-col bg-slate-50/80 backdrop-blur-lg p-5">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold">Execution Mesh</p>
          <h2 className="text-lg font-bold text-slate-900">Swarm Nodes</h2>
          {selectedOrderId && (
            <p className="text-xs text-indigo-600 font-medium mt-0.5">
              Viewing: {selectedOrderId}
            </p>
          )}
        </div>
        <Settings className="w-5 h-5 text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors" />
      </div>

      {/* Clusters */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
        {clusters.map((cluster) => (
          <ClusterCard
            key={cluster.id}
            cluster={cluster}
            isActive={activeConnections.includes(cluster.id)}
            isCompleted={isClusterCompleted(cluster)}
            isExpanded={expandedClusters.has(cluster.id)}
            onToggle={() => toggleCluster(cluster.id)}
          />
        ))}
      </div>
    </div>
  )
}
