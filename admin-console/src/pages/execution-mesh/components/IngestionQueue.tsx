import { Activity, AlertCircle, CheckCircle, Clock, Loader2,  } from 'lucide-react'
import type { OrderCard } from '../../../types/executionMesh'

interface IngestionQueueProps {
  orders: OrderCard[]
  selectedOrderId?: string | null
  onSelectOrder?: (orderId: string) => void
}

const statusConfig = {
  evaluating: {
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-600',
    badgeBorder: 'border-indigo-200',
    borderColor: 'border-l-indigo-500',
    progressColor: 'bg-indigo-500',
    icon: Loader2,
    iconSpin: true,
    label: 'Running',
  },
  critical: {
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-600',
    badgeBorder: 'border-rose-200',
    borderColor: 'border-l-rose-500',
    progressColor: 'bg-rose-500',
    icon: AlertCircle,
    iconSpin: false,
    label: 'Critical',
  },
  completed: {
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-600',
    badgeBorder: 'border-emerald-200',
    borderColor: 'border-l-emerald-500',
    progressColor: 'bg-emerald-500',
    icon: CheckCircle,
    iconSpin: false,
    label: 'Completed',
  },
  pending: {
    badgeBg: 'bg-slate-50',
    badgeText: 'text-slate-500',
    badgeBorder: 'border-slate-200',
    borderColor: 'border-l-slate-400',
    progressColor: 'bg-slate-400',
    icon: Clock,
    iconSpin: false,
    label: 'Pending',
  },
}

function OrderCardComponent({
  order,
  isActive,
  isCompleted,
  onClick,
}: {
  order: OrderCard
  isActive: boolean
  isCompleted: boolean
  onClick?: () => void
}) {
  const config = statusConfig[order.status]
  const StatusIcon = config.icon

  return (
    <div
      onClick={onClick}
      className={`bg-white p-4 rounded-xl border-l-4 ${config.borderColor} shadow-sm hover:shadow-md transition-all cursor-pointer border border-slate-200/40 ${
        isActive ? 'ring-2 ring-indigo-500/20 shadow-lg' : isCompleted ? 'opacity-60' : ''
      }`}
    >
      {/* Header: Order ID + Badge */}
      <div className="flex justify-between items-start mb-2">
        <span className="font-mono text-sm font-semibold text-slate-900">{order.orderId}</span>
        <div className="flex items-center gap-2">
          {/* {isActive && (
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          )} */}
          {isCompleted && (
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          )}
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ring-1 ${config.badgeBg} ${config.badgeText} ${config.badgeBorder}`}
          >
            {isCompleted ? 'Completed' : config.label}
          </span>
        </div>
      </div>

      {/* Status text */}
      <div className="flex items-center gap-2 text-xs text-slate-600 mb-3">
        <StatusIcon className={`w-4 h-4 ${config.badgeText} ${config.iconSpin ? 'animate-spin' : ''}`} />
        <span className="truncate">{isActive ? 'In Progress...' : order.statusText}</span>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-500">
          <span className="font-medium">{order.status === 'evaluating' ? 'Processing' : 'Progress'}</span>
          <span className="font-bold">{order.progress}%</span>
        </div>
        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${config.progressColor} ${order.status === 'evaluating' ? 'shadow-[0_0_8px_rgba(99,102,241,0.3)]' : ''}`}
            style={{ width: `${order.progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export function IngestionQueue({
  orders,
  selectedOrderId,
  onSelectOrder,
}: IngestionQueueProps) {
  // Sort: selected first, then evaluating, then others
  const sortedOrders = [...orders].sort((a, b) => {
    const aIsSelected = a.orderId === selectedOrderId
    const bIsSelected = b.orderId === selectedOrderId

    if (aIsSelected && !bIsSelected) return -1
    if (!aIsSelected && bIsSelected) return 1

    const statusPriority: Record<string, number> = {
      evaluating: 0,
      critical: 1,
      pending: 2,
      completed: 3,
    }
    return statusPriority[a.status] - statusPriority[b.status]
  })

  const evaluatingCount = orders.filter((o) => o.status === 'evaluating').length
  const criticalCount = orders.filter((o) => o.status === 'critical').length
  const completedCount = orders.filter((o) => o.status === 'completed').length

  return (
    <div className="h-full flex flex-col bg-slate-50 p-5">
      {/* Header */}
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold">System Stream</p>
        <h2 className="text-lg font-bold text-slate-900">Ingestion Queue</h2>
        {orders.length > 0 && (
          <div className="flex items-center gap-3 mt-2 text-[10px]">
            {evaluatingCount > 0 && (
              <span className="text-indigo-600 font-medium flex items-center gap-1">
                <Activity className="w-3 h-3" /> {evaluatingCount} running
              </span>
            )}
            {criticalCount > 0 && (
              <span className="text-rose-600 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {criticalCount} failed
              </span>
            )}
            {completedCount > 0 && (
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> {completedCount} done
              </span>
            )}
          </div>
        )}
      </div>

      {/* Queue Cards */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        {sortedOrders.map((order) => {
          const isSelected = order.orderId === selectedOrderId
          const isCompleted = order.status === 'completed' || order.status === 'critical'

          return (
            <OrderCardComponent
              key={order.orderId}
              order={order}
              isActive={isSelected}
              isCompleted={isCompleted}
              onClick={() => onSelectOrder?.(order.orderId)}
            />
          )
        })}

        {orders.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No orders in queue</p>
          </div>
        )}
      </div>

      {/* Manual Ingest Button */}
      {/* <div className="pt-4 border-t border-slate-200/60 mt-3">
        <button className="w-full flex items-center justify-center gap-2 bg-slate-200/50 text-indigo-600 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors">
          <PlusCircle className="w-4 h-4" />
          Manual Ingest
        </button>
      </div> */}
    </div>
  )
}
