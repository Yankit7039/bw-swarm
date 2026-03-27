import type { Edge, Node } from '@xyflow/react'
import { MarkerType } from '@xyflow/react'
import type { LogTone } from './formatRunEventLine'

const X_SPACING = 310
const MAIN_Y = 0

/** Soft violet-blue for horizontal pipeline edges (matches pastel canvas). */
const MAIN_EDGE_STROKE = '#9ca3e8'

export const NODE_PREFIX = {
  start: 'start',
  completed: 'completed',
  stage: (name: string) => `stage:${name}`,
} as const

/** Label for the terminal synthetic node (shown on the Flow canvas). */
export const WORKFLOW_COMPLETED_LABEL = 'Workflow completed'

/** Distinct pastel fills cycle by chain index; must match `.flow-node--fill-*` count in FlowPage.css. */
export const FLOW_NODE_PALETTE_SIZE = 6

export interface ActiveRunDot {
  runId: string
  orderId: string
  status: 'running' | 'waiting_for_followup' | 'completed'
  /** When true, the dot is drawn on an edge overlay instead of inside this node. */
  hideInNode?: boolean
}

export type PipelineLogTicker = {
  text: string
  tone: LogTone
  /** Changes when the line updates to retrigger CSS animation. */
  animKey: string
  dimmed?: boolean
}

/** Multi-order log strip on Flow page (two lines + order chip per row). */
export type PipelineLogTickerRow = {
  orderId: string
  primary: string
  secondary: string
  tone: LogTone
  animKey: string
  dimmed?: boolean
}

export type PipelineNodeData = {
  kind: 'synthetic' | 'stage'
  label: string
  /** Index along Start→stages→Completed; drives `flow-node--fill-{i % FLOW_NODE_PALETTE_SIZE}`. */
  fillIndex: number
  stageType?: string
  isLoop?: boolean
  activeRuns?: ActiveRunDot[]
  logTicker?: PipelineLogTicker | null
  logTickerRows?: PipelineLogTickerRow[]
} & Record<string, unknown>

export function isLoopStage(stage: Record<string, unknown>): boolean {
  const t = String(stage.type ?? '').toLowerCase()
  if (t === 'poll_loop') return true
  const raw = String(stage.name ?? '')
  const n = raw.toLowerCase().replace(/-/g, '_')
  return n.includes('followup') || n.includes('follow_up')
}

function asStageArray(parsed: unknown): Record<string, unknown>[] {
  if (!parsed || typeof parsed !== 'object') return []
  const stages = (parsed as { stages?: unknown }).stages
  if (!Array.isArray(stages)) return []
  return stages.filter((s) => s && typeof s === 'object') as Record<string, unknown>[]
}

/** Stage names for live-dot fallbacks and validation */
export function extractStageMeta(parsedYaml: unknown): { main: string[]; loop: string[]; all: string[] } {
  const stages = asStageArray(parsedYaml)
  const all = stages.map(stageName)
  const loop = stages.filter((s) => isLoopStage(s)).map(stageName)
  const main = stages.filter((s) => !isLoopStage(s)).map(stageName)
  return { all, loop, main }
}

function stageName(s: Record<string, unknown>): string {
  return String(s.name ?? 'unnamed')
}

function mainEdgeStyle(): { stroke: string; strokeWidth: number } {
  return { stroke: MAIN_EDGE_STROKE, strokeWidth: 2 }
}

/**
 * Pure layout: one node per YAML stage in order, plus Start and Workflow completed.
 * All stages are laid out on a single horizontal row (no loop subgraph).
 */
export function buildGraphFromYaml(parsedYaml: unknown): { nodes: Node<PipelineNodeData>[]; edges: Edge[] } {
  const stages = asStageArray(parsedYaml)
  if (stages.length === 0) {
    return {
      nodes: [
        {
          id: NODE_PREFIX.start,
          type: 'pipeline',
          position: { x: 0, y: MAIN_Y },
          data: { kind: 'synthetic', label: 'Start', fillIndex: 0 },
        },
        {
          id: NODE_PREFIX.completed,
          type: 'pipeline',
          position: { x: X_SPACING, y: MAIN_Y },
          data: { kind: 'synthetic', label: WORKFLOW_COMPLETED_LABEL, fillIndex: 1 },
        },
      ],
      edges: [
        {
          id: 'e-start-completed',
          type: 'pipeline',
          source: NODE_PREFIX.start,
          target: NODE_PREFIX.completed,
          sourceHandle: 'right',
          targetHandle: 'left',
          animated: true,
          className: 'flow-edge--main',
          style: mainEdgeStyle(),
          markerEnd: { type: MarkerType.ArrowClosed, color: MAIN_EDGE_STROKE, width: 18, height: 18 },
        },
      ],
    }
  }

  const chain: string[] = [NODE_PREFIX.start, ...stages.map((s) => NODE_PREFIX.stage(stageName(s))), NODE_PREFIX.completed]

  const nodes: Node<PipelineNodeData>[] = []
  const edges: Edge[] = []

  const totalSlots = chain.length
  for (let i = 0; i < totalSlots; i++) {
    const id = chain[i]
    const x = i * X_SPACING

    if (id === NODE_PREFIX.start) {
      nodes.push({
        id,
        type: 'pipeline',
        position: { x, y: MAIN_Y },
        data: { kind: 'synthetic', label: 'Start', fillIndex: i },
      })
    } else if (id === NODE_PREFIX.completed) {
      nodes.push({
        id,
        type: 'pipeline',
        position: { x, y: MAIN_Y },
        data: { kind: 'synthetic', label: WORKFLOW_COMPLETED_LABEL, fillIndex: i },
      })
    } else {
      const name = id.replace(/^stage:/, '')
      const raw = stages.find((s) => stageName(s) === name)
      const stageType = raw ? String(raw.type ?? 'unknown') : 'unknown'
      nodes.push({
        id,
        type: 'pipeline',
        position: { x, y: MAIN_Y },
        data: {
          kind: 'stage',
          label: name,
          stageType,
          isLoop: false,
          fillIndex: i,
        },
      })
    }
  }

  for (let i = 0; i < chain.length - 1; i++) {
    edges.push({
      id: `e-main-${chain[i]}-${chain[i + 1]}`,
      type: 'pipeline',
      source: chain[i],
      target: chain[i + 1],
      sourceHandle: 'right',
      targetHandle: 'left',
      animated: true,
      className: 'flow-edge--main',
      style: mainEdgeStyle(),
      markerEnd: { type: MarkerType.ArrowClosed, color: MAIN_EDGE_STROKE, width: 18, height: 18 },
    })
  }

  return { nodes, edges }
}
