import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { PipelineEdge, type PipelineEdgeData } from '../../components/PipelineEdge'
import { PipelineNode } from '../../components/PipelineNode'
import type { ActiveRunDot } from '../../utils/buildGraphFromYaml'
import {
  buildGraphFromYaml,
  extractStageMeta,
  type PipelineLogTicker,
  type PipelineNodeData,
} from '../../utils/buildGraphFromYaml'
import {
  COMPLETED_DWELL_MS,
  computeLogicalNodeId,
  EDGE_TRAVEL_MS,
  findEdgeBetween,
} from '../../utils/flowRunDisplay'
import { fetchTemplateDetailYaml, parseTemplateYaml, type FlowRunEvent } from '../../utils/flowApi'
import {
  buildWorkflowReplaySchedule,
  sampleWorkflowReplay,
  staticTickerSample,
  type ReplaySchedule,
} from '../../utils/workflowReplaySchedule'
import {
  groupMappedEventsByNode,
  mapRunEventsToGraphNodes,
  type MappedRunEvent,
  type RunEventForWorkflowMap,
} from '../../utils/mapEventsToWorkflowNodes'
import type { Run } from '../../types/common'
import { runPayloadPrimaryRef } from '../../utils/runPayloadLabel'
import { Play } from 'lucide-react'
import '../FlowPage.css'

const nodeTypes = { pipeline: PipelineNode }
const edgeTypes = { pipeline: PipelineEdge }

function dotLabelFromRun(run: Run): string {
  return runPayloadPrimaryRef(run.payload as Record<string, unknown>) || run.run_id.slice(0, 8)
}

function dotStatusForRun(run: Run): ActiveRunDot['status'] {
  const s = run.status.toLowerCase()
  if (s === 'completed') return 'completed'
  if (s === 'waiting_for_followup') return 'waiting_for_followup'
  return 'running'
}

function cloneEventsByGraphNode(m: Map<string, MappedRunEvent[]>): Map<string, MappedRunEvent[]> {
  const n = new Map<string, MappedRunEvent[]>()
  for (const [k, v] of m) n.set(k, [...v])
  return n
}

function FlowCanvasInner({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const { fitView } = useReactFlow()

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      fitView({ padding: 0.06, duration: 200, maxZoom: 1.5 })
    })
    return () => cancelAnimationFrame(id)
  }, [nodes, edges, fitView])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      minZoom={0.2}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
      defaultEdgeOptions={{
        style: { strokeWidth: 2 },
      }}
    >
      <Background variant={BackgroundVariant.Dots} gap={12} size={2} color="#e2e8f0" />
      <Controls position="bottom-right" />
    </ReactFlow>
  )
}

export interface RunDetailPipelineFlowProps {
  run: Run
  flowEvents: FlowRunEvent[]
  eventsDataUpdatedAt?: number
}

export function RunDetailPipelineFlow({ run, flowEvents, eventsDataUpdatedAt }: RunDetailPipelineFlowProps) {
  const { data: yamlText = '', isPending: yamlPending, dataUpdatedAt: yamlUpdatedAt } = useQuery({
    queryKey: ['run-workflow-yaml', run.template_id],
    queryFn: async () => (await fetchTemplateDetailYaml(run.template_id)) ?? '',
    enabled: !!run.template_id,
  })

  const parsed = useMemo(() => {
    if (!yamlText) return null
    try {
      return parseTemplateYaml(yamlText)
    } catch {
      return null
    }
  }, [yamlText])

  const yamlError = !!(yamlText && !parsed)

  const stageMeta = useMemo(
    () => (parsed ? extractStageMeta(parsed) : { main: [], loop: [], all: [] }),
    [parsed],
  )

  const { nodes: baseNodes, edges: baseEdges } = useMemo(() => {
    if (!parsed) return { nodes: [] as Node<PipelineNodeData>[], edges: [] as Edge[] }
    return buildGraphFromYaml(parsed)
  }, [parsed])

  const mappedEvents = useMemo(
    () => mapRunEventsToGraphNodes(flowEvents as RunEventForWorkflowMap[]),
    [flowEvents],
  )
  const eventsByGraphNode = useMemo(() => groupMappedEventsByNode(mappedEvents), [mappedEvents])

  const runStatusLower = run.status.toLowerCase()
  const eligibleForReplay =
    !!parsed && (runStatusLower === 'completed' || runStatusLower === 'failed')

  const [replayStarted, setReplayStarted] = useState(false)
  const [replayDone, setReplayDone] = useState(false)
  const replayBundleRef = useRef<{ schedule: ReplaySchedule; byNode: Map<string, MappedRunEvent[]> } | null>(
    null,
  )
  const replayMsRef = useRef(0)
  const [replayPulse, setReplayPulse] = useState(0)

  if (!replayStarted) {
    replayBundleRef.current = null
  } else if (replayBundleRef.current === null) {
    const byNode = cloneEventsByGraphNode(eventsByGraphNode)
    replayBundleRef.current = {
      schedule: buildWorkflowReplaySchedule(stageMeta.all, byNode),
      byNode,
    }
  }

  useEffect(() => {
    setReplayStarted(false)
    setReplayDone(false)
  }, [run.run_id])

  const startTimelineReplay = useCallback(() => {
    setReplayDone(false)
    setReplayStarted(false)
    queueMicrotask(() => setReplayStarted(true))
  }, [])

  useEffect(() => {
    if (!replayStarted) return undefined
    const bundle = replayBundleRef.current
    if (!bundle) return undefined
    let cancelled = false
    replayMsRef.current = 0
    const t0 = performance.now()
    const totalMs = bundle.schedule.totalMs
    const frame = (now: number) => {
      if (cancelled) return
      const elapsed = now - t0
      replayMsRef.current = Math.min(totalMs, elapsed)
      setReplayPulse((x) => x + 1)
      if (elapsed < totalMs) {
        requestAnimationFrame(frame)
      } else {
        setReplayDone(true)
      }
    }
    const raf = requestAnimationFrame(frame)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [replayStarted, run.run_id])

  const inReplay = !!(eligibleForReplay && replayStarted && !replayDone)

  const replaySample = useMemo(() => {
    if (!inReplay || !replayBundleRef.current) return null
    const b = replayBundleRef.current
    return sampleWorkflowReplay(b.schedule, b.byNode, replayMsRef.current)
  }, [inReplay, replayPulse])

  const [tick, setTick] = useState(0)

  const baseDisplayRuns = useMemo(() => {
    const now = Date.now()
    const r = run
    const s = r.status.toLowerCase()
    if (['running', 'waiting_for_followup'].includes(s)) return [r]
    if (s === 'completed') {
      const ca = r.completed_at ? new Date(r.completed_at).getTime() : now
      if (now - ca < COMPLETED_DWELL_MS) return [r]
    }
    return []
  }, [run, tick])

  const displayRuns = useMemo(() => {
    if (inReplay) return [run]
    return baseDisplayRuns
  }, [inReplay, baseDisplayRuns, run])

  useEffect(() => {
    if (displayRuns.length === 0) return
    const id = setInterval(() => setTick((t) => t + 1), 100)
    return () => clearInterval(id)
  }, [displayRuns.length])

  const firstSeenRef = useRef<Map<string, number>>(new Map())
  const [firstSeenVersion, setFirstSeenVersion] = useState(0)

  useEffect(() => {
    if (displayRuns.length === 0) return
    let changed = false
    const now = Date.now()
    for (const r of displayRuns) {
      if (!firstSeenRef.current.has(r.run_id)) {
        firstSeenRef.current.set(r.run_id, now)
        changed = true
      }
    }
    if (changed) setFirstSeenVersion((v) => v + 1)
  }, [displayRuns])

  const logicalNodeByRun = useMemo(() => {
    const m = new Map<string, string | null>()
    const now = Date.now()
    for (const r of displayRuns) {
      const fs = firstSeenRef.current.get(r.run_id)
      m.set(r.run_id, computeLogicalNodeId(r, flowEvents, stageMeta, now, fs))
    }
    return m
  }, [displayRuns, flowEvents, stageMeta, firstSeenVersion, tick])

  const logicalKey = useMemo(
    () =>
      [...logicalNodeByRun.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join('|'),
    [logicalNodeByRun],
  )

  const prevLogicalRef = useRef<Map<string, string>>(new Map())
  const animRef = useRef<Map<string, { from: string; to: string; start: number }>>(new Map())
  const [animPulse, setAnimPulse] = useState(0)

  useLayoutEffect(() => {
    if (inReplay) return
    let started = false
    for (const [runId, nodeId] of logicalNodeByRun) {
      if (!nodeId) continue
      const prev = prevLogicalRef.current.get(runId)
      if (prev !== undefined && prev !== nodeId) {
        animRef.current.set(runId, { from: prev, to: nodeId, start: Date.now() })
        started = true
      }
      prevLogicalRef.current.set(runId, nodeId)
    }
    for (const k of [...prevLogicalRef.current.keys()]) {
      if (!logicalNodeByRun.has(k)) prevLogicalRef.current.delete(k)
    }
    if (started) setAnimPulse((x) => x + 1)
  }, [inReplay, logicalKey, logicalNodeByRun])

  useEffect(() => {
    if (displayRuns.length === 0 || inReplay) return
    let cancelled = false
    let raf = 0
    const loop = () => {
      if (cancelled) return
      const now = Date.now()
      let hasAnim = false
      for (const [, a] of animRef.current) {
        if (now - a.start < EDGE_TRAVEL_MS) hasAnim = true
      }
      if (hasAnim) {
        setAnimPulse((x) => x + 1)
        raf = requestAnimationFrame(loop)
      }
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [displayRuns.length, inReplay, logicalKey])

  const { runToNodeDots, edgeDotsByEdgeId } = useMemo(() => {
    const dotsByNode = new Map<string, ActiveRunDot[]>()
    const edgeMap = new Map<string, NonNullable<PipelineEdgeData['dots']>>()
    const now = Date.now()

    for (const r of displayRuns) {
      const orderId = dotLabelFromRun(r)
      const dot: ActiveRunDot = {
        runId: r.run_id,
        orderId,
        status: dotStatusForRun(r),
      }

      if (inReplay && replaySample) {
        const ea = replaySample.edgeAnim
        if (ea) {
          const edge = findEdgeBetween(baseEdges, ea.from, ea.to)
          if (edge) {
            const list = edgeMap.get(edge.id) ?? []
            list.push({ ...dot, t: ea.t })
            edgeMap.set(edge.id, list)
          }
        } else if (replaySample.logicalNodeId) {
          const list = dotsByNode.get(replaySample.logicalNodeId) ?? []
          list.push(dot)
          dotsByNode.set(replaySample.logicalNodeId, list)
        }
        continue
      }

      const nodeId = logicalNodeByRun.get(r.run_id)
      if (!nodeId) continue

      const anim = animRef.current.get(r.run_id)
      let onEdge: { edgeId: string; t: number } | null = null

      if (anim && now - anim.start < EDGE_TRAVEL_MS) {
        const t = Math.min(1, (now - anim.start) / EDGE_TRAVEL_MS)
        const edge = findEdgeBetween(baseEdges, anim.from, anim.to)
        if (edge) onEdge = { edgeId: edge.id, t }
      }

      if (onEdge) {
        const list = edgeMap.get(onEdge.edgeId) ?? []
        list.push({ ...dot, t: onEdge.t })
        edgeMap.set(onEdge.edgeId, list)
      } else {
        const list = dotsByNode.get(nodeId) ?? []
        list.push(dot)
        dotsByNode.set(nodeId, list)
      }
    }

    return { runToNodeDots: dotsByNode, edgeDotsByEdgeId: edgeMap }
  }, [
    displayRuns,
    inReplay,
    replaySample,
    logicalNodeByRun,
    baseEdges,
    logicalKey,
    tick,
    animPulse,
  ])

  const edgesWithDots = useMemo(
    () =>
      baseEdges.map((e) => {
        const dots = edgeDotsByEdgeId.get(e.id)
        const data: PipelineEdgeData = { ...(e.data as PipelineEdgeData | undefined), dots: dots ?? [] }
        return { ...e, data }
      }),
    [baseEdges, edgeDotsByEdgeId],
  )

  const logTickerByNode = useMemo(() => {
    const graphIds = new Set(baseNodes.map((n) => n.id))
    const m = new Map<string, PipelineLogTicker>()

    const filterToGraph = (sample: ReturnType<typeof sampleWorkflowReplay>) => {
      for (const [nodeId, row] of sample.tickerByNode) {
        if (!graphIds.has(nodeId)) continue
        if (!row.text) continue
        m.set(nodeId, {
          text: row.text,
          tone: row.tone,
          animKey: row.animKey,
          dimmed: row.dimmed,
        })
      }
    }

    if (inReplay && replaySample) {
      filterToGraph(replaySample)
      return m
    }

    if (eligibleForReplay && replayDone) {
      filterToGraph(staticTickerSample(eventsByGraphNode))
      return m
    }

    const isLiveTickerWindow =
      runStatusLower === 'running' ||
      runStatusLower === 'waiting_for_followup' ||
      runStatusLower === 'failed' ||
      (runStatusLower === 'completed' && !replayStarted)

    if (isLiveTickerWindow) {
      let dotHostId: string | null = null
      for (const [nodeId, dots] of runToNodeDots) {
        if (dots.some((d) => d.runId === run.run_id)) {
          dotHostId = nodeId
          break
        }
      }
      if (dotHostId && graphIds.has(dotHostId)) {
        const list = eventsByGraphNode.get(dotHostId)
        const last = list?.[list.length - 1]
        if (last) {
          m.set(dotHostId, {
            text: last.line,
            tone: last.tone,
            animKey: last.id ?? `${last.created_at}:${last.event_type}`,
            dimmed: false,
          })
        }
      }
    }

    return m
  }, [
    baseNodes,
    inReplay,
    replaySample,
    eligibleForReplay,
    replayDone,
    eventsByGraphNode,
    runStatusLower,
    replayStarted,
    run.run_id,
    runToNodeDots,
  ])

  const nodesWithDots = useMemo(
    () =>
      baseNodes.map((n) => {
        const extra = runToNodeDots.get(n.id)
        const ticker = logTickerByNode.get(n.id)
        const hasDots = !!extra?.length
        const hasTicker = !!ticker
        if (!hasDots && !hasTicker) {
          const { logTicker: _lt, activeRuns: _ar, ...rest } = n.data
          return { ...n, data: { ...rest } as PipelineNodeData }
        }
        const next: PipelineNodeData = { ...n.data }
        if (hasDots) next.activeRuns = extra
        else delete next.activeRuns
        if (hasTicker) next.logTicker = ticker
        else delete next.logTicker
        return { ...n, data: next }
      }),
    [baseNodes, runToNodeDots, logTickerByNode],
  )

  const lastEventsPoll = useMemo(() => {
    if (!eventsDataUpdatedAt) return '—'
    return new Date(eventsDataUpdatedAt).toLocaleTimeString()
  }, [eventsDataUpdatedAt])

  const lastYamlPoll = useMemo(() => {
    if (!yamlUpdatedAt) return '—'
    return new Date(yamlUpdatedAt).toLocaleTimeString()
  }, [yamlUpdatedAt])

  const referenceLabel =
    runPayloadPrimaryRef(run.payload as Record<string, unknown>) || '—'
  const templateShort =
    run.template_id.length > 28 ? `${run.template_id.slice(0, 28)}…` : run.template_id

  const runStatusLabel = useMemo(() => {
    const s = run.status.toLowerCase()
    if (s === 'running') return 'Running'
    if (s === 'completed') return 'Completed'
    if (s === 'failed') return 'Failed'
    if (s === 'waiting_for_followup') return 'Waiting'
    return run.status
  }, [run.status])

  return (
    <div className="flow-page run-detail-pipeline-flow h-[min(640px,calc(100dvh-18rem))] min-h-[420px] max-h-[78vh] rounded-2xl border border-[#e8ecf1] bg-[#fafbfc] shadow-[0_12px_40px_-12px_rgba(42,52,57,0.08)]">
      <div className="flow-page__toolbar run-detail-pipeline-flow__toolbar">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Template</span>
            <span className="truncate font-mono text-sm font-semibold text-slate-800" title={run.template_id}>
              {templateShort}
            </span>
          </div>
          <div className="hidden h-8 w-px bg-slate-200 sm:block" />
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Reference</span>
            <span className="font-mono text-sm font-semibold text-slate-700">{referenceLabel}</span>
          </div>
          <div className="hidden h-8 w-px bg-slate-200 sm:block" />
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</span>
            <span className="text-sm font-bold text-violet-700">{runStatusLabel}</span>
          </div>
          {eligibleForReplay && !inReplay ? (
            <>
              <div className="hidden h-8 w-px bg-slate-200 sm:block" />
              <div className="flex min-w-0 flex-col items-stretch gap-0.5 sm:items-end sm:ml-auto">
                <button
                  type="button"
                  onClick={startTimelineReplay}
                  title="Replays this run’s stored events on the graph—nothing is re-executed."
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                >
                  <Play className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                  {replayDone ? 'Play timeline again' : 'Play timeline'}
                </button>
                <span className="hidden text-[10px] leading-tight text-slate-400 sm:block sm:max-w-[14rem] sm:text-right">
                  Uses events already recorded for this run.
                </span>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="flow-page__canvas-wrap">
        {!run.template_id ? (
          <div className="flow-page__warning">
            <h2>No template</h2>
            <p>This run is not linked to a template id, so the workflow graph cannot be loaded.</p>
          </div>
        ) : yamlPending ? (
          <div className="flex min-h-[50vh] flex-1 items-center justify-center text-slate-500 text-sm">Loading…</div>
        ) : !yamlText.trim() ? (
          <div className="flow-page__warning">
            <h2>No workflow YAML</h2>
            <p>This template has no workflow YAML. Add YAML in the template definition to see the pipeline.</p>
          </div>
        ) : yamlError ? (
          <div className="flow-page__warning">
            <h2>Invalid YAML</h2>
            <p>This template’s workflow YAML could not be parsed. Fix the YAML in the template definition.</p>
          </div>
        ) : !parsed ? (
          <div className="flow-page__warning">
            <h2>Template not available</h2>
            <p>No workflow YAML could be loaded for this template.</p>
          </div>
        ) : (
          <ReactFlowProvider>
            <div className="flow-page__rf-root">
              <FlowCanvasInner nodes={nodesWithDots} edges={edgesWithDots} />
            </div>
          </ReactFlowProvider>
        )}
      </div>

      <div className="flow-page__status">
        <span className="text-slate-400">
          Events: <strong className="text-slate-600">{lastEventsPoll}</strong>
          <span className="text-slate-400"> · YAML: </span>
          <strong className="text-slate-600">{lastYamlPoll}</strong>
        </span>
      </div>
    </div>
  )
}
