import { memo, useMemo, useEffect, useRef, useCallback, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Bot, Wrench, Brain, MessageSquare, Layers, Inbox, Zap, Maximize2, X } from 'lucide-react'
import type { Run } from '../../types/common'

export interface GlobalSwarmRun extends Run {
  events?: SwarmEvent[]
}

export interface SwarmEvent {
  id?: string
  event_type: string
  event: string
  created_at: string
  payload?: Record<string, unknown>
}

interface TemplateBranch {
  templateId: string
  templateName: string
  runs: GlobalSwarmRun[]
  nodes: GroupedNode[]
}

interface GlobalSwarmGraphProps {
  runs: GlobalSwarmRun[]
  isLoading: boolean
}

// Layout constants
const SWARM_X = 400
const QUEUE_X = 50
const QUEUE_ITEM_HEIGHT = 100

// Branch placement configurations
// Positions are relative to swarm center
const BRANCH_SIDES = ['right', 'top', 'bottom', 'right', 'top', 'bottom'] as const
type BranchSide = typeof BRANCH_SIDES[number]

interface NodePosition {
  x: number
  y: number
}

interface BranchPlacement {
  side: BranchSide
  handleId: string
  baseX: number
  baseY: number
  directionX: number
  directionY: number
}

function getBranchPlacement(branchIdx: number, swarmX: number, swarmY: number): BranchPlacement {
  const side = BRANCH_SIDES[branchIdx % BRANCH_SIDES.length]
  // Increased offset for much more spacing between branches
  const offset = 320 + (Math.floor(branchIdx / 3) * 200)

  switch (side) {
    case 'top':
      return {
        side,
        handleId: 'top',
        baseX: swarmX + (branchIdx % 2 === 0 ? -150 : 150), // Wider left/right offset
        baseY: swarmY - offset,
        directionX: 0.3,
        directionY: -1,
      }
    case 'bottom':
      return {
        side,
        handleId: 'bottom',
        baseX: swarmX + (branchIdx % 2 === 0 ? -150 : 150), // Wider left/right offset
        baseY: swarmY + offset,
        directionX: 0.3,
        directionY: 1,
      }
    case 'right':
    default:
      return {
        side,
        handleId: 'right',
        baseX: swarmX + offset,
        baseY: swarmY + (branchIdx % 3 - 1) * 180, // Wider up/down spread: -180, 0, 180
        directionX: 1,
        directionY: 0.2,
      }
  }
}

function calculateScatteredPositions(
  placement: BranchPlacement,
  nodeIdx: number
): NodePosition {
  // Much wider spacing between nodes within a branch
  const spreadDistance = 220
  const perpendicularSpread = 100

  // Main direction spread with more distance
  const mainX = placement.baseX + nodeIdx * spreadDistance * placement.directionX
  const mainY = placement.baseY + nodeIdx * spreadDistance * placement.directionY

  // Reduced jitter to prevent overlap while keeping visual variety
  const jitter = Math.sin(nodeIdx * 0.8) * perpendicularSpread * 0.5

  let x: number
  let y: number

  if (placement.side === 'right') {
    // For right-side branches, spread primarily horizontally with slight vertical variation
    x = mainX + (nodeIdx * 30) // Additional horizontal spacing per node
    y = mainY + jitter
  } else {
    // For top/bottom branches, spread primarily vertically with slight horizontal variation
    x = mainX + jitter
    y = mainY + (nodeIdx * 40) // Additional vertical spacing per node
  }

  return { x, y }
}

const SwarmCenterNode = memo(function SwarmCenterNode(props: NodeProps) {
  const d = props.data as {
    label: string
    sublabel: string
    activeRuns: number
    totalRuns: number
    templateCount: number
  }

  const isActive = d.activeRuns > 0
  const progress = d.totalRuns > 0 ? (d.activeRuns / d.totalRuns) * 100 : 0

  return (
    <>
      {/* Input handle from queue */}
      <Handle type="target" position={Position.Left} id="queue" className="!size-2 !border-2 !border-white !bg-[#94a3b8]" />

      {/* Output handles for branches - positioned at top, right, bottom */}
      <Handle type="source" position={Position.Top} id="top" className="!size-2 !border-2 !border-white !bg-[#94a3b8]" />
      <Handle type="source" position={Position.Right} id="right" className="!size-2 !border-2 !border-white !bg-[#94a3b8]" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!size-2 !border-2 !border-white !bg-[#94a3b8]" />

      <div className="w-[260px] rounded-3xl bg-white p-5 shadow-xl shadow-slate-200/50 border border-slate-100">
        {/* Header with icon and title */}
        <div className="flex items-center gap-4 mb-5">
          {/* Favicon Logo with animated ring */}
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#171717] shadow-lg overflow-hidden">
            {/* Animated ring */}
            {isActive && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute w-full h-full border-2 border-emerald-400/30 rounded-2xl animate-ping" style={{ animationDuration: '2s' }} />
              </div>
            )}
            {/* Favicon SVG */}
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" className="relative z-10">
              <rect width="32" height="32" rx="6" fill="#171717"/>
              <path d="M16.0085 16C16.0085 17.3255 14.9339 18.4 13.6085 18.4C12.283 18.4 11.2085 17.3255 11.2085 16C11.2085 14.6745 12.283 13.6 13.6085 13.6C14.9339 13.6 16.0085 14.6745 16.0085 16Z" fill="#EEEEEE"/>
              <path d="M20.0085 8L26.5882 15.7409C26.7152 15.8903 26.7152 16.1097 26.5882 16.2591L20.0085 24M15.2085 8L21.4086 15.7502C21.5254 15.8962 21.5254 16.1038 21.4086 16.2498L15.2085 24M12.0085 8L5.42868 15.7409C5.3017 15.8903 5.3017 16.1097 5.42868 16.2591L12.0085 24M16.0085 16C16.0085 17.3255 14.9339 18.4 13.6085 18.4C12.283 18.4 11.2085 17.3255 11.2085 16C11.2085 14.6745 12.283 13.6 13.6085 13.6C14.9339 13.6 16.0085 14.6745 16.0085 16Z" stroke="#EEEEEE" strokeWidth="1.14286" strokeLinecap="round"/>
            </svg>
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-800">Swarm Orchestrator</h3>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Processed Orders</p>
          </div>
        </div>

        {/* Wave visualization line */}
        <div className="mb-4 h-8 flex items-end gap-0.5">
          {Array.from({ length: 24 }).map((_, i) => {
            const height = isActive
              ? 20 + Math.sin((i + Date.now() / 200) * 0.5) * 15 + Math.random() * 10
              : 10 + Math.sin(i * 0.3) * 5
            return (
              <div
                key={i}
                className={`flex-1 rounded-full transition-all duration-300 ${isActive ? 'bg-emerald-400/60' : 'bg-slate-200'}`}
                style={{
                  height: `${Math.max(4, Math.min(28, height))}px`,
                  opacity: isActive ? 0.6 + (i % 3) * 0.15 : 0.4,
                }}
              />
            )
          })}
        </div>

        {/* Stats row with circular progress */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Circular progress indicator */}
            <div className="relative h-12 w-12">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                {/* Background circle */}
                <circle cx="18" cy="18" r="16" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                {/* Progress circle */}
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke={isActive ? '#10b981' : '#94a3b8'}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${progress} 100`}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-slate-700">{d.activeRuns}</span>
              </div>
            </div>

            <div>
              <p className="text-2xl font-bold text-slate-800">{d.totalRuns}</p>
              <p className="text-[10px] font-medium text-slate-400">Total Orders</p>
            </div>
          </div>

          {/* Status indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${isActive ? 'bg-emerald-50' : 'bg-slate-50'}`}>
            <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span className={`text-[10px] font-bold uppercase ${isActive ? 'text-emerald-600' : 'text-slate-500'}`}>
              {isActive ? 'Processing' : 'Idle'}
            </span>
          </div>
        </div>
      </div>
    </>
  )
})

const QueueNode = memo(function QueueNode(props: NodeProps) {
  const d = props.data as {
    label: string
    sublabel: string
    count: number
  }

  return (
    <>
      <Handle type="source" position={Position.Right} className="!size-2 !border-2 !border-white !bg-[#94a3b8]" />
      <div className="w-[140px] rounded-2xl bg-white p-4 shadow-lg shadow-slate-200/40 border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
            <Inbox className="h-4 w-4 text-slate-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">{d.label}</h3>
            <p className="text-[11px] font-medium text-slate-400">{d.count} items</p>
          </div>
        </div>
      </div>
    </>
  )
})

const QueueItemNode = memo(function QueueItemNode(props: NodeProps) {
  const d = props.data as {
    label: string
    sublabel: string
    status: string
    templateName: string
  }

  const isRunning = d.status === 'running'

  return (
    <>
      <Handle type="target" position={Position.Left} className="!size-2 !border-2 !border-white !bg-[#94a3b8]" />
      <div className={`w-[140px] rounded-2xl bg-white p-3.5 shadow-lg shadow-slate-200/40 border border-slate-100 transition-all hover:shadow-xl ${isRunning ? 'ring-2 ring-blue-100' : ''}`}>
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isRunning ? 'bg-blue-50' : 'bg-slate-100'}`}>
            <Layers className={`h-3.5 w-3.5 ${isRunning ? 'text-blue-500' : 'text-slate-400'}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800 truncate">{d.label}</h3>
            <p className="text-[10px] text-slate-400 truncate">{d.templateName}</p>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!size-2 !border-2 !border-white !bg-[#94a3b8]" />
    </>
  )
})

const TemplateBranchNode = memo(function TemplateBranchNode(props: NodeProps) {
  const d = props.data as {
    label: string
    runCount: number
    color: string
  }

  return (
    <>
      <Handle type="target" position={Position.Left} className="!size-2 !border-2 !border-white !bg-[#94a3b8]" />
      <div className="w-[160px] rounded-2xl bg-white p-4 shadow-lg shadow-slate-200/40 border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: d.color + '15' }}>
            <Zap className="h-5 w-5" style={{ color: d.color }} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800 truncate">{d.label}</h3>
            <p className="text-[11px] font-medium text-slate-400">{d.runCount} runs</p>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="out" className="!size-2 !border-2 !border-white !bg-[#94a3b8]" />
    </>
  )
})

const BranchWorkerNode = memo(function BranchWorkerNode(props: NodeProps) {
  const [expanded, setExpanded] = useState(false)

  const d = props.data as {
    label: string
    sublabel: string
    kind: string
    status: string
    badgeClass: string
    badgeLabel: string
    runCount: number
    logs?: string[]
  }

  const Icon = d.kind === 'agent' ? Bot : d.kind === 'tool' ? Wrench : d.kind === 'llm' ? Brain : MessageSquare

  const isRunning = d.status === 'running'
  const isCompleted = d.status === 'completed'

  // Modern color scheme matching the design
  const iconBgColor = d.kind === 'agent'
    ? (isRunning ? 'bg-emerald-50' : isCompleted ? 'bg-emerald-50' : 'bg-slate-100')
    : d.kind === 'tool'
      ? 'bg-blue-50'
      : 'bg-violet-50'

  const iconColor = d.kind === 'agent'
    ? (isRunning ? 'text-emerald-500' : isCompleted ? 'text-emerald-500' : 'text-slate-400')
    : d.kind === 'tool'
      ? 'text-blue-500'
      : 'text-violet-500'

  // Status badge colors matching the design
  const badgeBgColor = isCompleted
    ? 'bg-emerald-100 text-emerald-600'
    : isRunning
      ? 'bg-emerald-100 text-emerald-600'
      : 'bg-slate-100 text-slate-500'

  const badgeText = isCompleted
    ? 'DONE'
    : isRunning
      ? 'ACTIVE'
      : d.badgeLabel?.toUpperCase() || 'PENDING'

  // Generate some sample logs if none provided
  const logs = d.logs || [
    `[${new Date().toISOString().split('T')[1].split('.')[0]}] Starting ${d.label}...`,
    `[${new Date().toISOString().split('T')[1].split('.')[0]}] Processing input data`,
    isRunning ? `[${new Date().toISOString().split('T')[1].split('.')[0]}] Executing...` : `[${new Date().toISOString().split('T')[1].split('.')[0]}] Completed`,
  ]

  return (
    <>
      <Handle type="target" position={Position.Left} className="!size-2 !border-2 !border-white !bg-[#94a3b8]" />
      <div className={`w-[180px] rounded-2xl bg-white shadow-lg shadow-slate-200/40 border border-slate-100 overflow-hidden transition-all ${expanded ? 'shadow-xl' : ''}`}>
        {/* Main node content */}
        <div className="p-4">
          {/* Status badge at top right */}
          <div className="flex justify-end mb-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeBgColor}`}>
              {badgeText}
            </span>
          </div>

          <div className="flex items-start gap-3">
            {/* Icon in colored circle */}
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconBgColor}`}>
              <Icon className={`h-4 w-4 ${iconColor}`} />
            </div>

            {/* Title and subtitle */}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-slate-800 truncate leading-tight">{d.label}</h3>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mt-0.5">{d.sublabel}</p>
            </div>
          </div>

          {/* View Logs button */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <span>View Logs</span>
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Expandable logs section */}
        {expanded && (
          <div className="border-t border-slate-100 bg-slate-50/50 p-3 max-h-[100px] overflow-y-auto">
            <div className="space-y-1">
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  className="text-[10px] font-mono text-slate-500 leading-tight"
                >
                  <span className="text-slate-300 mr-1">›</span>{log}
                </div>
              ))}
            </div>
            {isRunning && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-emerald-600 font-medium">Processing...</span>
              </div>
            )}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="out" className="!size-2 !border-2 !border-white !bg-[#94a3b8]" />
    </>
  )
})

const nodeTypes = {
  swarmCenter: SwarmCenterNode,
  queue: QueueNode,
  queueItem: QueueItemNode,
  templateBranch: TemplateBranchNode,
  branchWorker: BranchWorkerNode,
}

function generateTemplateColor(templateId: string): string {
  const colors = ['#6d3bd7', '#506076', '#059669', '#dc2626', '#d97706', '#0891b2', '#7c3aed', '#be185d']
  let hash = 0
  for (let i = 0; i < templateId.length; i++) {
    hash = (hash + templateId.charCodeAt(i) * (i + 1)) % 1000
  }
  return colors[hash % colors.length]
}

function workerBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case 'completed':
      return { label: 'Done', cls: 'bg-green-100 text-green-700' }
    case 'running':
      return { label: 'Active', cls: 'bg-blue-100 text-blue-700' }
    case 'failed':
      return { label: 'Failed', cls: 'bg-rose-100 text-rose-700' }
    default:
      return { label: 'Standby', cls: 'bg-amber-100 text-amber-600' }
  }
}

interface GroupedNode {
  id: string
  type: 'agent' | 'llm' | 'tool'
  label: string
  sublabel: string
  status: 'completed' | 'running' | 'pending' | 'failed'
  runIds: string[]
  count: number
}

function extractGroupedNodesFromEvents(events: SwarmEvent[]): GroupedNode[] {
  const groups: GroupedNode[] = []

  // Group 1: Input Processing (run_started, any initialization)
  const startEvents = events.filter(
    (e) => e.event_type === 'run_started' || e.event_type === 'step_started'
  )
  if (startEvents.length > 0) {
    const isRunning = startEvents.some((e) => !events.find((ce) => ce.event_type === 'step_completed' && ce.payload?.step === e.payload?.step))
    groups.push({
      id: 'group-input',
      type: 'agent',
      label: 'Input Processing',
      sublabel: `${startEvents.length} steps`,
      status: isRunning ? 'running' : 'completed',
      runIds: startEvents.map((e) => e.id || ''),
      count: startEvents.length,
    })
  }

  // Group 2: Agent Execution (all agent_started/agent_completed events)
  const agentStartedEvents = events.filter((e) => e.event_type === 'agent_started')
  const agentCompletedEvents = events.filter((e) => e.event_type === 'agent_completed')
  const uniqueAgents = new Set(agentStartedEvents.map((e) => String(e.event || e.payload?.agent || 'Agent')))

  if (agentStartedEvents.length > 0) {
    const isRunning = agentStartedEvents.length > agentCompletedEvents.length
    groups.push({
      id: 'group-agents',
      type: 'agent',
      label: uniqueAgents.size === 1 ? Array.from(uniqueAgents)[0] : 'Agent Execution',
      sublabel: uniqueAgents.size === 1 ? `${agentStartedEvents.length} calls` : `${uniqueAgents.size} agents`,
      status: isRunning ? 'running' : 'completed',
      runIds: agentStartedEvents.map((e) => e.id || ''),
      count: agentStartedEvents.length,
    })
  }

  // Group 3: Tool Operations (all tool_started/tool_completed events)
  const toolStartedEvents = events.filter((e) => e.event_type === 'tool_started')
  const toolCompletedEvents = events.filter((e) => e.event_type === 'tool_completed')
  const uniqueTools = new Set(toolStartedEvents.map((e) => String(e.event || e.payload?.tool || 'Tool')))

  if (toolStartedEvents.length > 0) {
    const isRunning = toolStartedEvents.length > toolCompletedEvents.length
    groups.push({
      id: 'group-tools',
      type: 'tool',
      label: uniqueTools.size === 1 ? Array.from(uniqueTools)[0] : 'Tool Operations',
      sublabel: uniqueTools.size === 1 ? `${toolStartedEvents.length} calls` : `${uniqueTools.size} tools`,
      status: isRunning ? 'running' : 'completed',
      runIds: toolStartedEvents.map((e) => e.id || ''),
      count: toolStartedEvents.length,
    })
  }

  // Group 4: LLM Processing (all llm_message events)
  const llmEvents = events.filter((e) => e.event_type === 'llm_message')
  if (llmEvents.length > 0) {
    groups.push({
      id: 'group-llm',
      type: 'llm',
      label: 'AI Processing',
      sublabel: `${llmEvents.length} interactions`,
      status: 'completed',
      runIds: llmEvents.map((e) => e.id || ''),
      count: llmEvents.length,
    })
  }

  // Group 5: Output & Completion (run_completed, step_completed)
  const completionEvents = events.filter(
    (e) => e.event_type === 'run_completed' || e.event_type === 'step_completed' || e.event_type === 'agent_completed'
  )
  if (completionEvents.length > 0) {
    groups.push({
      id: 'group-output',
      type: 'agent',
      label: 'Output & Completion',
      sublabel: `${completionEvents.length} finalizers`,
      status: 'completed',
      runIds: completionEvents.map((e) => e.id || ''),
      count: completionEvents.length,
    })
  }

  // If no groups were created, add a default processing node
  if (groups.length === 0 && events.length > 0) {
    groups.push({
      id: 'group-processing',
      type: 'agent',
      label: 'Processing',
      sublabel: `${events.length} events`,
      status: 'running',
      runIds: events.map((e) => e.id || ''),
      count: events.length,
    })
  }

  return groups
}

export function GlobalSwarmGraph({ runs, isLoading }: GlobalSwarmGraphProps) {
  const rfRef = useRef<ReactFlowInstance | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  const activeRuns = useMemo(() => runs.filter((r) => r.status === 'running'), [runs])
  const completedRuns = useMemo(() => runs.filter((r) => r.status === 'completed'), [runs])
  const pendingRuns = useMemo(() => runs.filter((r) => r.status === 'pending'), [runs])
  const failedRuns = useMemo(() => runs.filter((r) => r.status === 'failed'), [runs])

  const templateBranches = useMemo(() => {
    const runsByTemplate = new Map<string, GlobalSwarmRun[]>()

    activeRuns.forEach((run) => {
      const runs = runsByTemplate.get(run.template_id) || []
      runs.push(run)
      runsByTemplate.set(run.template_id, runs)
    })

    const branches: TemplateBranch[] = []
    runsByTemplate.forEach((templateRuns, templateId) => {
      const allEvents = templateRuns.flatMap((r) => r.events || [])
      const nodes = extractGroupedNodesFromEvents(allEvents)

      const nameFromPayload = templateRuns[0]?.payload?.template_name
      const templateName = typeof nameFromPayload === 'string'
        ? nameFromPayload
        : templateId.slice(0, 12)

      branches.push({
        templateId,
        templateName,
        runs: templateRuns,
        nodes,
      })
    })

    return branches
  }, [activeRuns])

  const { nodes, edges } = useMemo(() => {
    const n: Node[] = []
    const e: Edge[] = []

    // Swarm Center Node
    n.push({
      id: 'swarm-center',
      type: 'swarmCenter',
      position: { x: SWARM_X, y: 200 },
      data: {
        label: 'Swarm Orchestrator',
        sublabel: 'Global Control Plane',
        activeRuns: activeRuns.length,
        totalRuns: runs.length,
        templateCount: templateBranches.length,
      },
    })

    // Queue Node
    n.push({
      id: 'queue',
      type: 'queue',
      position: { x: QUEUE_X, y: 200 },
      data: {
        label: 'Run Queue',
        sublabel: 'Incoming Orders',
        count: runs.length,
      },
    })

    // Queue Items (visible runs) - scattered layout with more spacing
    const visibleRuns = [...activeRuns, ...pendingRuns].slice(0, 6)
    visibleRuns.forEach((run, i) => {
      // Scatter queue items in a staggered pattern with wider spacing
      const row = Math.floor(i / 2)
      const col = i % 2
      const x = QUEUE_X + col * 60
      const y = 320 + row * (QUEUE_ITEM_HEIGHT + 30) + (col === 1 ? 40 : 0)

      const orderId = (run.payload?.order_id as string) || run.run_id.slice(0, 8)

      n.push({
        id: `run-${run.run_id}`,
        type: 'queueItem',
        position: { x, y },
        data: {
          label: orderId,
          sublabel: run.run_id.slice(0, 12),
          status: run.status,
          templateName: run.payload?.template_name || run.template_id.slice(0, 12),
        },
      })

      // Edge from queue item to swarm center (left side)
      e.push({
        id: `run-${run.run_id}-to-swarm`,
        source: `run-${run.run_id}`,
        target: 'swarm-center',
        targetHandle: 'queue',
        animated: run.status === 'running',
        style: { stroke: '#6d3bd7', strokeWidth: 1.5, strokeDasharray: '4 4' },
      })
    })

    // Template Branches - positioned around the swarm center
    const SWARM_Y = 200
    templateBranches.forEach((branch, branchIdx) => {
      const color = generateTemplateColor(branch.templateId)

      // Get placement configuration for this branch (top, right, or bottom)
      const placement = getBranchPlacement(branchIdx, SWARM_X, SWARM_Y)

      // Template Branch Header Node
      n.push({
        id: `template-${branch.templateId}`,
        type: 'templateBranch',
        position: { x: placement.baseX, y: placement.baseY },
        data: {
          label: branch.templateName,
          runCount: branch.runs.length,
          color,
        },
      })

      // Edge from swarm center to template branch - uses appropriate handle
      e.push({
        id: `swarm-to-template-${branch.templateId}`,
        source: 'swarm-center',
        target: `template-${branch.templateId}`,
        sourceHandle: placement.handleId,
        animated: true,
        style: { stroke: color, strokeWidth: 2 },
      })

      // Branch Worker Nodes - scattered layout based on placement
      // Grouped nodes (max 5 groups: Input, Agents, Tools, LLM, Output)
      const placedPositions: NodePosition[] = []

      branch.nodes.forEach((node, nodeIdx) => {
        const { label, cls } = workerBadge(node.status)

        // Calculate scattered position based on branch placement
        let pos = calculateScatteredPositions(placement, nodeIdx)

        // Check for overlaps and adjust if needed - larger minimum distance
        const minDistance = 180
        let attempts = 0
        while (
          placedPositions.some(
            (p) => Math.abs(p.x - pos.x) < minDistance && Math.abs(p.y - pos.y) < minDistance
          ) &&
          attempts < 15
        ) {
          // Larger jitter to ensure spacing
          if (placement.side === 'right') {
            pos.x += 100
            pos.y += (attempts % 2 === 0 ? 1 : -1) * 120
          } else {
            pos.x += (attempts % 2 === 0 ? 1 : -1) * 100
            pos.y += placement.side === 'top' ? -80 : 80
          }
          attempts++
        }
        placedPositions.push(pos)

        n.push({
          id: `${branch.templateId}-${node.id}`,
          type: 'branchWorker',
          position: pos,
          data: {
            label: node.label,
            sublabel: node.sublabel,
            kind: node.type,
            status: node.status,
            badgeClass: cls,
            badgeLabel: label,
            runCount: node.runIds.length,
            count: node.count,
          },
        })

        // Edge from template header to first node, or chain from previous
        if (nodeIdx === 0) {
          e.push({
            id: `template-${branch.templateId}-to-${node.id}`,
            source: `template-${branch.templateId}`,
            target: `${branch.templateId}-${node.id}`,
            sourceHandle: 'out',
            animated: node.status === 'running',
            style: { stroke: color, strokeWidth: 1.5, strokeDasharray: '4 4' },
          })
        } else {
          // Connect to previous node in sequence
          const prevNodeId = `${branch.templateId}-${branch.nodes[nodeIdx - 1].id}`
          e.push({
            id: `${branch.templateId}-${branch.nodes[nodeIdx - 1].id}-to-${node.id}`,
            source: prevNodeId,
            target: `${branch.templateId}-${node.id}`,
            sourceHandle: 'out',
            animated: node.status === 'running',
            style: { stroke: color, strokeWidth: 1.5, strokeDasharray: '4 4' },
          })
        }
      })
    })

    return { nodes: n, edges: e }
  }, [runs, activeRuns, pendingRuns, templateBranches])

  const onInit = useCallback((inst: ReactFlowInstance) => {
    rfRef.current = inst
    requestAnimationFrame(() => inst.fitView({ padding: 0.25, duration: 300 }))
  }, [])

  useEffect(() => {
    requestAnimationFrame(() => rfRef.current?.fitView({ padding: 0.25, duration: 200 }))
  }, [nodes.length, templateBranches.length])

  const graphContent = (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        onInit={onInit}
        minZoom={0.25}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(169,180,185,0.35)" />
        <Controls position="bottom-right" showInteractive={false} className="!m-4 !rounded-lg !border-[#e8eff3] !shadow-md" />
        <MiniMap
          position="bottom-left"
          className="!m-4 !rounded-lg !border !border-[#e8eff3]"
          maskColor="rgba(247,249,251,0.85)"
          nodeColor={(node) => {
            if (node.type === 'swarmCenter') return '#6d3bd7'
            if (node.type === 'queue') return '#506076'
            if (node.type === 'templateBranch') return generateTemplateColor(node.id.replace('template-', ''))
            return '#a9b4b9'
          }}
        />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-xl border border-[#e8eff3] p-4 shadow-lg">
        <h4 className="text-xs font-bold uppercase text-[#566166] mb-2">Status Legend</h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs text-[#566166]">Running</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-[#566166]">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-xs text-[#566166]">Failed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs text-[#566166]">Pending</span>
          </div>
        </div>
      </div>

      {/* Stats overlay with real data */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl border border-[#e8eff3] p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="text-center px-2">
            <span className="text-[10px] font-bold uppercase text-[#a9b4b9]">Active</span>
            <p className="text-xl font-bold text-[#6d3bd7]">{activeRuns.length}</p>
          </div>
          <div className="w-px h-8 bg-[#e8eff3]" />
          <div className="text-center px-2">
            <span className="text-[10px] font-bold uppercase text-[#a9b4b9]">Done</span>
            <p className="text-xl font-bold text-[#566166]">{completedRuns.length}</p>
          </div>
          <div className="w-px h-8 bg-[#e8eff3]" />
          <div className="text-center px-2">
            <span className="text-[10px] font-bold uppercase text-[#a9b4b9]">Failed</span>
            <p className="text-xl font-bold text-[#dc2626]">{failedRuns.length}</p>
          </div>
          <div className="w-px h-8 bg-[#e8eff3]" />
          <div className="text-center px-2">
            <span className="text-[10px] font-bold uppercase text-[#a9b4b9]">Queued</span>
            <p className="text-xl font-bold text-[#d97706]">{pendingRuns.length}</p>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-[#e8eff3]">
          <p className="text-[10px] text-[#a9b4b9] text-center">
            Total: <span className="font-bold text-[#566166]">{runs.length}</span> runs
            {isLoading && <span className="ml-2 text-[#6d3bd7]">• syncing…</span>}
          </p>
        </div>
      </div>

      {/* Expand button */}
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="absolute bottom-4 right-16 z-10 flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg border border-[#e8eff3] shadow-md hover:shadow-lg transition-all text-xs font-semibold text-[#566166] hover:text-[#6d3bd7]"
      >
        <Maximize2 className="w-4 h-4" />
        Expand
      </button>
    </>
  )

  if (isLoading && runs.length === 0) {
    return (
      <div className="relative h-[700px] w-full rounded-2xl border border-[#d9e4ea]/30 bg-[#f7f9fb] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#6d3bd7] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium text-[#566166]">Loading swarm state…</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Normal view */}
      <div className="relative h-[700px] w-full rounded-2xl border border-[#d9e4ea]/30 bg-[radial-gradient(#d1d5db_1px,transparent_1px)] bg-[size:20px_20px] bg-[#ffffff]">
        {graphContent}
      </div>

      {/* Expanded modal view */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full h-full max-w-[95vw] max-h-[95vh] rounded-2xl border border-[#d9e4ea]/30 bg-[radial-gradient(#d1d5db_1px,transparent_1px)] bg-[size:20px_20px] bg-[#ffffff] shadow-2xl overflow-hidden">
            {graphContent}

            {/* Close button */}
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg border border-[#e8eff3] shadow-md hover:shadow-lg transition-all text-xs font-semibold text-[#566166] hover:text-[#dc2626]"
            >
              <X className="w-4 h-4" />
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
