import { useEffect, useMemo } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock, CheckCircle, AlertCircle, Zap } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { runsApi } from '../api/runs'
import type { Run } from '../types/common'
import { RunFlowGraph } from './bulk-viz/RunFlowGraph'
import { useRunStore, buildEventsForStages } from '../store/bulkViz/runStore'

interface BulkVizParams {
  templateId: string
  prefix: string
  start: number
  count: number
  startedAt?: string
}

type RunStage = 'queue' | 'ingestion' | 'orchestrator' | 'completed' | 'failed'

interface OrderState {
  orderId: string
  stage: RunStage
  runId?: string
  status?: string
}

function useBulkVizParams(): BulkVizParams | null {
  const location = useLocation()
  const search = new URLSearchParams(location.search)

  const templateId = search.get('templateId') || ''
  const prefix = search.get('prefix') || 'ORD-'
  const start = Number(search.get('start') || '1')
  const count = Number(search.get('count') || '10')
  const startedAt = search.get('startedAt') || undefined

  if (!templateId || !Number.isFinite(start) || !Number.isFinite(count)) {
    return null
  }

  return { templateId, prefix, start, count, startedAt }
}

function buildExpectedOrderIds(params: BulkVizParams): string[] {
  const ids: string[] = []
  for (let i = 0; i < params.count; i++) {
    const num = params.start + i
    ids.push(`${params.prefix}${num.toString().padStart(3, '0')}`)
  }
  return ids
}

function classifyStage(run: Run | null): RunStage {
  if (!run) return 'queue'
  const status = run.status
  if (status === 'completed') return 'completed'
  if (status === 'failed') return 'failed'
  return 'ingestion'
}

export function BulkVisualization() {
  const params = useBulkVizParams()

  const { data: runsData } = useQuery({
    queryKey: ['bulk-viz-runs', params?.templateId],
    enabled: !!params?.templateId,
    queryFn: () =>
      runsApi.list({
        template_id: params?.templateId,
        limit: 500,
      }),
    refetchInterval: (query) => {
      const items = (query.state.data as { data: Run[] } | undefined)?.data || []
      const allFinal = items.every((r) => r.status === 'completed' || r.status === 'failed')
      return allFinal ? false : 2000
    },
  })

  const expectedOrderIds = params ? buildExpectedOrderIds(params) : []
  const allRuns = runsData?.data || []

  const orderStates: OrderState[] = useMemo(() => {
    if (!params) return []

    return expectedOrderIds.map((orderId) => {
      const matchingRun = allRuns.find((r) => r.payload?.order_id === orderId)
      const stage = classifyStage(matchingRun || null)
      return {
        orderId,
        stage,
        runId: matchingRun?.run_id,
        status: matchingRun?.status,
      }
    })
  }, [params, expectedOrderIds, allRuns])

  const totalRuns = expectedOrderIds.length

  // Initialize replay store when orderStates change (simple linear stages)
  const enqueueRuns = useRunStore((s) => s.enqueueRuns)
  useEffect(() => {
    if (!orderStates.length) return

    const runsToEnqueue = orderStates.map((o) => {
      const stages: RunStage[] = ['queue', 'ingestion', 'orchestrator']
      const finalStage: RunStage = o.status === 'failed' ? 'failed' : 'completed'
      stages.push(finalStage)

      return {
        runId: o.runId || o.orderId,
        label: o.orderId,
        events: buildEventsForStages(o.runId || o.orderId, stages),
      }
    })

    enqueueRuns(runsToEnqueue)
  }, [orderStates, enqueueRuns])

  if (!params) {
    return (
      <Layout>
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="text-center">
            <p className="text-lg text-slate-500">Missing or invalid visualization parameters.</p>
            <Link
              to="/test-runs"
              className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Test Runs
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  const completedCount = orderStates.filter((o) => o.stage === 'completed').length
  const failedCount = orderStates.filter((o) => o.stage === 'failed').length
  const runningCount = orderStates.filter((o) => o.stage === 'ingestion' || o.stage === 'orchestrator').length
  const queueCount = orderStates.filter((o) => o.stage === 'queue').length

  const progress =
    totalRuns > 0 ? ((completedCount + failedCount) / totalRuns) * 100 : 0

  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/test-runs"
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  <h1 className="text-xl font-bold text-slate-900">
                    Bulk Run Visualization
                  </h1>
                </div>
                <p className="text-sm text-slate-500">
                  Template: <span className="font-mono">{params.templateId}</span> •{' '}
                  {totalRuns} runs • prefix {params.prefix} • interval{' '}
                  {new URLSearchParams(window.location.search).get('intervalMs') || '—'}ms
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-xs text-slate-500">Queue</p>
                <p className="text-lg font-bold text-slate-900">{queueCount}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-indigo-600">Running</p>
                <p className="text-lg font-bold text-indigo-600">{runningCount}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-emerald-600">Completed</p>
                <p className="text-lg font-bold text-emerald-600">{completedCount}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-rose-600">Failed</p>
                <p className="text-lg font-bold text-rose-600">{failedCount}</p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-600">Overall Progress</span>
              <span className="font-medium text-slate-900">
                {progress.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-indigo-500 to-emerald-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </header>

        {/* Flow graph */}
        <div className="flex-1 relative">
          <RunFlowGraph />
        </div>

        {/* Footer: per-run list */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 max-h-52 overflow-y-auto">
          <h3 className="text-sm font-bold text-slate-900 mb-3">
            Runs ({totalRuns} configured)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {orderStates.map((o) => (
              <div
                key={o.orderId}
                className={`p-2 rounded-lg border text-xs ${
                  o.stage === 'completed'
                    ? 'bg-emerald-50 border-emerald-200'
                    : o.stage === 'failed'
                    ? 'bg-rose-50 border-rose-200'
                    : o.stage === 'running'
                    ? 'bg-indigo-50 border-indigo-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {o.stage === 'completed' && (
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                  )}
                  {o.stage === 'failed' && (
                    <AlertCircle className="w-3 h-3 text-rose-500" />
                  )}
                  {o.stage === 'running' && (
                    <Clock className="w-3 h-3 text-indigo-500" />
                  )}
                  {o.stage === 'queue' && (
                    <Clock className="w-3 h-3 text-slate-400" />
                  )}
                  <span className="font-mono font-medium truncate">
                    {o.orderId}
                  </span>
                </div>
                {o.runId && (
                  <Link
                    to={`/runs/${o.runId}`}
                    className="mt-1 text-[10px] text-primary hover:underline block"
                  >
                    View run →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}

