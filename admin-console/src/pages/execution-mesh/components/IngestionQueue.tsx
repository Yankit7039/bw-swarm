import { useLayoutEffect, useRef } from 'react'
import { Activity, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react'
import type { OrderCard } from '../../../types/executionMesh'
import { formatRelativeTime, truncateMiddle } from '../../../utils/formatRelativeTime'

interface IngestionQueueProps {
  orders: OrderCard[]
  selectedOrderId?: string | null
  onSelectOrder?: (orderId: string) => void
  meshFocusOrderId?: string | null
}

/** Unified status theme */
const statusConfig = {
  evaluating: {
    badgeBg: 'bg-indigo-100/80',
    badgeText: 'text-indigo-700',
    badgeBorder: 'border-indigo-300/70',
    borderColor: 'border-l-indigo-500/80',
    progressColor: 'bg-indigo-500',
    icon: Loader2,
    iconSpin: true,
    label: 'Running',
  },
  critical: {
    badgeBg: 'bg-rose-100/80',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-300/70',
    borderColor: 'border-l-rose-500/80',
    progressColor: 'bg-rose-500',
    icon: AlertCircle,
    iconSpin: false,
    label: 'Failed',
  },
  completed: {
    badgeBg: 'bg-emerald-100/80',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-300/70',
    borderColor: 'border-l-emerald-500/80',
    progressColor: 'bg-emerald-500',
    icon: CheckCircle,
    iconSpin: false,
    label: 'Completed',
  },
  pending: {
    badgeBg: 'bg-slate-100/80',
    badgeText: 'text-slate-600',
    badgeBorder: 'border-slate-300/70',
    borderColor: 'border-l-slate-400/80',
    progressColor: 'bg-slate-400',
    icon: Clock,
    iconSpin: false,
    label: 'Pending',
  },
}

function OrderCardComponent({
  order,
  isActive,
  isMeshFocus,
  isCompleted,
  onClick,
}: {
  order: OrderCard
  isActive: boolean
  isMeshFocus: boolean
  isCompleted: boolean
  onClick?: () => void
}) {
  const config = statusConfig[order.status]
  const StatusIcon = config.icon
  const showRunDetails = isMeshFocus

  return (
    <div
      data-mesh-queue-order={order.orderId}
      onClick={onClick}
      className={`
        group cursor-pointer rounded-xl border bg-white
        shadow-sm hover:shadow-md hover:border-slate-300
        transition-all duration-300 
        ${config.borderColor}
        ${showRunDetails ? 'p-4' : 'p-3'}
        ${isActive ? 'ring-1 ring-indigo-300/40' : ''}
        ${isMeshFocus ? 'shadow-md scale-[1.01]' : ''}
      `}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-sm font-semibold text-slate-900">
          {order.orderId}
        </span>

        <div className="flex items-center gap-2">
          {isCompleted && <CheckCircle className="h-4 w-4 text-emerald-500" />}

          <span
            className={`
              rounded-full px-2 py-0.5 text-[10px] font-semibold
              tracking-wide ring-1 shadow-sm
              ${config.badgeBg} ${config.badgeText} ${config.badgeBorder}
            `}
          >
            {isCompleted ? 'Done' : config.label}
          </span>
        </div>
      </div>

      {/* Mesh Focus Label */}
      {isMeshFocus && (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
          Mesh focus
        </p>
      )}

      {/* Status Row */}
      <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
        <div
          className={`h-5 w-5 flex items-center justify-center rounded-md ${config.badgeBg}`}
        >
          <StatusIcon
            className={`h-3.5 w-3.5 ${config.badgeText} ${
              config.iconSpin ? 'animate-spin' : ''
            }`}
          />
        </div>

        <span className="truncate">{order.statusText}</span>
      </div>

      {/* Run Details */}
      {showRunDetails && order.runId && (
        <dl
          className="
            mb-3 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 
            rounded-lg border border-slate-200 bg-slate-50 
            px-3 py-2 text-[11px] leading-tight text-slate-700 shadow-inner
          "
        >
          <dt className="font-medium text-slate-400">Run</dt>
          <dd className="truncate font-mono text-slate-800">
            {truncateMiddle(order.runId, 8, 6)}
          </dd>

          {order.templateId && (
            <>
              <dt className="font-medium text-slate-400">Template</dt>
              <dd className="truncate font-mono text-slate-700">
                {order.templateId}
              </dd>
            </>
          )}

          {order.apiStatus && (
            <>
              <dt className="font-medium text-slate-400">API</dt>
              <dd className="truncate uppercase tracking-wide text-slate-700">
                {order.apiStatus}
              </dd>
            </>
          )}

          <dt className="font-medium text-slate-400">Started</dt>
          <dd>{formatRelativeTime(order.createdAt)}</dd>

          <dt className="font-medium text-slate-400">Updated</dt>
          <dd>{formatRelativeTime(order.updatedAt)}</dd>

          {order.completedAt && (
            <>
              <dt className="font-medium text-slate-400">Completed</dt>
              <dd>{formatRelativeTime(order.completedAt)}</dd>
            </>
          )}
        </dl>
      )}

      {!order.runId && showRunDetails && (
        <p className="mb-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          No run record found.
        </p>
      )}

      {/* Error */}
      {showRunDetails && order.status === 'critical' && order.errorMessage && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700">
            Error
          </p>
          <pre className="mt-1 max-h-[240px] overflow-y-auto whitespace-pre-wrap break-words text-[11px] text-rose-900">
            {order.errorMessage}
          </pre>
        </div>
      )}

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] text-slate-500">
          <span className="font-medium">
            {order.status === 'evaluating' ? 'Processing' : 'Progress'}
          </span>
          <span className="font-bold tabular-nums">{order.progress}%</span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-200/70">
          <div
            className={`
              h-full rounded-full transition-all duration-700 
              ${config.progressColor}
              ${
                order.status === 'evaluating'
                  ? 'shadow-[0_0_6px_rgba(99,102,241,0.35)]'
                  : ''
              }
            `}
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
  meshFocusOrderId,
}: IngestionQueueProps) {
  const listRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!meshFocusOrderId || !listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-mesh-queue-order="${CSS.escape(meshFocusOrderId)}"]`
    )
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [meshFocusOrderId])

  const evaluatingCount = orders.filter((o) => o.status === 'evaluating').length
  const criticalCount = orders.filter((o) => o.status === 'critical').length
  const completedCount = orders.filter((o) => o.status === 'completed').length

  return (
    <div className="flex h-full flex-col bg-slate-50 p-5">
      {/* Header */}
      <div className="mb-4 shrink-0">
        <h2 className="text-lg font-semibold text-slate-900">Ingestion queue</h2>

        {orders.length > 0 && (
          <div className="flex items-center gap-4 mt-2 text-[11px] font-medium">
            {evaluatingCount > 0 && (
              <span className="text-indigo-600 flex items-center gap-1">
                <Activity className="w-3 h-3" /> {evaluatingCount} running
              </span>
            )}

            {criticalCount > 0 && (
              <span className="text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {criticalCount} failed
              </span>
            )}

            {completedCount > 0 && (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> {completedCount} done
              </span>
            )}
          </div>
        )}
      </div>

      {/* Cards */}
      <div ref={listRef} className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-1">
        {orders.map((order) => {
          const isSelected = order.orderId === selectedOrderId
          const isMeshFocus = order.orderId === meshFocusOrderId
          const isCompleted = order.status === 'completed' || order.status === 'critical'

          return (
            <OrderCardComponent
              key={order.orderId}
              order={order}
              isActive={isSelected}
              isMeshFocus={!!isMeshFocus}
              isCompleted={isCompleted}
              onClick={() => onSelectOrder?.(order.orderId)}
            />
          )
        })}

        {orders.length === 0 && (
          <div className="text-center py-10 text-slate-400">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No orders in queue</p>
            <p className="text-[11px] mt-1">Orders will appear when ingestion starts</p>
          </div>
        )}
      </div>
    </div>
  )
}