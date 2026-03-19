import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowLeft,
  Play,
  RotateCcw,
  Pause,
  Clock,
  CheckCircle,
  AlertCircle,
  Layers,
} from 'lucide-react'
import { Layout } from '../../components/layout/Layout'
import { bulkRunSessionsApi } from '../../api/bulkRunSessions'
import { useTemplates } from '../../hooks/useTemplates'
import { WorkflowNode } from './components/WorkflowNode'
import { AnimatedEdge } from './components/AnimatedEdge'
import { useBulkRunSimulation, type WorkflowStep } from './hooks/useBulkRunSimulation'
import type { BulkRunSession } from '../../types/bulkRunSession'

const nodeTypes = { workflow: WorkflowNode as unknown as React.FC }
const edgeTypes = { animated: AnimatedEdge }

// Build workflow steps from template definition
function buildWorkflowSteps(session: BulkRunSession | null): WorkflowStep[] {
  if (!session?.template_id) return []

  // Default workflow steps if we can't get template definition
  return [
    { id: 'start', name: 'Start', type: 'start' },
    { id: 'ingestion', name: 'Ingestion', type: 'agent' },
    { id: 'orchestrator', name: 'Orchestrator', type: 'agent' },
    { id: 'processing', name: 'Processing', type: 'agent' },
    { id: 'completion', name: 'Completion', type: 'end' },
  ]
}

// Build nodes for ReactFlow
function buildNodes(
  workflowSteps: WorkflowStep[],
  nodesState: Record<string, { status: string; count: number; totalRuns: number }>,
  totalRuns: number
): Node[] {
  const nodes: Node[] = []
  const spacing = 250
  const startX = 0
  const centerY = 300

  workflowSteps.forEach((step, index) => {
    const state = nodesState[step.id] || { status: 'pending', count: 0, totalRuns }

    nodes.push({
      id: step.id,
      type: 'workflow',
      position: { x: startX + index * spacing, y: centerY },
      data: {
        label: step.name,
        sublabel: step.type.toUpperCase(),
        type: step.type,
        status: state.status,
        count: state.count,
        totalRuns,
      },
    })
  })

  return nodes
}

// Build edges for ReactFlow
function buildEdges(
  workflowSteps: WorkflowStep[],
  edgeParticles: Record<string, { id: string; progress: number; color: string; orderId: string }[]>,
  activeEdgeIds: Set<string>
): Edge[] {
  const edges: Edge[] = []

  for (let i = 0; i < workflowSteps.length - 1; i++) {
    const source = workflowSteps[i].id
    const target = workflowSteps[i + 1].id
    const edgeId = `e-${source}-${target}`

    edges.push({
      id: edgeId,
      source,
      target,
      type: 'animated',
      data: {
        particles: edgeParticles[edgeId] || [],
        isActive: activeEdgeIds.has(edgeId),
      },
    })
  }

  return edges
}

export function BulkRunVisualization() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const rfRef = useRef<ReactFlowInstance | null>(null)
  const [hasStarted, setHasStarted] = useState(false)

  // Fetch session data
  const { data: session, isLoading } = useQuery<BulkRunSession>({
    queryKey: ['bulk-run-session', sessionId],
    queryFn: () => bulkRunSessionsApi.get(sessionId || ''),
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const data = query.state.data as BulkRunSession | undefined
      return data && data.status === 'running' ? 2000 : false
    },
  })

  // Fetch template name
  const { data: templates } = useTemplates()
  const templateName = useMemo(() => {
    if (!session?.template_id || !templates?.data) return 'Unknown Template'
    const template = templates.data.find((t) => t.id === session.template_id)
    return template?.name || session.template_id
  }, [session?.template_id, templates?.data])

  // Build workflow steps
  const workflowSteps = useMemo(() => buildWorkflowSteps(session ?? null), [session])

  // Simulation hook
  const { snapshot, isRunning, startSimulation, stopSimulation, resetSimulation } =
    useBulkRunSimulation({
      session: session ?? null,
      workflowSteps,
    })

  // Build ReactFlow nodes and edges
  const nodes = useMemo(
    () => buildNodes(workflowSteps, snapshot.nodes, session?.config.batch_size || 0),
    [workflowSteps, snapshot.nodes, session?.config.batch_size]
  )

  const edges = useMemo(
    () => buildEdges(workflowSteps, snapshot.edgeParticles, snapshot.activeEdgeIds),
    [workflowSteps, snapshot.edgeParticles, snapshot.activeEdgeIds]
  )

  // Auto-start simulation when session is loaded
  useEffect(() => {
    if (session && !hasStarted) {
      setHasStarted(true)
      startSimulation()
    }
  }, [session, hasStarted, startSimulation])

  // Fit view on init
  const onInit = useCallback((inst: ReactFlowInstance) => {
    rfRef.current = inst
    setTimeout(() => inst.fitView({ padding: 0.2 }), 100)
  }, [])

  // Stats
  const stats = useMemo(() => {
    if (!session) return { total: 0, success: 0, failed: 0, pending: 0, progress: 0 }
    const { stats: s } = session
    const progress = s.total > 0 ? ((s.success + s.failed) / s.total) * 100 : 0
    return { ...s, progress }
  }, [session])

  const formatDuration = () => {
    if (!session?.created_at) return '-'
    const start = new Date(session.created_at)
    const end = session.completed_at ? new Date(session.completed_at) : new Date()
    const diff = end.getTime() - start.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
            <span className="text-lg">Loading visualization...</span>
          </div>
        </div>
      </Layout>
    )
  }

  if (!session) {
    return (
      <Layout>
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="text-center">
            <p className="text-lg text-slate-500">Session not found</p>
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

  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/bulk-run-sessions"
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{session.name || 'Bulk Run'}</h1>
                <p className="text-sm text-slate-500">
                  {templateName} • {session.config.batch_size} runs •{' '}
                  {session.config.interval_ms}ms interval
                </p>
              </div>
              <div
                className={`ml-4 px-3 py-1 rounded-full text-sm font-medium ${
                  session.status === 'running'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : session.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {session.status === 'running' && (
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    Running
                  </span>
                )}
                {session.status === 'completed' && (
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Completed
                  </span>
                )}
                {session.status === 'failed' && (
                  <span className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Failed
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Stats summary */}
              <div className="hidden md:flex items-center gap-4 mr-6">
                <div className="text-center">
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="text-lg font-bold text-slate-900">{stats.total}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-emerald-600">Success</p>
                  <p className="text-lg font-bold text-emerald-600">{stats.success}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-rose-600">Failed</p>
                  <p className="text-lg font-bold text-rose-600">{stats.failed}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500">Duration</p>
                  <p className="text-lg font-bold text-slate-900">{formatDuration()}</p>
                </div>
              </div>

              {/* Controls */}
              <button
                onClick={isRunning ? stopSimulation : startSimulation}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                  isRunning
                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                    : 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20'
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    {hasStarted ? 'Resume' : 'Start'}
                  </>
                )}
              </button>

              <button
                onClick={resetSimulation}
                className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-700 rounded-lg font-medium hover:bg-slate-100 transition border border-slate-200"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-600">Overall Progress</span>
              <span className="font-medium text-slate-900">{stats.progress.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-indigo-500 to-emerald-500"
                style={{ width: `${stats.progress}%` }}
              />
            </div>
          </div>
        </header>

        {/* Flow Visualization */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onInit={onInit}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag
            zoomOnScroll
            minZoom={0.3}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
            fitView
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={0.8}
              color="rgba(99,102,241,0.04)"
            />
            <Controls
              position="bottom-left"
              showInteractive={false}
              fitViewOptions={{ padding: 0.2 }}
            />
            <MiniMap
              position="bottom-right"
              nodeColor={(n) => {
                const d = n.data as { status?: string }
                return d.status === 'completed'
                  ? '#10b981'
                  : d.status === 'running'
                  ? '#6366f1'
                  : d.status === 'failed'
                  ? '#f43f5e'
                  : '#94a3b8'
              }}
              maskColor="rgba(99, 102, 241, 0.08)"
            />
            <svg>
              <defs>
                <filter id="particleGlow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
            </svg>
          </ReactFlow>
        </div>

        {/* Footer - Run list */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 max-h-48 overflow-y-auto">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Run Details ({session.runs.length} total)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {session.runs.map((run) => (
              <div
                key={run.order_id}
                className={`p-2 rounded-lg border text-xs ${
                  run.status === 'success'
                    ? 'bg-emerald-50 border-emerald-200'
                    : run.status === 'failed'
                    ? 'bg-rose-50 border-rose-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {run.status === 'success' ? (
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                  ) : run.status === 'failed' ? (
                    <AlertCircle className="w-3 h-3 text-rose-500" />
                  ) : (
                    <Clock className="w-3 h-3 text-slate-400" />
                  )}
                  <span className="font-mono font-medium truncate">{run.order_id}</span>
                </div>
                {run.run_id && (
                  <Link
                    to={`/runs/${run.run_id}`}
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
