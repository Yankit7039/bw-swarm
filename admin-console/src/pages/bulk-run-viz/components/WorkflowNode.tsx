import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Play, Bot, Wrench, MessageSquare, Check, Clock, AlertCircle } from 'lucide-react'

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string
  sublabel?: string
  type: 'start' | 'agent' | 'tool' | 'llm' | 'end'
  status: 'pending' | 'running' | 'completed' | 'failed'
  count: number
  totalRuns: number
  description?: string
}

const statusConfig = {
  pending: {
    border: 'border-slate-200',
    bg: 'bg-white',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-400',
    badge: 'bg-slate-100 text-slate-600',
  },
  running: {
    border: 'border-indigo-400',
    bg: 'bg-white',
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    badge: 'bg-indigo-50 text-indigo-700',
  },
  completed: {
    border: 'border-emerald-400',
    bg: 'bg-white',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    badge: 'bg-emerald-50 text-emerald-700',
  },
  failed: {
    border: 'border-rose-400',
    bg: 'bg-white',
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    badge: 'bg-rose-50 text-rose-700',
  },
}

const getNodeIcon = (type: string, config: typeof statusConfig.completed) => {
  const className = `w-5 h-5 ${config.iconColor}`
  switch (type) {
    case 'start':
      return <Play className={className} />
    case 'agent':
      return <Bot className={className} />
    case 'tool':
      return <Wrench className={className} />
    case 'llm':
      return <MessageSquare className={className} />
    case 'end':
      return <Check className={className} />
    default:
      return <Clock className={className} />
  }
}

export const WorkflowNode = memo(function WorkflowNode(props: NodeProps) {
  const data = props.data as WorkflowNodeData
  const config = statusConfig[data.status]
  const progressPercent = data.totalRuns > 0 ? (data.count / data.totalRuns) * 100 : 0

  return (
    <div
      className={`relative rounded-xl border-2 ${config.border} ${config.bg} shadow-lg p-4 min-w-[180px]`}
    >
      {/* Status indicator dot */}
      <div
        className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full border-2 border-white ${
          data.status === 'running'
            ? 'bg-indigo-500 animate-pulse'
            : data.status === 'completed'
            ? 'bg-emerald-500'
            : data.status === 'failed'
            ? 'bg-rose-500'
            : 'bg-slate-300'
        }`}
      />

      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-slate-400" />

      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 ${config.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}
        >
          {getNodeIcon(data.type, config)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900 truncate">{data.label}</h3>
          {data.sublabel && (
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {data.sublabel}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className={`font-medium ${config.iconColor}`}>
            {data.count} / {data.totalRuns}
          </span>
          <span className="text-slate-400">{progressPercent.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              data.status === 'running'
                ? 'bg-indigo-500'
                : data.status === 'completed'
                ? 'bg-emerald-500'
                : data.status === 'failed'
                ? 'bg-rose-500'
                : 'bg-slate-300'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Status badge */}
      <div className="mt-3 flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${config.badge}`}
        >
          {data.status === 'running' && (
            <div className="w-2 h-2 rounded-full border border-current border-t-transparent animate-spin" />
          )}
          {data.status === 'completed' && <Check className="w-3 h-3" />}
          {data.status === 'failed' && <AlertCircle className="w-3 h-3" />}
          {data.status === 'pending' && <Clock className="w-3 h-3" />}
          {data.status}
        </span>
      </div>

      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-slate-400" />
    </div>
  )
})
