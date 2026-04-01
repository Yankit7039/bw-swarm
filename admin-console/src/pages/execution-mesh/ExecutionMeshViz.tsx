import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, GitBranch, ListOrdered } from 'lucide-react'
import { Layout } from '../../components/layout/Layout'
import { useExecutionMesh } from './hooks/useExecutionMesh'
import { useMeshFlowGeometry, type MeshFlowAnchors } from './hooks/useMeshFlowGeometry'
import { IngestionQueue } from './components/IngestionQueue'
import { OrchestratorHub } from './components/OrchestratorHub'
import { SwarmNodesPanel } from './components/SwarmNodesPanel'
import { MeshFlowOverlay } from './components/MeshFlowOverlay'

const MESH_CLUSTER_IDS = ['diagnosis', 'healing', 'alerting', 'followup'] as const

interface ExecutionMeshParams {
  templateId: string
  prefix: string
  start: number
  count: number
  intervalMs: number
  startedAt?: string
  name?: string
}

function useExecutionMeshParams(): ExecutionMeshParams | null {
  const location = useLocation()
  const search = new URLSearchParams(location.search)

  const templateId = search.get('templateId') || ''
  const prefix = search.get('prefix') || 'ORD-'
  const start = Number(search.get('start') || '1')
  const count = Number(search.get('count') || '10')
  const intervalMs = Number(search.get('intervalMs') || '500')
  const startedAt = search.get('startedAt') || undefined
  const name = search.get('name') || undefined

  if (!templateId || !Number.isFinite(start) || !Number.isFinite(count)) {
    return null
  }

  return { templateId, prefix, start, count, intervalMs, startedAt, name }
}

export function ExecutionMeshViz() {
  const params = useExecutionMeshParams()
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  const { state, isLoading, allRunsComplete, displayOrder, stats } = useExecutionMesh({
    templateId: params?.templateId || '',
    prefix: params?.prefix || 'ORD-',
    start: params?.start || 1,
    count: params?.count || 10,
    startedAt: params?.startedAt,
    selectedOrderId,
  })

  const meshRef = useRef<HTMLDivElement>(null)
  const anchorsRef = useRef<MeshFlowAnchors>({ hub: null, clusters: {} })
  const [anchorRevision, setAnchorRevision] = useState(0)

  const bumpAnchors = useCallback(() => setAnchorRevision((n) => n + 1), [])

  useLayoutEffect(() => {
    const root = meshRef.current
    if (!root) return

    const nextHub = root.querySelector<HTMLElement>('[data-mesh-hub="core"]')

    const a = anchorsRef.current
    let changed = false

    if (a.hub !== nextHub) {
      changed = true
      a.hub = nextHub
    }

    for (const id of MESH_CLUSTER_IDS) {
      const el = root.querySelector<HTMLElement>(`[data-mesh-cluster="${CSS.escape(id)}"]`)
      const prev = a.clusters[id] ?? null
      const next = el ?? null
      if (prev !== next) {
        changed = true
        if (next) a.clusters[id] = next
        else delete a.clusters[id]
      }
    }

    if (changed) bumpAnchors()
  }, [state.clusters, bumpAnchors])

  const activeClusterId = state.orchestrator.targetClusterId ?? null
  const showHubToCluster = state.orchestrator.isActive && !!activeClusterId
  const flowActive = state.orchestrator.isActive && !allRunsComplete

  /** Only running orders get queue→hub lines; when every run is done, this is empty and paths disappear. */
  const queueConnectorOrderIds = useMemo(
    () => state.orders.filter((o) => o.status === 'evaluating').map((o) => o.orderId),
    [state.orders],
  )

  /** Opaque queue→hub path + ingest packets: mesh focus when running, else first running order. */
  const queueFlowFocusOrderId = useMemo(() => {
    const d = displayOrder
    const firstRunning = state.orders.find((o) => o.status === 'evaluating')
    if (d?.status === 'evaluating') return d.orderId
    if (firstRunning) return firstRunning.orderId
    return null
  }, [displayOrder, state.orders])

  const { paths } = useMeshFlowGeometry(meshRef, anchorsRef, {
    activeClusterId,
    showHubToCluster,
    anchorRevision,
    queueConnectorOrderIds,
    activeFocusOrderId: queueFlowFocusOrderId,
  })

  if (!params) {
    return (
      <Layout>
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="text-center">
            <p className="text-lg text-slate-500">Missing or invalid visualization parameters.</p>
            <Link to="/test-runs" className="mt-4 inline-flex items-center gap-2 text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" />
              Back to Test Runs
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
            <span>Loading...</span>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(79, 70, 229, 0.12);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(79, 70, 229, 0.22);
        }
      `}</style>
      <div className="flex h-[calc(100vh-4rem)] flex-col bg-slate-100/90">
        <header className="shrink-0 border-b border-slate-200/80 bg-white px-4 py-3 shadow-sm">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                to="/test-runs"
                className="shrink-0 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Back to test runs"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold text-slate-900">
                  {params.name || 'Execution mesh'}
                </h1>
                <p className="text-xs text-slate-500">
                  {params.count} orders · live flow from ingest to clusters
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200/80 bg-slate-50 px-2 py-1 font-medium">
                <ListOrdered className="h-3.5 w-3.5 text-slate-400" />
                {stats.running} running
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200/80 bg-slate-50 px-2 py-1 font-medium">
                <GitBranch className="h-3.5 w-3.5 text-emerald-500" />
                {stats.completed} done
              </span>
              {stats.failed > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-100 bg-rose-50 px-2 py-1 font-medium text-rose-700">
                  {stats.failed} failed
                </span>
              )}
            </div>

            <div
              className="hidden items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 md:flex"
              aria-hidden
            >
              <span>Ingest</span>
              <ArrowRight className="h-3 w-3" />
              <span>Route</span>
              <ArrowRight className="h-3 w-3" />
              <span>Execute</span>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div
            ref={meshRef}
            className="relative flex h-full min-h-0 min-w-[920px] flex-1 overflow-visible"
          >
            <aside className="relative z-10 flex w-[min(100%,320px)] shrink-0 flex-col border-r border-slate-200/70 bg-slate-50/95">
              <IngestionQueue
                orders={state.orders}
                selectedOrderId={selectedOrderId}
                onSelectOrder={setSelectedOrderId}
                meshFocusOrderId={displayOrder?.orderId ?? null}
              />
            </aside>

            <main className="relative z-10 min-w-0 flex-1 bg-slate-50/40">
              <div className="flex h-full min-h-0 flex-col border-x border-slate-200/40 bg-white/30">
                {/* <p className="shrink-0 border-b border-slate-100 bg-white/80 px-4 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  2 · Route
                </p> */}
                <div className="min-h-0 flex-1">
                  <OrchestratorHub
                    isActive={state.orchestrator.isActive}
                    currentAction={state.orchestrator.currentAction}
                    targetClusterId={state.orchestrator.targetClusterId}
                    meshOrderId={displayOrder?.orderId ?? null}
                  />
                </div>
              </div>
            </main>

            <aside className="relative z-10 flex w-[min(100%,420px)] shrink-0 flex-col border-l border-slate-200/70 bg-white">
              <SwarmNodesPanel
                clusters={state.clusters}
                activeConnections={state.activeConnections}
                allRunsComplete={allRunsComplete}
                selectedOrderId={displayOrder?.orderId ?? selectedOrderId}
                focusedOrder={displayOrder}
              />
            </aside>

            {/* After columns so z-30 draws on top; pointer-events-none keeps panels clickable */}
            <MeshFlowOverlay
              paths={paths}
              activeClusterId={activeClusterId}
              flowActive={flowActive}
              flowTokenLabel={queueFlowFocusOrderId ?? ''}
              hubFlowTokenLabel={
                displayOrder && displayOrder.status !== 'pending'
                  ? displayOrder.orderId
                  : (queueFlowFocusOrderId ?? '')
              }
            />
          </div>
        </div>
      </div>
    </Layout>
  )
}
