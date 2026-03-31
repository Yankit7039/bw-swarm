import { useLayoutEffect, useRef } from 'react'
import { Activity, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react'
import type { OrderCard } from '../../../types/executionMesh'
import { formatRelativeTime, truncateMiddle } from '../../../utils/formatRelativeTime'

interface IngestionQueueProps {
  orders: OrderCard[]
  selectedOrderId?: string | null
  onSelectOrder?: (orderId: string) => void
  /** Order that drives the mesh / flow visualization (same as display order from hook). */
  meshFocusOrderId?: string | null
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
      className={`cursor-pointer rounded-xl border border-slate-200/50 border-l-4 bg-white shadow-sm transition-all hover:shadow-md ${config.borderColor} ${
        showRunDetails ? 'p-4 ring-2 ring-indigo-500/35' : 'p-3'
      } ${isMeshFocus ? 'shadow-md' : ''} ${
        isActive && !isMeshFocus ? 'ring-1 ring-indigo-300/50' : ''
      } ${isCompleted && !isMeshFocus ? 'opacity-[0.72]' : isCompleted ? 'opacity-90' : ''}`}
    >
      <div className={`flex items-start justify-between gap-2 ${showRunDetails ? 'mb-2' : 'mb-1.5'}`}>
        <span className="font-mono text-sm font-semibold text-slate-900">{order.orderId}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {isCompleted && <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${config.badgeBg} ${config.badgeText} ${config.badgeBorder}`}
          >
            {isCompleted ? 'Done' : config.label}
          </span>
        </div>
      </div>

      {isMeshFocus && (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-indigo-600">Mesh focus</p>
      )}

      <div className={`flex items-center gap-2 text-xs text-slate-600 ${showRunDetails ? 'mb-3' : 'mb-2'}`}>
        <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${config.badgeText} ${config.iconSpin ? 'animate-spin' : ''}`} />
        <span className="min-w-0 truncate">{order.statusText}</span>
      </div>

      {showRunDetails && order.runId ? (
        <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 rounded-lg border border-slate-100 bg-slate-50/95 px-2.5 py-2 text-[10px] leading-tight text-slate-600">
          <dt className="font-medium text-slate-400">Run</dt>
          <dd className="truncate font-mono text-slate-800" title={order.runId}>
            {truncateMiddle(order.runId, 8, 6)}
          </dd>
          {order.templateId && (
            <>
              <dt className="font-medium text-slate-400">Template</dt>
              <dd className="truncate font-mono text-slate-700" title={order.templateId}>
                {order.templateId}
              </dd>
            </>
          )}
          {order.apiStatus && (
            <>
              <dt className="font-medium text-slate-400">API</dt>
              <dd className="truncate uppercase tracking-wide text-slate-700">{order.apiStatus}</dd>
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
      ) : null}

      {showRunDetails && !order.runId ? (
        <p className="mb-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-[10px] text-slate-500">
          No run record matched for this order id.
        </p>
      ) : null}

      {showRunDetails && order.status === 'critical' && order.errorMessage ? (
        <div className="mb-3 rounded-md border border-rose-200/80 bg-rose-50/90 px-2.5 py-2 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700">Error</p>
          <pre className="mt-1 max-h-[min(320px,50vh)] overflow-y-auto whitespace-pre-wrap break-words font-sans text-[11px] leading-relaxed text-rose-900">
            {order.errorMessage}
          </pre>
        </div>
      ) : null}

      <div className="space-y-1">
        <div className="flex justify-between text-[11px] text-slate-500">
          <span className="font-medium">{order.status === 'evaluating' ? 'Processing' : 'Progress'}</span>
          <span className="font-bold tabular-nums">{order.progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
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
  meshFocusOrderId,
}: IngestionQueueProps) {
  const listRef = useRef<HTMLDivElement>(null)

  // Keep batch order stable; only scroll the mesh-focused row into view if needed (no reordering).
  useLayoutEffect(() => {
    const id = meshFocusOrderId
    if (!id || !listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-mesh-queue-order="${CSS.escape(id)}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [meshFocusOrderId])

  const evaluatingCount = orders.filter((o) => o.status === 'evaluating').length
  const criticalCount = orders.filter((o) => o.status === 'critical').length
  const completedCount = orders.filter((o) => o.status === 'completed').length

  return (
    <div className="flex h-full flex-col bg-slate-50/95 p-5">
      {/* Header */}
      <div className="mb-4 shrink-0">
        {/* <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">1 · Ingest</p> */}
        <h2 className="text-lg font-bold text-slate-900">Ingestion queue</h2>
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
