import { memo, useMemo, useEffect, useRef, useCallback } from 'react'
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
import { Network, Bot, Wrench, Brain, MessageSquare } from 'lucide-react'

export interface RunDetailGraphWorkflowNode {
  id: string
  type: 'start' | 'agent' | 'llm' | 'tool' | 'end'
  label: string
  sublabel?: string
  status: 'completed' | 'running' | 'pending' | 'failed'
}

interface RunDetailFlowGraphProps {
  workflowNodes: RunDetailGraphWorkflowNode[]
  runStatus: string
  graphSearch: string
}

const GAP_Y = 188
const ORCH_X = 72
const WORKER_X = 400

const OrchestratorNode = memo(function OrchestratorNode(props: NodeProps) {
  const d = props.data as {
    label: string
    sublabel: string
    badge: string
    progress: number
  }
  return (
    <>
      <Handle type="target" position={Position.Left} className="!size-2 !border-2 !border-white !bg-[#6d3bd7]" />
      <div className="w-[192px] rounded-xl border border-[#e8eff3] bg-white p-5 shadow-xl shadow-slate-200/50">
        <div className="flex justify-between items-start gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e9ddff]">
            <Network className="h-5 w-5 text-[#6d3bd7]" />
          </div>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">{d.badge}</span>
        </div>
        <div className="mt-3">
          <h3 className="font-headline text-sm font-bold text-[#2a3439]">{d.label}</h3>
          <p className="mt-0.5 text-[11px] font-medium text-[#566166]">{d.sublabel}</p>
        </div>
        <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-2">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-[#a9b4b9]">
            <span>Steps</span>
            <span className="text-[#2a3439]">{Math.round(d.progress)}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-[#6d3bd7] transition-all" style={{ width: `${d.progress}%` }} />
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="out" className="!size-2 !border-2 !border-white !bg-[#6d3bd7]" />
    </>
  )
})

const WorkerNode = memo(function WorkerNode(props: NodeProps) {
  const d = props.data as {
    label: string
    sublabel: string
    kind: string
    status: string
    badgeClass: string
    badgeLabel: string
  }
  const Icon =
    d.kind === 'agent' ? Bot : d.kind === 'tool' ? Wrench : d.kind === 'llm' ? Brain : MessageSquare
  const iconBg =
    d.kind === 'agent' ? 'bg-[#d3e4fe]' : d.kind === 'tool' ? 'bg-[#dbdafb]' : 'bg-[#e9ddff]'

  return (
    <>
      <Handle type="target" position={Position.Left} className="!size-2 !border-2 !border-white !bg-[#6d3bd7]" />
      <div className="w-[192px] rounded-xl border border-[#e8eff3] bg-white p-5 shadow-xl shadow-slate-200/50">
        <div className="flex justify-between items-start gap-2">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
            <Icon className="h-5 w-5 text-[#506076]" />
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${d.badgeClass}`}>{d.badgeLabel}</span>
        </div>
        <div className="mt-3 min-w-0">
          <h3 className="truncate font-headline text-sm font-bold text-[#2a3439]">{d.label}</h3>
          <p className="mt-0.5 text-[11px] font-medium text-[#566166]">{d.sublabel}</p>
        </div>
        {d.kind === 'agent' && (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold uppercase text-slate-400">Load</span>
              <span className="text-xs font-bold text-[#6d3bd7]">
                {d.status === 'running' ? '68%' : d.status === 'completed' ? '100%' : '—'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold uppercase text-slate-400">Sync</span>
              <span className="text-xs font-bold text-[#2a3439]">{d.status === 'completed' ? '99.9%' : '—'}</span>
            </div>
          </div>
        )}
        {d.kind !== 'agent' && (
          <div className="mt-3 border-t border-slate-100 pt-2">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-[#a9b4b9]">
              <span>State</span>
              <span className="text-[#2a3439]">{d.status}</span>
            </div>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="out" className="!size-2 !border-2 !border-white !bg-[#6d3bd7]" />
    </>
  )
})

const nodeTypes = {
  runOrch: OrchestratorNode,
  runWorker: WorkerNode,
}

function workerBadge(status: RunDetailGraphWorkflowNode['status']): { label: string; cls: string } {
  switch (status) {
    case 'completed':
      return { label: 'Done', cls: 'bg-green-100 text-green-700' }
    case 'running':
      return { label: 'Processing', cls: 'bg-blue-100 text-blue-700' }
    case 'failed':
      return { label: 'Failed', cls: 'bg-rose-100 text-rose-700' }
    default:
      return { label: 'Standby', cls: 'bg-amber-100 text-amber-600' }
  }
}

export function RunDetailFlowGraph({ workflowNodes, runStatus, graphSearch }: RunDetailFlowGraphProps) {
  const rfRef = useRef<ReactFlowInstance | null>(null)
  const q = graphSearch.trim().toLowerCase()

  const workers = useMemo(
    () => workflowNodes.filter((n) => n.type !== 'start' && n.type !== 'end'),
    [workflowNodes],
  )

  const visibleWorkers = useMemo(() => {
    if (!q) return workers
    return workers.filter(
      (w) =>
        w.label.toLowerCase().includes(q) ||
        (w.sublabel && w.sublabel.toLowerCase().includes(q)),
    )
  }, [workers, q])

  const completed = workflowNodes.filter((n) => n.status === 'completed').length
  const total = Math.max(workflowNodes.length, 1)
  const progress = Math.round((completed / total) * 100)

  const { nodes, edges } = useMemo(() => {
    const orchBadge =
      runStatus === 'running' ? 'ACTIVE' : runStatus === 'completed' ? 'DONE' : runStatus.toUpperCase()

    const nWorkers = visibleWorkers.length
    const stackH = nWorkers > 0 ? (nWorkers - 1) * GAP_Y + 220 : 200
    const orchY = nWorkers > 0 ? Math.max(32, 32 + (stackH - 200) / 2) : 200

    const n: Node[] = [
      {
        id: 'orch',
        type: 'runOrch',
        position: { x: ORCH_X, y: orchY },
        data: {
          label: 'Primary orchestrator',
          sublabel: 'Control plane',
          badge: orchBadge,
          progress,
        },
      },
    ]

    const e: Edge[] = []

    visibleWorkers.forEach((w, i) => {
      const y = 32 + i * GAP_Y
      const { label, cls } = workerBadge(w.status)
      n.push({
        id: w.id,
        type: 'runWorker',
        position: { x: WORKER_X, y },
        data: {
          label: w.label,
          sublabel: w.sublabel || w.type.toUpperCase(),
          kind: w.type,
          status: w.status,
          badgeClass: cls,
          badgeLabel: label,
        },
      })
      if (i === 0) {
        e.push({
          id: 'orch-first',
          source: 'orch',
          target: w.id,
          sourceHandle: 'out',
          animated: true,
          style: { stroke: '#6d3bd7', strokeWidth: 1.5, strokeDasharray: '4 4' },
        })
      } else {
        e.push({
          id: `${visibleWorkers[i - 1].id}-${w.id}`,
          source: visibleWorkers[i - 1].id,
          target: w.id,
          sourceHandle: 'out',
          animated: true,
          style: { stroke: '#6d3bd7', strokeWidth: 1.5, strokeDasharray: '4 4' },
        })
      }
    })

    return { nodes: n, edges: e }
  }, [visibleWorkers, runStatus, progress])

  const onInit = useCallback((inst: ReactFlowInstance) => {
    rfRef.current = inst
    requestAnimationFrame(() => inst.fitView({ padding: 0.2, duration: 300 }))
  }, [])

  useEffect(() => {
    requestAnimationFrame(() => rfRef.current?.fitView({ padding: 0.2, duration: 200 }))
  }, [nodes.length, graphSearch])

  return (
    <div className="relative h-[min(560px,calc(100dvh-20rem))] min-h-[420px] w-full rounded-2xl border border-[#d9e4ea]/30 bg-[radial-gradient(#d1d5db_1px,transparent_1px)] bg-[size:20px_20px] bg-[#ffffff]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onInit={onInit}
        minZoom={0.35}
        maxZoom={1.4}
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(169,180,185,0.35)" />
        <Controls position="bottom-right" showInteractive={false} className="!m-4 !rounded-lg !border-[#e8eff3] !shadow-md" />
        <MiniMap
          position="bottom-left"
          className="!m-4 !rounded-lg !border !border-[#e8eff3]"
          maskColor="rgba(247,249,251,0.85)"
          nodeColor={(node) => (node.type === 'runOrch' ? '#6d3bd7' : '#506076')}
        />
      </ReactFlow>
    </div>
  )
}
