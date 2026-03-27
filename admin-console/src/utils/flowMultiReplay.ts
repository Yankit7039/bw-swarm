import type { ActiveRunDot, PipelineLogTickerRow } from './buildGraphFromYaml'
import type { FlowRunEvent } from './flowApi'
import {
  FLOW_MAX_TICKER_ROWS_PER_NODE,
  FLOW_MULTI_REPLAY_CAP_MS,
  FLOW_MULTI_REPLAY_STAGGER_MS,
  FLOW_REPLAY_RUN_LIMIT,
  findEdgeBetween,
} from './flowRunDisplay'
import { splitTickerLines } from './formatRunEventLine'
import {
  groupMappedEventsByNode,
  mapRunEventsToGraphNodes,
  type MappedRunEvent,
  type RunEventForWorkflowMap,
} from './mapEventsToWorkflowNodes'
import { buildWorkflowReplaySchedule, sampleWorkflowReplay, type ReplaySchedule } from './workflowReplaySchedule'
import type { Run } from '../types/common'

export type RunReplayBundle = {
  runId: string
  orderId: string
  byNode: Map<string, MappedRunEvent[]>
  schedule: ReplaySchedule
}

function cloneByNode(m: Map<string, MappedRunEvent[]>): Map<string, MappedRunEvent[]> {
  const n = new Map<string, MappedRunEvent[]>()
  for (const [k, v] of m) n.set(k, [...v])
  return n
}

function finishedAtMs(r: Run): number {
  for (const c of [r.completed_at, r.updated_at, r.created_at]) {
    if (!c) continue
    const t = new Date(c).getTime()
    if (!Number.isNaN(t)) return t
  }
  return 0
}

/**
 * Most recent completed/failed runs for Flow replay (client-side from list response).
 */
export function pickReplayRuns(runs: Run[]): Run[] {
  const finished = runs.filter((r) => {
    const s = r.status.toLowerCase()
    return s === 'completed' || s === 'failed'
  })
  return [...finished]
    .sort((a, b) => finishedAtMs(b) - finishedAtMs(a))
    .slice(0, FLOW_REPLAY_RUN_LIMIT)
}

export function buildRunReplayBundle(
  run: Run,
  events: FlowRunEvent[],
  stageNames: string[],
  orderId: string,
): RunReplayBundle {
  const mapped = mapRunEventsToGraphNodes(events as RunEventForWorkflowMap[])
  const byNode = cloneByNode(groupMappedEventsByNode(mapped))
  const schedule = buildWorkflowReplaySchedule(stageNames, byNode)
  return {
    runId: run.run_id,
    orderId,
    byNode,
    schedule,
  }
}

export function multiReplayTiming(
  bundles: RunReplayBundle[],
  staggerMs: number,
  capMs: number,
): { playbackDurationMs: number; toLogicalMs: (playbackMs: number) => number } {
  if (bundles.length === 0) {
    return { playbackDurationMs: 0, toLogicalMs: () => 0 }
  }
  let globalEnd = 0
  bundles.forEach((b, i) => {
    globalEnd = Math.max(globalEnd, i * staggerMs + b.schedule.totalMs)
  })
  if (globalEnd <= 0) {
    return { playbackDurationMs: 0, toLogicalMs: () => 0 }
  }
  const playbackDuration = Math.min(globalEnd, capMs)
  const factor = globalEnd / playbackDuration
  return {
    playbackDurationMs: playbackDuration,
    toLogicalMs: (playbackMs: number) => Math.min(globalEnd, playbackMs * factor),
  }
}

function dotStatusForRun(run: Run): ActiveRunDot['status'] {
  const s = run.status.toLowerCase()
  if (s === 'completed') return 'completed'
  if (s === 'waiting_for_followup') return 'waiting_for_followup'
  return 'running'
}

export type MultiReplaySample = {
  runToNodeDots: Map<string, ActiveRunDot[]>
  edgeDotsByEdgeId: Map<string, Array<ActiveRunDot & { t: number }>>
  logTickerRowsByNode: Map<string, PipelineLogTickerRow[]>
}

function tickerRowFromSample(
  orderId: string,
  row: {
    text: string
    tone: PipelineLogTickerRow['tone']
    animKey: string
    dimmed: boolean
    sourceEvent?: MappedRunEvent
  },
): PipelineLogTickerRow {
  if (row.sourceEvent) {
    const { primary, secondary } = splitTickerLines(row.sourceEvent)
    return {
      orderId,
      primary,
      secondary,
      tone: row.tone,
      animKey: `${row.animKey}:${orderId}`,
      dimmed: row.dimmed,
    }
  }
  return {
    orderId,
    primary: row.text.slice(0, 48),
    secondary: row.text,
    tone: row.tone,
    animKey: `${row.animKey}:${orderId}`,
    dimmed: row.dimmed,
  }
}

/**
 * Merged dots + per-node ticker rows for all runs at a single logical timeline position.
 */
export function sampleMultiReplayAt(
  bundles: RunReplayBundle[],
  runsById: Map<string, Run>,
  logicalMs: number,
  staggerMs: number,
  baseEdges: { id: string; source: string; target: string }[],
  maxTickerRows: number = FLOW_MAX_TICKER_ROWS_PER_NODE,
): MultiReplaySample {
  const runToNodeDots = new Map<string, ActiveRunDot[]>()
  const edgeDotsByEdgeId = new Map<string, Array<ActiveRunDot & { t: number }>>()
  const byNodeTickers = new Map<string, PipelineLogTickerRow[]>()

  bundles.forEach((bundle, i) => {
    const off = i * staggerMs
    if (logicalMs < off) return
    const local = logicalMs - off
    if (local >= bundle.schedule.totalMs) return

    const run = runsById.get(bundle.runId)
    if (!run) return

    const sample = sampleWorkflowReplay(bundle.schedule, bundle.byNode, local)
    const dot: ActiveRunDot = {
      runId: bundle.runId,
      orderId: bundle.orderId,
      status: dotStatusForRun(run),
    }

    const ea = sample.edgeAnim
    if (ea) {
      const edge = findEdgeBetween(baseEdges, ea.from, ea.to)
      if (edge) {
        const list = edgeDotsByEdgeId.get(edge.id) ?? []
        list.push({ ...dot, t: ea.t })
        edgeDotsByEdgeId.set(edge.id, list)
      }
    } else if (sample.logicalNodeId) {
      const list = runToNodeDots.get(sample.logicalNodeId) ?? []
      list.push(dot)
      runToNodeDots.set(sample.logicalNodeId, list)
    }

    for (const [nodeId, trow] of sample.tickerByNode) {
      if (!trow.text) continue
      const list = byNodeTickers.get(nodeId) ?? []
      list.push(tickerRowFromSample(bundle.orderId, trow))
      byNodeTickers.set(nodeId, list)
    }
  })

  const logTickerRowsByNode = new Map<string, PipelineLogTickerRow[]>()
  for (const [nodeId, rows] of byNodeTickers) {
    const sorted = [...rows].sort((a, b) => a.orderId.localeCompare(b.orderId))
    logTickerRowsByNode.set(nodeId, sorted.slice(0, maxTickerRows))
  }

  return { runToNodeDots, edgeDotsByEdgeId, logTickerRowsByNode }
}

/** Default timing helper using shared constants. */
export function defaultMultiReplayTiming(bundles: RunReplayBundle[]) {
  return multiReplayTiming(bundles, FLOW_MULTI_REPLAY_STAGGER_MS, FLOW_MULTI_REPLAY_CAP_MS)
}

/**
 * Live Flow page: last mapped event per run on its current node, merged into rows per node.
 */
export function buildLiveLogTickerRowsByNode(
  displayRuns: Run[],
  logicalNodeByRun: Map<string, string | null>,
  eventsByRunId: Map<string, FlowRunEvent[] | undefined>,
  orderLabel: (r: Run) => string,
  maxRows: number = FLOW_MAX_TICKER_ROWS_PER_NODE,
): Map<string, PipelineLogTickerRow[]> {
  type RowWithTime = PipelineLogTickerRow & { createdAtMs: number }
  const byNode: Map<string, RowWithTime[]> = new Map()

  for (const run of displayRuns) {
    const nodeId = logicalNodeByRun.get(run.run_id)
    if (!nodeId) continue
    const raw = eventsByRunId.get(run.run_id) ?? []
    const mapped = mapRunEventsToGraphNodes(raw as RunEventForWorkflowMap[])
    const grouped = groupMappedEventsByNode(mapped)
    const list = grouped.get(nodeId)
    const last = list?.[list.length - 1]
    if (!last) continue
    const { primary, secondary } = splitTickerLines(last)
    const row: RowWithTime = {
      orderId: orderLabel(run),
      primary,
      secondary,
      tone: last.tone,
      animKey: `${last.id ?? `${last.created_at}:${last.event_type}`}:${run.run_id}`,
      dimmed: false,
      createdAtMs: last.createdAtMs,
    }
    const acc = byNode.get(nodeId) ?? []
    acc.push(row)
    byNode.set(nodeId, acc)
  }

  const out = new Map<string, PipelineLogTickerRow[]>()
  for (const [nodeId, rows] of byNode) {
    const sorted = [...rows].sort((a, b) => b.createdAtMs - a.createdAtMs).slice(0, maxRows)
    out.set(
      nodeId,
      sorted.map(({ createdAtMs: _t, ...r }) => r),
    )
  }
  return out
}
