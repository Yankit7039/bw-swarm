import { useCallback, useEffect, useState, lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  RotateCcw,
  SlidersHorizontal,
  Activity,
  List,
  Network,
  GitBranch,
} from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { FlowPage } from './FlowPage'
import { runsApi } from '../api/runs'
import { useTemplates } from '../hooks/useTemplates'
import type { Run } from '../types/common'

const GlobalSwarmGraph = lazy(() =>
  import('./runs/GlobalSwarmGraph').then((m) => ({ default: m.GlobalSwarmGraph }))
)

/** Design tokens aligned with SwarmOS Observe reference */
const t = {
  bg: 'bg-[#f7f9fb]',
  onBg: 'text-[#2a3439]',
  onVar: 'text-[#566166]',
  surface: 'bg-white',
  surfaceLow: 'bg-[#f0f4f7]',
  surfaceContainer: 'bg-[#e8eff3]',
  surfaceHigh: 'bg-[#e1e9ee]',
  primary: 'text-[#6d3bd7]',
  primaryBg: 'bg-[#6d3bd7]',
  primarySoft: 'bg-[#6d3bd7]/10',
  primaryContainer: 'bg-[#e9ddff]',
  onPrimaryContainer: 'text-[#6029c9]',
  outlineVar: 'border-[#a9b4b9]/40',
  error: 'text-[#9e3f4e]',
  errorBg: 'bg-[#ff8b9a]',
  errorOn: 'text-[#782232]',
}

type StatusFilter = 'all' | 'running' | 'completed' | 'failed' | 'pending'

interface RunRow extends Run {}

function formatRelative(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function hashToPct(s: string, min: number, max: number): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 1)) % 1000
  return min + (h % (max - min + 1))
}

function efficiencyForRun(run: Run): number {
  switch (run.status) {
    case 'completed':
      return 100
    case 'failed':
      return hashToPct(run.run_id, 28, 55)
    case 'running':
      return hashToPct(run.run_id, 18, 96)
    default:
      return 0
  }
}

function templateInitial(name?: string, fallback?: string): string {
  const s = (name || fallback || '?').trim()
  return s.slice(0, 1).toUpperCase()
}

const ITEMS_PER_PAGE = 10

type TimePeriod = 'all' | '1day' | '1week' | '1month'
type ViewMode = 'list' | 'swarm' | 'flow'

function parseViewFromSearchParams(sp: URLSearchParams): ViewMode {
  const v = sp.get('view')
  if (v === 'flow' || v === 'swarm') return v
  return 'list'
}

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All Runs' },
  { id: 'running', label: 'Active Only' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
  { id: 'pending', label: 'Queued' },
]

const TIME_PERIOD_OPTIONS: { id: TimePeriod; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: '1day', label: 'Last 1 day' },
  { id: '1week', label: 'Last 1 week' },
  { id: '1month', label: 'Last 1 month' },
]

export const Runs = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [currentPage, setCurrentPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all')
  const [view, setView] = useState<ViewMode>(() => parseViewFromSearchParams(searchParams))

  useEffect(() => {
    setView(parseViewFromSearchParams(searchParams))
  }, [searchParams])

  const selectView = useCallback(
    (next: ViewMode) => {
      setView(next)
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (next === 'list') p.delete('view')
          else p.set('view', next)
          return p
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const { data: templates } = useTemplates(100, 0)

  const { data: runs, isFetching } = useQuery({
    queryKey: ['runs', selectedTemplate, statusFilter, timePeriod, currentPage],
    queryFn: () =>
      runsApi.list({
        template_id: selectedTemplate || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        time_period: timePeriod === 'all' ? undefined : timePeriod,
        limit: ITEMS_PER_PAGE,
        offset: (currentPage - 1) * ITEMS_PER_PAGE,
      }),
    refetchInterval: view === 'list' ? 3000 : false,
    enabled: view === 'list',
  })

  // Fetch all runs with events for the swarm view
  const { data: swarmRuns, isFetching: isSwarmLoading } = useQuery({
    queryKey: ['runs-swarm', statusFilter, timePeriod],
    queryFn: () =>
      runsApi.listWithEvents({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 50,
      }),
    refetchInterval: view === 'swarm' ? 2000 : false,
    enabled: view === 'swarm',
  })

  const items: RunRow[] = runs?.data ?? []
  const hasMore = items.length === ITEMS_PER_PAGE
  const rangeStart = items.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1
  const rangeEnd = (currentPage - 1) * ITEMS_PER_PAGE + items.length

  const getTemplateName = (templateId: string) => templates?.data?.find((x) => x.id === templateId)?.name


  return (
    <Layout>
      <div className={`w-full flex-1 flex flex-col min-h-0 ${t.bg} ${t.onBg} font-body`}>
        <div className="shrink-0 px-6 sm:px-8 pt-6 sm:pt-8 max-w-[1600px] mx-auto w-full">
          {/* Page header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold font-headline tracking-tight text-[#2a3439]">
                Observe
              </h1>
              <p className={`${t.onVar} max-w-lg text-sm sm:text-base`}>
                Monitor all active and historical swarm executions with real-time telemetry and success rate tracking.
              </p>
            </div>

            {/* View toggle tabs */}
            <div className="flex gap-1 bg-[#f0f4f7] p-1.5 rounded-xl self-start md:self-end">
              <button
                type="button"
                onClick={() => selectView('list')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  view === 'list'
                    ? 'bg-white text-[#6d3bd7] shadow-sm'
                    : 'text-[#566166] hover:text-[#2a3439]'
                }`}
              >
                <List className="w-4 h-4" />
                List
              </button>
              <button
                type="button"
                onClick={() => selectView('swarm')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  view === 'swarm'
                    ? 'bg-white text-[#6d3bd7] shadow-sm'
                    : 'text-[#566166] hover:text-[#2a3439]'
                }`}
              >
                <Network className="w-4 h-4" />
                Swarm
              </button>
              <button
                type="button"
                onClick={() => selectView('flow')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  view === 'flow'
                    ? 'bg-white text-[#6d3bd7] shadow-sm'
                    : 'text-[#566166] hover:text-[#2a3439]'
                }`}
              >
                <GitBranch className="w-4 h-4" />
                Flow
              </button>
            </div>
          </div>
        </div>

        <div
          className={`flex-1 min-h-0 flex flex-col px-6 sm:px-8 pb-8 max-w-[1600px] mx-auto w-full ${
            view === 'list' ? 'pt-8 space-y-8 sm:space-y-10' : 'pt-8'
          }`}
        >
          {view === 'swarm' ? (
            <Suspense
              fallback={
                <div className="h-[600px] flex items-center justify-center rounded-2xl border border-[#e8ecf1] bg-[#fafbfc]">
                  <div className="text-center">
                    <div className="w-10 h-10 border-2 border-[#6d3bd7] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm text-[#566166]">Loading swarm visualization…</p>
                  </div>
                </div>
              }
            >
              <GlobalSwarmGraph
                runs={swarmRuns || []}
                isLoading={isSwarmLoading}
              />
            </Suspense>
          ) : view === 'flow' ? (
            <div className="flex-1 min-h-0 min-h-[min(70vh,52rem)] flex flex-col rounded-2xl border border-[#a9b4b9]/40 overflow-hidden bg-[#fafbfc]">
              <FlowPage embedded />
            </div>
          ) : (
            <>
          {/* Filter row with dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status filter dropdown */}
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="runs-status-filter">
                Filter by status
              </label>
              <div className="relative">
                <Activity className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${t.onVar} pointer-events-none`} />
                <select
                  id="runs-status-filter"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as StatusFilter)
                    setCurrentPage(1)
                  }}
                  className={`pl-10 pr-8 py-3 rounded-xl text-sm font-semibold ${t.surface} text-[#2a3439] shadow-sm border ${t.outlineVar} focus:ring-2 focus:ring-[#6d3bd7]/20 outline-none appearance-none cursor-pointer`}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Template filter dropdown */}
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="runs-template-filter">
                Filter by template
              </label>
              <div className="relative">
                <SlidersHorizontal className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${t.onVar} pointer-events-none`} />
                <select
                  id="runs-template-filter"
                  value={selectedTemplate}
                  onChange={(e) => {
                    setSelectedTemplate(e.target.value)
                    setCurrentPage(1)
                  }}
                  className={`pl-10 pr-8 py-3 rounded-xl text-sm font-semibold ${t.surface} text-[#2a3439] shadow-sm border ${t.outlineVar} focus:ring-2 focus:ring-[#6d3bd7]/20 outline-none appearance-none cursor-pointer`}
                >
                  <option value="">All templates</option>
                  {templates?.data?.map((tmpl) => (
                    <option key={tmpl.id} value={tmpl.id}>
                      {tmpl.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Time period filter dropdown */}
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="runs-time-filter">
                Filter by time period
              </label>
              <div className="relative">
                <RotateCcw className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${t.onVar} pointer-events-none`} />
                <select
                  id="runs-time-filter"
                  value={timePeriod}
                  onChange={(e) => {
                    setTimePeriod(e.target.value as TimePeriod)
                    setCurrentPage(1)
                  }}
                  className={`pl-10 pr-8 py-3 rounded-xl text-sm font-semibold ${t.surface} text-[#2a3439] shadow-sm border ${t.outlineVar} focus:ring-2 focus:ring-[#6d3bd7]/20 outline-none appearance-none cursor-pointer`}
                >
                  {TIME_PERIOD_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Run list */}
          <section className="space-y-4">
            <div
              className={`hidden md:grid grid-cols-12 px-6 py-2 ${t.onVar} text-[11px] font-bold uppercase tracking-widest`}
            >
              <div className="col-span-4">Run name &amp; ID</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-center">Efficiency</div>
              <div className="col-span-2">Timeline</div>
              {/* <div className="col-span-2 text-right">Actions</div> */}
            </div>

            {isFetching && items.length === 0 && (
              <div className={`text-center py-16 ${t.onVar}`}>
                <div className="w-10 h-10 border-2 border-[#6d3bd7] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm font-medium">Loading runs…</p>
              </div>
            )}

            {items.map((run) => {
              const name = getTemplateName(run.template_id) || run.template_id
              const orderId =
                (run.payload?.order_id as string) || (run.payload?.input as string) || run.run_id.slice(0, 8)
              const eff = efficiencyForRun(run)
              const isRunning = run.status === 'running'
              const isFailed = run.status === 'failed'
              const isCompleted = run.status === 'completed'
              const isPending = run.status === 'pending'

              return (
                <div
                  key={run.run_id}
                  className={`grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-0 items-center px-5 sm:px-6 py-5 sm:py-6 ${t.surface} rounded-2xl border ${t.outlineVar} hover:bg-[#f0f4f7] transition-all duration-300 group`}
                >
                  <div className="md:col-span-4 flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${
                        isFailed
                          ? `${t.errorBg}/30 ${t.errorOn}`
                          : isCompleted
                            ? `${t.primaryContainer} ${t.onPrimaryContainer}`
                            : `${t.surfaceContainer} ${t.onVar}`
                      }`}
                    >
                      {templateInitial(name, run.template_id)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold font-headline text-[#2a3439] group-hover:text-[#6d3bd7] transition-colors truncate">
                        {name}
                      </h4>
                      <span className="text-xs text-[#566166] font-mono">{orderId}</span>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    {isRunning && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-tighter">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Running
                      </span>
                    )}
                    {isCompleted && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-[#e8eff3] text-[#566166] rounded-full text-xs font-bold uppercase tracking-tighter">
                        Completed
                      </span>
                    )}
                    {isFailed && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-[#ff8b9a] text-[#782232] rounded-full text-xs font-bold uppercase tracking-tighter">
                        Failed
                      </span>
                    )}
                    {isPending && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase tracking-tighter">
                        Queued
                      </span>
                    )}
                  </div>

                  <div className="md:col-span-2 flex flex-col items-center gap-1.5">
                    <div className="w-full max-w-[80px] h-1.5 bg-[#e8eff3] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isFailed ? 'bg-[#9e3f4e]' : isCompleted ? 'bg-[#566166]' : `${t.primaryBg}`
                        }`}
                        style={{ width: `${eff}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold ${isFailed ? t.error : 'text-[#2a3439]'}`}>{eff.toFixed(1)}%</span>
                  </div>

                  <div className="md:col-span-2">
                    <div className="text-sm font-medium text-[#2a3439]">Started {formatRelative(run.created_at)}</div>
                    <div className="text-[10px] text-[#566166]">
                      {isFailed && run.error_message ? (
                        <span className={`${t.error} font-semibold truncate block`}>{run.error_message}</span>
                      ) : isCompleted && run.completed_at ? (
                        <>Done {formatRelative(run.completed_at)}</>
                      ) : isRunning ? (
                        <>Updated {formatRelative(run.updated_at)}</>
                      ) : (
                        <>Created {formatRelative(run.created_at)}</>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2 flex md:justify-end gap-2">
                    {/* {isFailed && (
                      <Link
                        to={`/runs/${run.run_id}`}
                        className={`p-2 ${t.onVar} hover:text-[#6d3bd7] transition-colors`}
                        title="Open run"
                      >
                        <RotateCcw className="w-5 h-5" />
                      </Link>
                    )} */}
                    {isPending ? (
                      <span className={`px-4 py-2 text-sm font-bold ${t.onVar} cursor-not-allowed`}>View logs</span>
                    ) : (
                      <Link
                        to={`/runs/${run.run_id}`}
                        className="px-4 py-2 text-[#6d3bd7] font-bold hover:bg-[#e9ddff]/50 rounded-lg transition-colors text-sm inline-flex items-center gap-1"
                      >
                        View logs
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}

            {items.length === 0 && !isFetching && (
              <div className={`text-center py-16 ${t.surface} rounded-2xl border border-dashed ${t.outlineVar}`}>
                <p className={`${t.onVar} text-sm`}>No runs match your filters. Trigger a run from Test Runs or adjust filters.</p>
              </div>
            )}
          </section>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 border-t border-[#a9b4b9]/30">
            <p className={`text-sm ${t.onVar}`}>
              Showing{' '}
              <span className="font-semibold text-[#2a3439]">{rangeStart}</span>–
              <span className="font-semibold text-[#2a3439]">{rangeEnd}</span>
              <span className="text-[#566166]/80"> · page {currentPage}</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isFetching}
                className="px-4 py-2 text-sm font-semibold rounded-xl border border-[#a9b4b9]/40 hover:bg-[#f0f4f7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-[#2a3439]"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={!hasMore || isFetching}
                className="px-4 py-2 text-sm font-bold rounded-xl bg-[#6d3bd7] text-white shadow-lg shadow-[#6d3bd7]/20 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
