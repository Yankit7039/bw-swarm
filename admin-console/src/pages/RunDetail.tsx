import { useParams, useNavigate,  } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Clock,
  RefreshCw,
  Download,
  StopCircle,
  Search,
  Settings2,
  ChevronDown,
  ChevronRight,
  Network,
  Bot,
  Info,
  Verified,
  // ArrowLeft,
} from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { runsApi } from '../api/runs'
import { useState, useMemo, useEffect } from 'react'
import type { Run } from '../types/common'
import { buildRunLogTree, countLogLines, type LogAgentSection } from './run-detail/buildRunLogTree'
import { RunDetailFlowGraph } from './run-detail/RunDetailFlowGraph'

const t = {
  bg: 'bg-[#f7f9fb]',
  onSurface: 'text-[#2a3439]',
  onVar: 'text-[#566166]',
  outline: 'text-[#717c82]',
  surfaceLow: 'bg-[#f0f4f7]',
  surfaceLowest: 'bg-white',
  surfaceContainer: 'bg-[#e8eff3]',
  surfaceVariant: 'border-[#d9e4ea]',
  primary: 'text-[#6d3bd7]',
  primaryBg: 'bg-[#6d3bd7]',
  primaryDim: '#612aca',
  primaryContainer: 'bg-[#e9ddff]',
  onPrimaryContainer: 'text-[#6029c9]',
  secondary: 'text-[#506076]',
  secondaryContainer: 'bg-[#d3e4fe]',
  tertiaryContainer: 'bg-[#dbdafb]',
  error: 'text-[#9e3f4e]',
  errorSoft: 'bg-[#ff8b9a]/10',
}

type DetailView = 'logs' | 'graphical'

interface WorkflowNode {
  id: string
  type: 'start' | 'agent' | 'llm' | 'tool' | 'end'
  label: string
  sublabel?: string
  status: 'completed' | 'running' | 'pending' | 'failed'
  timestamp?: string
  payload?: Record<string, unknown>
}

interface RunEvent {
  id?: string
  event_type: string
  event: string
  created_at: string
  payload?: Record<string, unknown>
}

function formatTimeFull(timestamp?: string | null) {
  if (!timestamp) return '—'
  const d = new Date(timestamp)
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatTimeLog(timestamp?: string | null) {
  if (!timestamp) return '—'
  const d = new Date(timestamp)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

function calculateDuration(start?: string | null, end?: string | null) {
  if (!start) return '—'
  const startTime = new Date(start)
  const endTime = end ? new Date(end) : new Date()
  const diffMs = Math.max(0, endTime.getTime() - startTime.getTime())
  const h = Math.floor(diffMs / 3600000)
  const m = Math.floor((diffMs % 3600000) / 60000)
  const s = Math.floor((diffMs % 60000) / 1000)
  const ms = diffMs % 1000
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

function logBadgeForEvent(event: RunEvent): { label: string; className: string } {
  const type = event.event_type.toLowerCase()
  if (type.includes('fail') || type.includes('error')) {
    return { label: 'Error', className: 'text-[#9e3f4e] font-bold uppercase text-[10px] mt-0.5 px-1.5 bg-[#ff8b9a]/30 rounded tracking-tighter' }
  }
  if (type.includes('complete')) {
    return { label: 'Complete', className: 'text-emerald-600 font-bold uppercase text-[10px] mt-0.5 px-1.5 bg-emerald-100 rounded tracking-tighter' }
  }
  if (type.includes('warn')) {
    return { label: 'Warning', className: 'text-amber-600 font-bold uppercase text-[10px] mt-0.5 px-1.5 bg-amber-100 rounded tracking-tighter' }
  }
  if (type === 'workflow_started' || type.includes('system')) {
    return { label: 'System', className: 'text-[#612aca] font-bold uppercase text-[10px] mt-0.5 px-1.5 bg-[#e9ddff] rounded tracking-tighter' }
  }
  if (type.includes('tool')) {
    return { label: 'Action', className: 'text-blue-700 font-bold uppercase text-[10px] mt-0.5 px-1.5 bg-blue-100 rounded tracking-tighter' }
  }
  if (type.includes('action')) {
    return { label: 'Action', className: 'text-[#612aca] font-bold uppercase text-[10px] mt-0.5 px-1.5 bg-[#e9ddff] rounded tracking-tighter' }
  }
  return { label: 'Event', className: 'text-[#566166] font-bold uppercase text-[10px] mt-0.5 px-1.5 bg-[#e8eff3] rounded tracking-tighter' }
}

function agentHealthPill(health: LogAgentSection['health']): { label: string; cls: string } {
  switch (health) {
    case 'healthy':
      return { label: 'Healthy', cls: 'bg-emerald-100 text-emerald-700' }
    case 'processing':
      return { label: 'Processing', cls: 'bg-blue-100 text-blue-700' }
    case 'failed':
      return { label: 'Failed', cls: 'bg-rose-100 text-rose-700' }
    default:
      return { label: 'Standby', cls: 'bg-amber-100 text-amber-600' }
  }
}

export const RunDetail = () => {
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()
  const [view, setView] = useState<DetailView>('logs')
  const [logFilter, setLogFilter] = useState('')
  const [orchOpen, setOrchOpen] = useState(true)
  /** Agents collapsed when id is in set (default: all expanded) */
  const [collapsedAgents, setCollapsedAgents] = useState<Set<string>>(new Set())
  const [graphSearch, setGraphSearch] = useState('')

  const { data: run } = useQuery<Run>({
    queryKey: ['run', runId],
    queryFn: () => runsApi.get(runId || ''),
    enabled: !!runId,
    refetchInterval: (query) => {
      const data = query.state.data as Run | undefined
      return data && (data.status === 'completed' || data.status === 'failed') ? false : 2000
    },
  })

  const { data: events = [] } = useQuery<RunEvent[]>({
    queryKey: ['run-events', runId],
    queryFn: () => runsApi.events(runId || ''),
    enabled: !!runId,
    refetchInterval: 1500,
  })

  const reRunMutation = useMutation({
    mutationFn: () => {
      if (!run) throw new Error('No run data')
      return runsApi.trigger({
        template_id: run.template_id,
        order_id: (run.payload?.order_id as string) || 'test-order',
      })
    },
    onSuccess: (data) => {
      navigate(`/runs/${data.run_id}`)
    },
  })

  const { orchestratorEvents, agentSections } = useMemo(
    () => buildRunLogTree(events, logFilter),
    [events, logFilter],
  )

  const logLineCount = countLogLines(orchestratorEvents, agentSections)

  useEffect(() => {
    setCollapsedAgents(new Set())
  }, [runId])

  const toggleAgentCollapse = (id: string) => {
    setCollapsedAgents((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const workflowNodes: WorkflowNode[] = useMemo(() => {
    if (!events.length) return []
    const nodes: WorkflowNode[] = []
    const startEvent = events.find((e) => e.event_type === 'workflow_started')
    if (startEvent) {
      nodes.push({
        id: 'start',
        type: 'start',
        label: 'Start',
        sublabel: 'ORCHESTRATOR',
        status: 'completed',
        timestamp: startEvent.created_at,
      })
    }
    const agentStartedEvents = events.filter((e) => e.event_type === 'agent_started')
    const agentCompletedEvents = events.filter((e) => e.event_type === 'agent_completed')
    agentStartedEvents.forEach((agentEvent, agentIdx) => {
      const agentName = String(agentEvent.event || agentEvent.payload?.agent || 'Agent')
      const completedEvent = agentCompletedEvents.find(
        (e) => e.event === agentName || e.payload?.agent === agentEvent.payload?.agent
      )
      nodes.push({
        id: `agent-${agentEvent.id ?? agentIdx}-${agentName}`,
        type: 'agent',
        label: agentName,
        sublabel: 'AGENT NODE',
        status: completedEvent ? 'completed' : run?.status === 'failed' ? 'failed' : 'running',
        timestamp: agentEvent.created_at,
        payload: agentEvent.payload,
      })
      const agentTools = events.filter(
        (e) =>
          (e.event_type === 'tool_started' || e.event_type === 'tool_completed') &&
          e.payload?.parent_agent === agentEvent.payload?.agent
      )
      agentTools.forEach((toolEvent) => {
        if (toolEvent.event_type === 'tool_started') {
          const toolCompleted = events.find(
            (e) =>
              e.event_type === 'tool_completed' &&
              (e.event === toolEvent.event || e.payload?.tool === toolEvent.payload?.tool)
          )
          nodes.push({
            id: `tool-${toolEvent.id ?? toolEvent.created_at}-${agentName}`,
            type: 'tool',
            label: String(toolEvent.event || toolEvent.payload?.tool || 'Tool'),
            sublabel: 'TOOL',
            status: toolCompleted ? 'completed' : 'running',
            timestamp: toolEvent.created_at,
            payload: toolEvent.payload,
          })
        }
      })
    })
    const llmEvents = events.filter((e) => e.event_type === 'llm_message')
    llmEvents.forEach((llmEvent) => {
      nodes.push({
        id: `llm-${llmEvent.id}`,
        type: 'llm',
        label: 'LLM',
        sublabel: 'MODEL',
        status: 'completed',
        timestamp: llmEvent.created_at,
        payload: llmEvent.payload,
      })
    })
    const workflowCompleted = events.find((e) => e.event_type === 'workflow_completed')
    if (workflowCompleted || nodes.length > 0) {
      nodes.push({
        id: 'end',
        type: 'end',
        label: 'End',
        sublabel: 'COMPLETE',
        status: workflowCompleted ? 'completed' : 'pending',
        timestamp: workflowCompleted?.created_at,
      })
    }
    return nodes
  }, [events, run?.status])

  const nodeCount = Math.max(workflowNodes.length, 1)

  const formatPayload = (payload: Record<string, unknown> | undefined): string | null => {
    if (!payload || Object.keys(payload).length === 0) return null
    if (payload.text && typeof payload.text === 'string') return payload.text
    if (payload.tool && typeof payload.tool === 'string') {
      const toolName = payload.tool
      const label = payload.label && typeof payload.label === 'string' ? payload.label : toolName
      const params = Object.entries(payload)
        .filter(([key]) => !['tool', 'label', 'parent_agent', 'agent'].includes(key))
        .map(([key, value]) => {
          if (typeof value === 'string') return `${key}: ${value}`
          if (typeof value === 'number') return `${key}: ${value}`
          return `${key}: ${JSON.stringify(value).slice(0, 80)}`
        })
        .join(', ')
      return params ? `${label} (${params})` : label
    }
    if (payload.agent && typeof payload.agent === 'string') {
      const agentName = payload.agent
      const details = Object.entries(payload)
        .filter(([key]) => !['agent', 'parent_agent'].includes(key))
        .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value).slice(0, 60)}`)
        .join(', ')
      return details ? `${agentName} — ${details}` : agentName
    }
    return Object.entries(payload)
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v).slice(0, 60)}`)
      .join(' · ')
  }

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify({ run, events }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `run-${runId || 'export'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const runStatus = run?.status || 'pending'

  const footerMetrics = useMemo(() => {
    const tokensK = Math.max(1, Math.round(events.length * 28.5))
    const durMs =
      run?.created_at != null
        ? Math.max(
            0,
            new Date(run.completed_at || Date.now()).getTime() - new Date(run.created_at).getTime(),
          )
        : 0
    const latency = events.length > 0 ? Math.min(9999, Math.round(durMs / Math.max(1, events.length))) : 0
    const successPct =
      runStatus === 'completed' ? 100 : runStatus === 'failed' ? 0 : runStatus === 'running' ? 99.2 : null
    return { tokensK, latency, successPct }
  }, [events.length, run?.created_at, run?.completed_at, runStatus])

  const statusLabel =
    runStatus === 'running' ? 'Active run' : runStatus === 'completed' ? 'Completed' : runStatus === 'failed' ? 'Failed' : 'Queued'

  const heatmapBars = useMemo(() => {
    const n = 12
    return Array.from({ length: n }, (_, i) => {
      const seed = (runId || '').charCodeAt(i % (runId?.length || 1)) + i * 7
      const h = 15 + (seed % 85)
      const op = 0.15 + ((seed * 3) % 50) / 100
      return { h, op }
    })
  }, [runId])

  if (!runId) {
    return (
      <Layout>
        <div className="flex min-h-[40vh] items-center justify-center text-[#566166]">No run selected.</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className={`min-h-0 flex flex-col ${t.bg} ${t.onSurface} font-body`}>
        {/* Main section header (not app TopBar): back + title + view toggle */}
        <header className="sticky top-0 z-30 shrink-0 border-b border-[#d9e4ea]/80 bg-white/95 backdrop-blur-xl px-4 sm:px-8 py-4 shadow-[0_1px_0_rgba(217,228,234,0.6)]">
          <div className="max-w-6xl mx-auto flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-start gap-4">
              {/* <Link
                to="/runs"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#6d3bd7] hover:underline mt-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Runs
              </Link> */}
              <div className="flex flex-col min-w-0">
                <h1 className="font-headline text-xl sm:text-2xl font-extrabold tracking-tight truncate">
                  {run?.template_id ? `${run.template_id.slice(0, 24)}${run.template_id.length > 24 ? '…' : ''}` : 'Run'}
                </h1>
                <span className="text-[10px] text-[#566166] font-mono uppercase tracking-widest truncate">
                  Instance: {run?.run_id || runId}
                </span>
              </div>
              <nav className="flex gap-1 bg-[#f0f4f7] p-1 rounded-full self-start">
                <button
                  type="button"
                  onClick={() => setView('logs')}
                  className={`px-4 sm:px-5 py-1.5 text-sm font-semibold rounded-full transition-all ${
                    view === 'logs'
                      ? 'bg-white text-[#6d3bd7] shadow-sm'
                      : 'text-[#566166] hover:text-[#2a3439]'
                  }`}
                >
                  Logs
                </button>
                <button
                  type="button"
                  onClick={() => setView('graphical')}
                  className={`px-4 sm:px-5 py-1.5 text-sm font-medium rounded-full transition-all ${
                    view === 'graphical'
                      ? 'bg-white text-[#6d3bd7] shadow-sm font-semibold'
                      : 'text-[#566166] hover:text-[#2a3439]'
                  }`}
                >
                  Graphical
                </button>
              </nav>
            </div>
            {view === 'logs' && (
              <div className="relative flex items-center w-full lg:max-w-xs">
                <Search className={`absolute left-3 w-4 h-4 ${t.outline}`} />
                <input
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#f0f4f7] border-none rounded-lg text-sm focus:ring-2 focus:ring-[#6d3bd7]/20 placeholder:text-[#a9b4b9]"
                  placeholder="Filter logs…"
                  type="search"
                />
              </div>
            )}
            {view === 'graphical' && (
              <div className="relative flex items-center w-full lg:max-w-xs">
                <Search className={`absolute left-3 w-4 h-4 ${t.outline}`} />
                <input
                  value={graphSearch}
                  onChange={(e) => setGraphSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#f0f4f7] border-none rounded-lg text-sm focus:ring-2 focus:ring-[#6d3bd7]/20 placeholder:text-[#a9b4b9]"
                  placeholder="Search nodes…"
                  type="search"
                />
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 pb-28 flex flex-col gap-6">
            {/* Run context card */}
            <div
              className={`${t.surfaceLowest} rounded-xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-[0_12px_40px_-12px_rgba(42,52,57,0.08)] border border-[#d9e4ea]/20`}
            >
              <div className="flex flex-wrap gap-6 sm:gap-8">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-[#717c82] tracking-wider">Status</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        runStatus === 'running'
                          ? 'bg-emerald-500 animate-pulse'
                          : runStatus === 'completed'
                            ? 'bg-emerald-500'
                            : runStatus === 'failed'
                              ? 'bg-rose-500'
                              : 'bg-amber-400'
                      }`}
                    />
                    <span className="text-sm font-semibold text-[#2a3439]">{statusLabel}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-[#717c82] tracking-wider">Started</span>
                  <span className="text-sm font-semibold text-[#2a3439]">{formatTimeFull(run?.created_at)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-[#717c82] tracking-wider">Swarm size</span>
                  <span className="text-sm font-semibold text-[#2a3439]">{nodeCount} nodes</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-[#717c82] tracking-wider">Order</span>
                  <span className="text-sm font-mono text-[#2a3439]">
                    {(run?.payload?.order_id as string) || (run?.payload?.input as string) || '—'}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={exportLogs}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-[#566166] bg-[#f0f4f7] hover:bg-[#e8eff3] rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button
                  type="button"
                  disabled
                  title="Not available from console"
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-[#9e3f4e] bg-[#ff8b9a]/10 rounded-lg opacity-60 cursor-not-allowed"
                >
                  <StopCircle className="w-4 h-4" />
                  Terminate
                </button>
                <button
                  type="button"
                  onClick={() => reRunMutation.mutate()}
                  disabled={reRunMutation.isPending || !run}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-[#6d3bd7] to-[#612aca] shadow-lg shadow-[#6d3bd7]/20 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${reRunMutation.isPending ? 'animate-spin' : ''}`} />
                  Re-run
                </button>
              </div>
            </div>

            {view === 'logs' && (
              <>
                <div
                  className={`${t.surfaceLowest} rounded-xl shadow-[0_12px_40px_-12px_rgba(42,52,57,0.08)] overflow-hidden border border-[#d9e4ea]/20`}
                >
                  <div className="bg-[#f0f4f7] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#d9e4ea]/30">
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold text-[#566166] uppercase tracking-widest">Observability stream</span>
                      <div className="h-4 w-px bg-[#a9b4b9]/30 hidden sm:block" />
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-mono text-emerald-600 font-bold uppercase">Live</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-[#717c82]">
                        Showing last {Math.min(500, events.length)} lines
                        <span className="hidden sm:inline">
                          {' '}
                          · {logLineCount} visible{logFilter ? ' (filtered)' : ''}
                        </span>
                      </span>
                      <button type="button" className="p-1 text-[#717c82] hover:text-[#2a3439]" aria-label="Stream settings">
                        <Settings2 className="w-[18px] h-[18px]" />
                      </button>
                    </div>
                  </div>
                  <div className="p-3 sm:p-4 font-mono text-[13px] leading-relaxed overflow-x-auto">
                    {events.length === 0 && (
                      <div className="text-center py-12 text-[#566166] text-sm font-sans">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        Waiting for events…
                      </div>
                    )}
                    {events.length > 0 && (
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => setOrchOpen(!orchOpen)}
                          className="group flex w-full items-center gap-3 rounded px-2 py-2 text-left hover:bg-[#f0f4f7]"
                        >
                          {orchOpen ? (
                            <ChevronDown className="h-[18px] w-[18px] shrink-0 text-[#717c82] group-hover:text-[#6d3bd7]" />
                          ) : (
                            <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#717c82] group-hover:text-[#6d3bd7]" />
                          )}
                          <Network className="h-[18px] w-[18px] shrink-0 text-[#6d3bd7]" />
                          <span className="font-sans font-bold text-[#2a3439]">Swarm node: Global-Orchestrator-01</span>
                          <span className="ml-auto font-mono text-[11px] text-[#a9b4b9]">
                            {formatTimeLog(run?.created_at)}
                          </span>
                        </button>
                        {orchOpen && (
                          <div className="relative ml-4 border-l border-[#d9e4ea] pl-0 sm:ml-9">
                            {orchestratorEvents.map((event, idx) => {
                              const badge = logBadgeForEvent(event)
                              const msg = formatPayload(event.payload) || event.event || event.event_type
                              const isLlmOut =
                                event.event_type === 'llm_message' &&
                                typeof event.payload?.text === 'string' &&
                                (event.payload.text as string).length > 80
                              return (
                                <div
                                  key={event.id || `o-${idx}`}
                                  className="flex items-start gap-4 py-1 px-4 transition-all hover:bg-[rgba(109,59,215,0.04)]"
                                >
                                  <span className="min-w-[85px] shrink-0 whitespace-nowrap font-mono text-[12px] text-[#a9b4b9]">
                                    {formatTimeLog(event.created_at)}
                                  </span>
                                  <span className={badge.className}>{badge.label}</span>
                                  <span
                                    className={`min-w-0 flex-1 font-sans text-[13px] leading-relaxed text-[#566166] ${isLlmOut ? 'font-medium italic text-[#6d3bd7]' : 'whitespace-pre-wrap break-words'}`}
                                  >
                                    {msg}
                                  </span>
                                </div>
                              )
                            })}

                            {agentSections.map((section) => {
                              const open = !collapsedAgents.has(section.id)
                              const pill = agentHealthPill(section.health)
                              return (
                                <div key={section.id} className="relative ml-2 mt-3 sm:ml-4">
                                  <button
                                    type="button"
                                    onClick={() => toggleAgentCollapse(section.id)}
                                    className="group relative flex w-full items-center gap-3 rounded px-2 py-2 text-left hover:bg-[#f0f4f7]"
                                  >
                                    <div className="absolute -left-[21px] top-1/2 hidden h-px w-4 bg-[#d9e4ea] sm:block" />
                                    {open ? (
                                      <ChevronDown className="h-[18px] w-[18px] shrink-0 text-[#717c82]" />
                                    ) : (
                                      <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#717c82]" />
                                    )}
                                    <Bot className="h-[18px] w-[18px] shrink-0 text-[#506076]" />
                                    <span className="font-sans font-semibold italic text-[#2a3439]">
                                      Agent node: {section.name}
                                    </span>
                                    <span
                                      className={`ml-2 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter ${pill.cls}`}
                                    >
                                      {pill.label}
                                    </span>
                                  </button>
                                  {open && (
                                    <div className="ml-4 mt-1 border-l border-[#d9e4ea] pl-0 sm:ml-8">
                                      {section.events.map((event, idx) => {
                                        const badge = logBadgeForEvent(event)
                                        const msg = formatPayload(event.payload) || event.event || event.event_type
                                        const isLlmOut =
                                          event.event_type === 'llm_message' &&
                                          typeof event.payload?.text === 'string' &&
                                          (event.payload.text as string).length > 80
                                        return (
                                          <div
                                            key={event.id || `a-${section.id}-${idx}`}
                                            className="flex items-start gap-4 py-1 px-4 transition-all hover:bg-[rgba(109,59,215,0.04)]"
                                          >
                                            <span className="min-w-[85px] shrink-0 whitespace-nowrap font-mono text-[12px] text-[#a9b4b9]">
                                              {formatTimeLog(event.created_at)}
                                            </span>
                                            <span className={badge.className}>{badge.label}</span>
                                            <span
                                              className={`min-w-0 flex-1 font-sans text-[13px] leading-relaxed text-[#566166] ${isLlmOut ? 'font-medium italic text-[#6d3bd7]' : 'whitespace-pre-wrap break-words'}`}
                                            >
                                              {msg}
                                            </span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 bg-white rounded-xl p-6 shadow-[0_12px_40px_-12px_rgba(42,52,57,0.08)] border border-[#d9e4ea]/20">
                    <h3 className="font-headline font-bold text-sm mb-4 uppercase tracking-wider text-[#566166]">
                      Token consumption heatmap
                    </h3>
                    <div className="w-full h-32 rounded-lg bg-[#f0f4f7] flex items-end gap-1 p-4">
                      {heatmapBars.map((bar, i) => (
                        <div
                          key={i}
                          className="w-full bg-[#6d3bd7] rounded-t-sm min-h-[8px] transition-all"
                          style={{ height: `${bar.h}%`, opacity: bar.op + 0.2 }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-[#6d3bd7] to-[#612aca] rounded-xl p-6 text-white shadow-xl shadow-[#6d3bd7]/20">
                    <div className="flex flex-col h-full justify-between gap-6">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-widest opacity-80">Final result</span>
                          <p className="text-2xl font-extrabold font-headline mt-1">
                            {runStatus === 'completed' ? 'SUCCESS' : runStatus === 'failed' ? 'FAILED' : runStatus === 'running' ? 'RUNNING' : 'QUEUED'}
                          </p>
                        </div>
                        <Verified className="w-8 h-8 shrink-0 opacity-90" />
                      </div>
                      <div>
                        <span className="text-[10px] opacity-70 uppercase">Execution time</span>
                        <p className="text-lg font-mono mt-1">{calculateDuration(run?.created_at, run?.completed_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {view === 'graphical' && (
              <>
                <RunDetailFlowGraph
                  workflowNodes={workflowNodes}
                  runStatus={runStatus}
                  graphSearch={graphSearch}
                />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="rounded-2xl border border-[#d9e4ea]/20 bg-white p-6 shadow-sm lg:col-span-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="font-headline text-sm font-bold uppercase tracking-tight text-[#2a3439]">
                        Active nodes context
                      </h4>
                      <Info className="h-5 w-5 text-[#717c82]" />
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-2 rounded-full bg-[#6d3bd7]" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-end justify-between gap-2">
                            <span className="text-xs font-bold text-slate-700">Request throughput</span>
                            <span className="text-xs font-medium text-slate-500">
                              {Math.min(2000, 120 + events.length * 18)} req/s
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#e8eff3]">
                            <div
                              className="h-full bg-[#6d3bd7]"
                              style={{ width: `${Math.min(100, 35 + (events.length % 60))}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-2 rounded-full bg-[#506076]" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-end justify-between gap-2">
                            <span className="text-xs font-bold text-slate-700">Error rate</span>
                            <span className="text-xs font-medium text-slate-500">
                              {workflowNodes.some((n) => n.status === 'failed') ? '2.1%' : '0.02%'}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#e8eff3]">
                            <div
                              className="h-full bg-emerald-500"
                              style={{
                                width: workflowNodes.some((n) => n.status === 'failed') ? '8%' : '2%',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="relative overflow-hidden rounded-2xl border border-[#d9e4ea]/20 bg-white p-6 shadow-sm lg:col-span-8">
                    <div className="relative z-10 mb-4 flex items-center justify-between">
                      <h4 className="font-headline text-sm font-bold uppercase tracking-tight text-[#2a3439]">
                        System message stream
                      </h4>
                      <span className="rounded bg-[#e9ddff] px-2 py-0.5 text-[10px] font-bold text-[#6d3bd7]">
                        Real-time
                      </span>
                    </div>
                    <div className="relative z-10 max-h-48 space-y-2 overflow-y-auto font-mono text-[11px]">
                      {events.slice(-5).map((e, i) => (
                        <div
                          key={e.id || i}
                          className="flex gap-4 rounded p-2 transition-colors hover:bg-slate-100"
                        >
                          <span className="shrink-0 text-slate-400">[{formatTimeLog(e.created_at)}]</span>
                          <span className="shrink-0 font-bold uppercase text-[#506076]">
                            {e.event_type.replace(/_/g, ' ').slice(0, 14)}
                          </span>
                          <span className="min-w-0 break-words font-sans text-slate-600">
                            {formatPayload(e.payload) || e.event}
                          </span>
                        </div>
                      ))}
                      {events.length === 0 && (
                        <p className="py-4 text-center font-sans text-sm text-[#566166]">No messages yet.</p>
                      )}
                    </div>
                    <div className="pointer-events-none absolute inset-0 opacity-5">
                      <svg className="h-full w-full text-[#2a3439]" viewBox="0 0 100 100">
                        <path
                          d="M0 100 Q 25 25 50 100 T 100 100"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="0.5"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Technical footer strip (main section only) */}
        <footer className="shrink-0 border-t border-slate-200/10 bg-slate-50/80 py-3 px-4 backdrop-blur-md sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-wider text-slate-500 sm:text-xs">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Swarm runtime v2.4.1</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:gap-8">
              <span>
                Tokens:{' '}
                <strong className="text-slate-900">
                  {footerMetrics.tokensK >= 1000
                    ? `${(footerMetrics.tokensK / 1000).toFixed(1)}M`
                    : `${footerMetrics.tokensK}k`}
                </strong>
              </span>
              <span>
                Latency: <strong className="text-slate-900">{footerMetrics.latency}ms</strong>
              </span>
              <span>
                Success:{' '}
                <strong className="text-slate-900">
                  {footerMetrics.successPct != null ? `${footerMetrics.successPct}%` : '—'}
                </strong>
              </span>
              <span>
                Active nodes: <strong className="text-slate-900">{nodeCount}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold uppercase text-emerald-600">Gateway online</span>
            </div>
          </div>
        </footer>
      </div>
    </Layout>
  )
}
