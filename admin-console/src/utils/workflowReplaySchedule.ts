import { NODE_PREFIX } from './buildGraphFromYaml'
import {
  COMPLETED_DWELL_MS,
  EDGE_TRAVEL_MS,
  LINE_DWELL_MS,
  REPLAY_MIN_STAGE_DWELL_MS,
  REPLAY_TOTAL_CAP_MS,
  START_DWELL_MS,
} from './flowRunDisplay'
import type { LogTone } from './formatRunEventLine'
import type { MappedRunEvent } from './mapEventsToWorkflowNodes'

type DwellSegment = {
  kind: 'dwell'
  nodeId: string
  startMs: number
  endMs: number
  /** Lines shown in order, one per LINE_DWELL_MS (clamped to segment length). */
  lines: MappedRunEvent[]
}

type TravelSegment = {
  kind: 'travel'
  from: string
  to: string
  startMs: number
  endMs: number
}

export type ReplaySegment = DwellSegment | TravelSegment

export interface ReplaySchedule {
  segments: ReplaySegment[]
  totalMs: number
  scale: number
}

export interface ReplaySample {
  logicalNodeId: string | null
  edgeAnim: { from: string; to: string; t: number } | null
  tickerByNode: Map<
    string,
    { text: string; tone: LogTone; animKey: string; dimmed: boolean; lineIndex: number }
  >
  /** Last mapped line per node for static hold after replay. */
  lastLineByNode: Map<string, { text: string; tone: LogTone; animKey: string }>
}

function chainFromStageOrder(stageNames: string[]): string[] {
  return [NODE_PREFIX.start, ...stageNames.map((n) => NODE_PREFIX.stage(n)), NODE_PREFIX.completed]
}

/**
 * Builds a compressed timeline: dwell on each node with log lines, travel along edges.
 * `stageNames` must match YAML `stages[].name` order.
 */
export function buildWorkflowReplaySchedule(
  stageNames: string[],
  byNode: Map<string, MappedRunEvent[]>,
): ReplaySchedule {
  const chain = chainFromStageOrder(stageNames)
  const segments: ReplaySegment[] = []
  let t = 0

  const pushDwell = (nodeId: string, lines: MappedRunEvent[], minMs: number, maxMs: number) => {
    const raw = Math.max(minMs, Math.min(lines.length * LINE_DWELL_MS, maxMs))
    const dwell = Math.max(minMs, raw)
    segments.push({ kind: 'dwell', nodeId, startMs: t, endMs: t + dwell, lines })
    t += dwell
  }

  const startLines = byNode.get(NODE_PREFIX.start) ?? []
  pushDwell(NODE_PREFIX.start, startLines, START_DWELL_MS, 12_000)

  for (let i = 1; i < chain.length; i++) {
    const from = chain[i - 1]
    const to = chain[i]
    segments.push({
      kind: 'travel',
      from,
      to,
      startMs: t,
      endMs: t + EDGE_TRAVEL_MS,
    })
    t += EDGE_TRAVEL_MS

    const lines = byNode.get(to) ?? []
    if (to === NODE_PREFIX.completed) {
      pushDwell(to, lines, Math.max(COMPLETED_DWELL_MS * 0.5, REPLAY_MIN_STAGE_DWELL_MS), 14_000)
    } else {
      pushDwell(to, lines, REPLAY_MIN_STAGE_DWELL_MS, 18_000)
    }
  }

  const rawTotal = t
  const scale = rawTotal > REPLAY_TOTAL_CAP_MS ? REPLAY_TOTAL_CAP_MS / rawTotal : 1
  const scaledSegments: ReplaySegment[] = segments.map((s) => ({
    ...s,
    startMs: s.startMs * scale,
    endMs: s.endMs * scale,
  }))
  const totalMs = rawTotal * scale

  return { segments: scaledSegments, totalMs, scale }
}

function lastLineByNodeMap(byNode: Map<string, MappedRunEvent[]>): Map<
  string,
  { text: string; tone: LogTone; animKey: string }
> {
  const m = new Map<string, { text: string; tone: LogTone; animKey: string }>()
  for (const [id, list] of byNode) {
    const last = list[list.length - 1]
    if (last) {
      m.set(id, {
        text: last.line,
        tone: last.tone,
        animKey: last.id ?? `${last.created_at}:${last.event_type}`,
      })
    }
  }
  return m
}

function lineAtOffset(seg: DwellSegment, localMs: number): { ev: MappedRunEvent; idx: number } | null {
  if (seg.lines.length === 0) return null
  const dur = seg.endMs - seg.startMs
  if (dur <= 0) return { ev: seg.lines[0], idx: 0 }
  const frac = Math.min(1, Math.max(0, localMs / dur))
  const idx = Math.min(seg.lines.length - 1, Math.floor(frac * seg.lines.length))
  return { ev: seg.lines[idx], idx }
}

/**
 * Sample replay state at `playbackMs` (0 .. schedule.totalMs).
 */
export function sampleWorkflowReplay(
  schedule: ReplaySchedule,
  byNode: Map<string, MappedRunEvent[]>,
  playbackMs: number,
): ReplaySample {
  const lastLineByNode = lastLineByNodeMap(byNode)
  const tickerByNode = new Map<
    string,
    { text: string; tone: LogTone; animKey: string; dimmed: boolean; lineIndex: number }
  >()

  let logicalNodeId: string | null = null
  let edgeAnim: { from: string; to: string; t: number } | null = null
  const t = Math.max(0, Math.min(playbackMs, schedule.totalMs))

  for (const seg of schedule.segments) {
    if (t < seg.startMs || t >= seg.endMs) continue
    const local = t - seg.startMs
    if (seg.kind === 'travel') {
      const dur = seg.endMs - seg.startMs
      const u = dur > 0 ? Math.min(1, local / dur) : 1
      edgeAnim = { from: seg.from, to: seg.to, t: u }
      logicalNodeId = null
      /* Dot travels on the edge — no in-node log ticker */
      break
    }
    logicalNodeId = seg.nodeId
    const pick = lineAtOffset(seg, local)
    if (pick) {
      const key = pick.ev.id ?? `${pick.ev.created_at}:${pick.ev.event_type}:${pick.idx}`
      tickerByNode.set(seg.nodeId, {
        text: pick.ev.line,
        tone: pick.ev.tone,
        animKey: key,
        dimmed: false,
        lineIndex: pick.idx,
      })
    }
    break
  }

  return { logicalNodeId, edgeAnim, tickerByNode, lastLineByNode }
}

/**
 * After replay ends: last log line only on the node that produced the final event.
 */
export function staticTickerSample(byNode: Map<string, MappedRunEvent[]>): ReplaySample {
  const lastLineByNode = lastLineByNodeMap(byNode)
  const tickerByNode = new Map<
    string,
    { text: string; tone: LogTone; animKey: string; dimmed: boolean; lineIndex: number }
  >()
  let best: { nodeId: string; ev: MappedRunEvent } | null = null
  for (const [nodeId, list] of byNode) {
    for (const ev of list) {
      if (!best || ev.createdAtMs > best.ev.createdAtMs) best = { nodeId, ev }
    }
  }
  if (best) {
    const ev = best.ev
    tickerByNode.set(best.nodeId, {
      text: ev.line,
      tone: ev.tone,
      animKey: `${ev.id ?? `${ev.created_at}:${ev.event_type}`}:static`,
      dimmed: false,
      lineIndex: -1,
    })
  }
  return {
    logicalNodeId: null,
    edgeAnim: null,
    tickerByNode,
    lastLineByNode,
  }
}
