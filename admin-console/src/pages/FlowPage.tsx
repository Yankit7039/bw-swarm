import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Layout } from '../components/layout/Layout'
import { PipelineEdge, type PipelineEdgeData } from '../components/PipelineEdge'
import { PipelineNode } from '../components/PipelineNode'
import type { ActiveRunDot } from '../utils/buildGraphFromYaml'
import { useTemplates } from '../hooks/useTemplates'
import { buildGraphFromYaml, extractStageMeta, type PipelineNodeData } from '../utils/buildGraphFromYaml'
import {
  COMPLETED_DWELL_MS,
  computeLogicalNodeId,
  EDGE_TRAVEL_MS,
  findEdgeBetween,
} from '../utils/flowRunDisplay'
import {
  fetchRunEvents,
  fetchRunsForTemplate,
  fetchTemplateDetailYaml,
  parseTemplateYaml,
  templatesWithYaml,
} from '../utils/flowApi'
import type { Run } from '../types/common'
import './FlowPage.css'
import { runPayloadPrimaryRef } from '../utils/runPayloadLabel'

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

function FlowCanvasInner({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const { fitView } = useReactFlow()

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 200 })
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
      <MiniMap
        position="bottom-left"
        maskColor="rgba(15, 23, 42, 0.12)"
        nodeStrokeWidth={2}
        pannable
        zoomable
      />
    </ReactFlow>
  )
}

export function FlowPage() {
  const { data: templatesData, isLoading: templatesLoading } = useTemplates(500, 0)
  const withYaml = useMemo(() => templatesWithYaml(templatesData?.data), [templatesData?.data])

  const [selectedId, setSelectedId] = useState<string>('')

  useEffect(() => {
    if (!selectedId && withYaml.length > 0) {
      setSelectedId(withYaml[0].id)
    }
  }, [selectedId, withYaml])

  const selectedTemplate = withYaml.find((t) => t.id === selectedId)
  const yamlFromList = selectedTemplate?.workflow_yaml?.trim() ?? ''

  const { data: yamlFallback } = useQuery({
    queryKey: ['flow-template-yaml', selectedId],
    queryFn: () => fetchTemplateDetailYaml(selectedId),
    enabled: !!selectedId && !yamlFromList,
  })

  const yamlText = yamlFromList || yamlFallback || ''

  const parsed = useMemo(() => {
    if (!yamlText) return null
    try {
      return parseTemplateYaml(yamlText)
    } catch {
      return null
    }
  }, [yamlText])

  const yamlError = !!(yamlText && !parsed)

  const stageMeta = useMemo(() => (parsed ? extractStageMeta(parsed) : { main: [], loop: [], all: [] }), [parsed])

  const { nodes: baseNodes, edges: baseEdges } = useMemo(() => {
    if (!parsed) return { nodes: [] as Node<PipelineNodeData>[], edges: [] as Edge[] }
    return buildGraphFromYaml(parsed)
  }, [parsed])

  const { data: runsRaw = [], dataUpdatedAt } = useQuery({
    queryKey: ['flow-runs', selectedId],
    queryFn: () => fetchRunsForTemplate(selectedId, 200),
    enabled: !!selectedId && !!parsed,
    refetchInterval: 3000,
  })

  const activeRuns = useMemo(
    () => runsRaw.filter((r) => ['running', 'waiting_for_followup'].includes(r.status.toLowerCase())),
    [runsRaw]
  )

  const firstSeenRef = useRef<Map<string, number>>(new Map())
  const [firstSeenVersion, setFirstSeenVersion] = useState(0)

  useEffect(() => {
    let changed = false
    const now = Date.now()
    for (const r of activeRuns) {
      if (!firstSeenRef.current.has(r.run_id)) {
        firstSeenRef.current.set(r.run_id, now)
        changed = true
      }
    }
    if (changed) setFirstSeenVersion((v) => v + 1)
  }, [activeRuns])

  const [tick, setTick] = useState(0)

  const recentCompleted = useMemo(() => {
    const now = Date.now()
    return runsRaw.filter((r) => {
      if (r.status.toLowerCase() !== 'completed') return false
      const ca = r.completed_at ? new Date(r.completed_at).getTime() : now
      return now - ca < COMPLETED_DWELL_MS
    })
  }, [runsRaw, tick])

  const displayRuns = useMemo(() => {
    const seen = new Set<string>()
    const list: Run[] = []
    for (const r of activeRuns) {
      list.push(r)
      seen.add(r.run_id)
    }
    for (const r of recentCompleted) {
      if (!seen.has(r.run_id)) {
        list.push(r)
        seen.add(r.run_id)
      }
    }
    return list
  }, [activeRuns, recentCompleted])

  useEffect(() => {
    if (displayRuns.length === 0) return
    const id = setInterval(() => setTick((t) => t + 1), 100)
    return () => clearInterval(id)
  }, [displayRuns.length])

  const eventQueries = useQueries({
    queries: activeRuns.map((r) => ({
      queryKey: ['flow-run-events', r.run_id],
      queryFn: () => fetchRunEvents(r.run_id),
      enabled: !!selectedId && !!parsed && activeRuns.length > 0,
      refetchInterval: 3000,
    })),
  })

  const activeRunIndexById = useMemo(() => {
    const m = new Map<string, number>()
    activeRuns.forEach((r, i) => m.set(r.run_id, i))
    return m
  }, [activeRuns])

  const logicalNodeByRun = useMemo(() => {
    const m = new Map<string, string | null>()
    const now = Date.now()
    for (const r of displayRuns) {
      const idx = activeRunIndexById.get(r.run_id)
      const evs = idx !== undefined ? eventQueries[idx]?.data ?? [] : []
      const fs = firstSeenRef.current.get(r.run_id)
      m.set(r.run_id, computeLogicalNodeId(r, evs, stageMeta, now, fs))
    }
    return m
  }, [displayRuns, stageMeta, eventQueries, firstSeenVersion, tick, activeRunIndexById])

  const logicalKey = useMemo(
    () =>
      [...logicalNodeByRun.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join('|'),
    [logicalNodeByRun]
  )

  const prevLogicalRef = useRef<Map<string, string>>(new Map())
  const animRef = useRef<Map<string, { from: string; to: string; start: number }>>(new Map())
  const [animPulse, setAnimPulse] = useState(0)

  useLayoutEffect(() => {
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
  }, [logicalKey, logicalNodeByRun])

  useEffect(() => {
    if (displayRuns.length === 0) return
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
  }, [displayRuns.length, logicalKey])

  const { runToNodeDots, edgeDotsByEdgeId } = useMemo(() => {
    const byNode = new Map<string, ActiveRunDot[]>()
    const edgeMap = new Map<string, NonNullable<PipelineEdgeData['dots']>>()
    const now = Date.now()

    for (const r of displayRuns) {
      const nodeId = logicalNodeByRun.get(r.run_id)
      if (!nodeId) continue

      const anim = animRef.current.get(r.run_id)
      let onEdge: { edgeId: string; t: number } | null = null

      if (anim && now - anim.start < EDGE_TRAVEL_MS) {
        const t = Math.min(1, (now - anim.start) / EDGE_TRAVEL_MS)
        const edge = findEdgeBetween(baseEdges, anim.from, anim.to)
        if (edge) onEdge = { edgeId: edge.id, t }
      }

      const orderId = dotLabelFromRun(r)
      const dot: ActiveRunDot = {
        runId: r.run_id,
        orderId,
        status: dotStatusForRun(r),
      }

      if (onEdge) {
        const list = edgeMap.get(onEdge.edgeId) ?? []
        list.push({ ...dot, t: onEdge.t })
        edgeMap.set(onEdge.edgeId, list)
      } else {
        const list = byNode.get(nodeId) ?? []
        list.push(dot)
        byNode.set(nodeId, list)
      }
    }

    return { runToNodeDots: byNode, edgeDotsByEdgeId: edgeMap }
  }, [displayRuns, logicalNodeByRun, baseEdges, logicalKey, tick, animPulse])

  const edgesWithDots = useMemo(
    () =>
      baseEdges.map((e) => {
        const dots = edgeDotsByEdgeId.get(e.id)
        const data: PipelineEdgeData = { ...(e.data as PipelineEdgeData | undefined), dots: dots ?? [] }
        return { ...e, data }
      }),
    [baseEdges, edgeDotsByEdgeId]
  )

  const nodesWithDots = useMemo(
    () =>
      baseNodes.map((n) => {
        const extra = runToNodeDots.get(n.id)
        if (!extra?.length) return { ...n, data: { ...n.data } }
        return { ...n, data: { ...n.data, activeRuns: extra } }
      }),
    [baseNodes, runToNodeDots]
  )

  const lastPoll = useMemo(() => {
    if (!dataUpdatedAt) return '—'
    return new Date(dataUpdatedAt).toLocaleTimeString()
  }, [dataUpdatedAt])

  const onTemplateChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedId(e.target.value)
  }, [])

  return (
    <Layout>
      <div className="flow-page">
        <div className="flow-page__toolbar">
          <label htmlFor="flow-template-select">Template</label>
          <select
            id="flow-template-select"
            className="flow-page__select"
            value={selectedId}
            onChange={onTemplateChange}
            disabled={templatesLoading || withYaml.length === 0}
          >
            {withYaml.length === 0 ? (
              <option value="">No templates with YAML</option>
            ) : (
              withYaml.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="flow-page__canvas-wrap">
          {templatesLoading || !selectedId ? (
            <div className="flex min-h-[50vh] flex-1 items-center justify-center text-slate-500 text-sm">
              Loading…
            </div>
          ) : withYaml.length === 0 ? (
            <div className="flow-page__warning">
              <h2>No workflow YAML</h2>
              <p>No templates include a workflow YAML in the database. Configure templates in the admin API or add workflow YAML.</p>
            </div>
          ) : yamlError ? (
            <div className="flow-page__warning">
              <h2>Invalid YAML</h2>
              <p>This template’s workflow YAML could not be parsed. Fix the YAML in the template definition.</p>
            </div>
          ) : yamlText && !parsed ? (
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
          <span>
            Active runs: <strong>{activeRuns.length}</strong>
            {selectedId && runsRaw.length > 0 && (
              <span className="text-slate-400"> · {runsRaw.length} total fetched</span>
            )}
          </span>
          <span>
            Last poll: <strong>{lastPoll}</strong>
          </span>
        </div>
      </div>
    </Layout>
  )
}
