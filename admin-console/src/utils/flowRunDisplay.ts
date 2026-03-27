import type { Run } from '../types/common'
import { NODE_PREFIX } from './buildGraphFromYaml'
import type { FlowRunEvent } from './flowApi'
import { isActiveRunStatus, resolveStageForRun } from './flowApi'

/** Time to keep the dot on Start after a run first appears (client-side). */
export const START_DWELL_MS = 2500

/** Time to show the dot on Completed after a run finishes. */
export const COMPLETED_DWELL_MS = 3000

/** Duration for the dot to travel along an edge between nodes. */
export const EDGE_TRAVEL_MS = 2200

/** Per-event line visibility in workflow node tickers (live + replay). */
export const LINE_DWELL_MS = 900

/** Cap total compressed replay duration on the run detail workflow tab. */
export const REPLAY_TOTAL_CAP_MS = 90_000

/** Minimum dwell on a pipeline stage during replay when it has no log lines. */
export const REPLAY_MIN_STAGE_DWELL_MS = 2200

export function parseAnchorTime(run: Run, firstSeenAtMs?: number): number {
  if (firstSeenAtMs != null) return firstSeenAtMs
  if (run.created_at) {
    const t = new Date(run.created_at).getTime()
    if (!Number.isNaN(t)) return t
  }
  return Date.now()
}

/**
 * Resolves which graph node id should show a run dot for the Flow canvas.
 * Uses start dwell, then event-driven stage resolution; completed runs dwell on Completed.
 */
export function computeLogicalNodeId(
  run: Run,
  events: FlowRunEvent[],
  stageMeta: { main: string[]; loop: string[] },
  now: number,
  firstSeenAtMs?: number
): string | null {
  const status = run.status.toLowerCase()

  if (status === 'completed') {
    const ca = run.completed_at ? new Date(run.completed_at).getTime() : now
    if (now - ca < COMPLETED_DWELL_MS) return NODE_PREFIX.completed
    return null
  }

  if (!isActiveRunStatus(run.status)) return null

  const anchor = parseAnchorTime(run, firstSeenAtMs)
  if (now - anchor < START_DWELL_MS) return NODE_PREFIX.start

  const stageName = resolveStageForRun(events, run.status, stageMeta)
  if (!stageName) return null
  return NODE_PREFIX.stage(stageName)
}

export function findEdgeBetween(
  edges: { id: string; source: string; target: string }[],
  from: string,
  to: string
): { id: string; source: string; target: string } | undefined {
  return edges.find((e) => e.source === from && e.target === to)
}
