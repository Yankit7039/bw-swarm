import { useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Layout } from '../../components/layout/Layout'
import { useExecutionMesh } from './hooks/useExecutionMesh'
import { IngestionQueue } from './components/IngestionQueue'
import { OrchestratorHub } from './components/OrchestratorHub'
import { SwarmNodesPanel } from './components/SwarmNodesPanel'

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

  const { state, isLoading, allRunsComplete } = useExecutionMesh({
    templateId: params?.templateId || '',
    prefix: params?.prefix || 'ORD-',
    start: params?.start || 1,
    count: params?.count || 10,
    startedAt: params?.startedAt,
    selectedOrderId,
  })

  if (!params) {
    return (
      <Layout>
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="text-center">
            <p className="text-lg text-slate-500">Missing or invalid visualization parameters.</p>
            <Link to="/test-runs" className="mt-4 inline-flex items-center gap-2 text-primary hover:underline">
              <ArrowLeft className="w-4 h-4" />
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
            <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
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
          background: rgba(79, 70, 229, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(79, 70, 229, 0.2);
        }
      `}</style>
      <div className="h-[calc(100vh-4rem)] flex flex-col bg-[#F8FAFC]">
        {/* Clean Header */}
        <header className="bg-slate-50 border-slate-200 px-4 py-6">
          <div className="flex items-center justify-between">
            {/* Left: Back + Title */}
            {/* <div className="flex items-center gap-3">
              <Link
                to="/test-runs"
                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <h1 className="text-sm font-semibold text-slate-900">
                  {params.name || 'Execution Mesh'}
                </h1>
                <p className="text-xs text-slate-500">
                  {templateName} · {params.count} orders
                </p>
              </div>
            </div> */}

            {/* Center: Stats */}
            {/* <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Total</span>
                <span className="text-sm font-semibold text-slate-900">{stats.total}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-xs text-slate-500">Running</span>
                <span className="text-sm font-semibold text-indigo-600">{stats.running}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-slate-500">Completed</span>
                <span className="text-sm font-semibold text-emerald-600">{stats.completed}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-xs text-slate-500">Failed</span>
                <span className="text-sm font-semibold text-rose-600">{stats.failed}</span>
              </div>
            </div> */}

            {/* Right: Controls */}
            {/* <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors"
                style={{
                  backgroundColor: isPaused ? '#fef3c7' : '#f8fafc',
                  borderColor: isPaused ? '#fcd34d' : '#e2e8f0',
                  color: isPaused ? '#b45309' : '#64748b',
                }}
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={() => window.location.reload()}
                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div> */}
          </div>

          {/* Progress Bar */}
          {/* <div className="mt-3 flex items-center gap-3">
            <Activity className="w-4 h-4 text-slate-400" />
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${stats.progress}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-600 w-12 text-right">
              {stats.progress.toFixed(0)}%
            </span>
          </div> */}
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Queue */}
          <div className="w-80 bg-slate-50 border-r border-slate-200/60 shrink-0 shadow-sm">
            <IngestionQueue
              orders={state.orders}
              selectedOrderId={selectedOrderId}
              onSelectOrder={setSelectedOrderId}
            />
          </div>

          {/* Center: Orchestrator */}
          <div className="flex-1 relative overflow-hidden mt-[-170px]">
            <OrchestratorHub
              isActive={state.orchestrator.isActive}
              currentAction={state.orchestrator.currentAction}
              activeConnections={state.activeConnections}
            />
          </div>

          {/* Right: Swarm Nodes */}
          <div className="w-[420px] bg-slate-50/80 border-l border-slate-200/60 shrink-0 shadow-sm">
            <SwarmNodesPanel
              clusters={state.clusters}
              activeConnections={state.activeConnections}
              allRunsComplete={allRunsComplete}
              selectedOrderId={selectedOrderId}
            />
          </div>
        </div>
      </div>
    </Layout>
  )
}
