import { NODE_PREFIX } from './buildGraphFromYaml'
import { formatRunEventLine, toneFromEventType, type LogTone } from './formatRunEventLine'

export interface RunEventForWorkflowMap {
  id?: string
  event_type: string
  event: string
  created_at: string
  payload?: Record<string, unknown> | null
}

export interface MappedRunEvent extends RunEventForWorkflowMap {
  graphNodeId: string
  createdAtMs: number
  line: string
  tone: LogTone
}

interface StageInterval {
  stage: string
  start: number
  end: number
}

function parseCreatedMs(iso: string): number {
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

function buildStageIntervals(sorted: RunEventForWorkflowMap[]): StageInterval[] {
  const open: { stage: string; start: number }[] = []
  const closed: StageInterval[] = []

  for (const e of sorted) {
    const type = e.event_type.toLowerCase()
    const t = parseCreatedMs(e.created_at)
    const stageRaw = e.payload?.stage
    const stage = typeof stageRaw === 'string' && stageRaw.trim() ? stageRaw.trim() : ''

    if (type === 'workflow_stage_started' && stage) {
      open.push({ stage, start: t })
      continue
    }
    if (type === 'workflow_stage_completed' && stage) {
      for (let i = open.length - 1; i >= 0; i--) {
        if (open[i].stage === stage) {
          closed.push({ stage, start: open[i].start, end: t })
          open.splice(i, 1)
          break
        }
      }
    }
  }

  const lastEventMs =
    sorted.length > 0 ? parseCreatedMs(sorted[sorted.length - 1].created_at) : Date.now()
  for (const o of open) {
    closed.push({ stage: o.stage, start: o.start, end: lastEventMs })
  }
  return closed
}

function innermostStageAt(t: number, intervals: StageInterval[]): string | null {
  let best: { start: number; stage: string } | null = null
  for (const iv of intervals) {
    if (t >= iv.start && t <= iv.end) {
      if (!best || iv.start > best.start) best = { start: iv.start, stage: iv.stage }
    }
  }
  return best?.stage ?? null
}

/** When t falls in a gap between stages, attribute to the most recently ended stage. */
function recentStageAfterGap(t: number, intervals: StageInterval[]): string | null {
  let candidate: string | null = null
  let bestEnd = -Infinity
  for (const iv of intervals) {
    if (t >= iv.end && iv.end >= bestEnd) {
      bestEnd = iv.end
      candidate = iv.stage
    }
  }
  return candidate
}

function resolveStageForTimestamp(t: number, intervals: StageInterval[]): string | null {
  return innermostStageAt(t, intervals) ?? recentStageAfterGap(t, intervals)
}

function workflowCompletedAt(sorted: RunEventForWorkflowMap[]): number | null {
  let last: number | null = null
  for (const e of sorted) {
    if (e.event_type.toLowerCase() === 'workflow_completed') {
      const t = parseCreatedMs(e.created_at)
      last = t
    }
  }
  return last
}

function firstStageStartMs(intervals: StageInterval[]): number {
  if (intervals.length === 0) return Number.POSITIVE_INFINITY
  return Math.min(...intervals.map((i) => i.start))
}

/**
 * Maps each run event to a pipeline graph node id (start | stage:name | completed).
 * Uses workflow stage open/close intervals so tool/LLM lines stay on the active YAML stage.
 */
export function mapRunEventsToGraphNodes(events: RunEventForWorkflowMap[]): MappedRunEvent[] {
  const sorted = [...events].sort((a, b) => parseCreatedMs(a.created_at) - parseCreatedMs(b.created_at))
  const intervals = buildStageIntervals(sorted)
  const completedAt = workflowCompletedAt(sorted)
  const firstStage = firstStageStartMs(intervals)

  return sorted.map((e) => {
    const t = parseCreatedMs(e.created_at)
    const type = e.event_type.toLowerCase()
    const stagePayload = e.payload?.stage
    const stageName = typeof stagePayload === 'string' && stagePayload.trim() ? stagePayload.trim() : ''

    let graphNodeId: string

    if (type === 'workflow_started') {
      graphNodeId = NODE_PREFIX.start
    } else if (type === 'workflow_completed') {
      graphNodeId = NODE_PREFIX.completed
    } else if (
      (type === 'workflow_stage_started' || type === 'workflow_stage_completed') &&
      stageName
    ) {
      graphNodeId = NODE_PREFIX.stage(stageName)
    } else {
      const active = resolveStageForTimestamp(t, intervals)
      if (active) {
        graphNodeId = NODE_PREFIX.stage(active)
      } else if (t < firstStage) {
        graphNodeId = NODE_PREFIX.start
      } else if (completedAt != null && t >= completedAt) {
        graphNodeId = NODE_PREFIX.completed
      } else {
        graphNodeId = NODE_PREFIX.start
      }
    }

    const line = formatRunEventLine({
      event_type: e.event_type,
      event: e.event,
      payload: e.payload ?? undefined,
    })
    const tone = toneFromEventType(e.event_type)

    return {
      ...e,
      graphNodeId,
      createdAtMs: t,
      line,
      tone,
    }
  })
}

export function groupMappedEventsByNode(mapped: MappedRunEvent[]): Map<string, MappedRunEvent[]> {
  const m = new Map<string, MappedRunEvent[]>()
  for (const e of mapped) {
    const list = m.get(e.graphNodeId) ?? []
    list.push(e)
    m.set(e.graphNodeId, list)
  }
  return m
}
