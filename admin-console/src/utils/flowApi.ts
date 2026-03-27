import yaml from 'js-yaml'
import { templatesApi } from '../api/templates'
import { runsApi } from '../api/runs'
import type { TemplateSummary } from '../types/template'
import type { Run } from '../types/common'

export interface FlowRunEvent {
  event_type?: string
  created_at?: string
  payload?: { stage?: string; [k: string]: unknown } | null
}

export async function fetchTemplatesForFlow(limit = 500, offset = 0) {
  return templatesApi.list(limit, offset)
}

export function templatesWithYaml(data: TemplateSummary[] | undefined): TemplateSummary[] {
  if (!data?.length) return []
  return data.filter((t) => typeof t.workflow_yaml === 'string' && t.workflow_yaml.trim().length > 0)
}

export async function fetchTemplateDetailYaml(templateId: string): Promise<string | null> {
  try {
    const detail = await templatesApi.get(templateId)
    const y = detail.workflow_yaml
    return typeof y === 'string' && y.trim().length > 0 ? y : null
  } catch {
    return null
  }
}

export function parseTemplateYaml(yamlString: string): unknown {
  return yaml.load(yamlString)
}

export async function fetchRunsForTemplate(templateId: string, limit = 100): Promise<Run[]> {
  try {
    const res = await runsApi.list({ template_id: templateId, limit })
    return res.data ?? []
  } catch {
    return []
  }
}

export async function fetchRunEvents(runId: string): Promise<FlowRunEvent[]> {
  try {
    const raw = await runsApi.events(runId)
    return Array.isArray(raw) ? (raw as FlowRunEvent[]) : []
  } catch {
    return []
  }
}

export function isActiveRunStatus(status: string): boolean {
  const s = status.toLowerCase()
  return s === 'running' || s === 'waiting_for_followup'
}

/**
 * Latest workflow_stage_started that has no workflow_stage_completed for the same stage after it.
 */
export function findStageFromEvents(events: FlowRunEvent[]): string | null {
  const sorted = [...events]
    .filter((e) => {
      const t = (e.event_type ?? '').toLowerCase()
      return t === 'workflow_stage_started' || t === 'workflow_stage_completed'
    })
    .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())

  for (let i = sorted.length - 1; i >= 0; i--) {
    const e = sorted[i]
    if ((e.event_type ?? '').toLowerCase() !== 'workflow_stage_started') continue
    const stage = e.payload?.stage
    if (!stage || typeof stage !== 'string') continue
    const later = sorted.slice(i + 1)
    const hasComplete = later.some(
      (x) =>
        (x.event_type ?? '').toLowerCase() === 'workflow_stage_completed' && x.payload?.stage === stage
    )
    if (!hasComplete) return stage
  }
  return null
}

/**
 * Resolves the current workflow stage from events (or status fallbacks).
 * The Flow page layers client-side “start dwell” and Completed dwell on top of this
 * for visualization; callers that need raw API semantics should use this as-is.
 */
export function resolveStageForRun(
  events: FlowRunEvent[],
  status: string,
  meta: { main: string[]; loop: string[] }
): string | null {
  const fromEv = findStageFromEvents(events)
  if (fromEv) return fromEv

  const s = status.toLowerCase()
  if (s === 'waiting_for_followup') {
    if (meta.loop.length === 1) return meta.loop[0]
    return meta.loop[0] ?? null
  }
  if (s === 'running') {
    return meta.main[0] ?? meta.loop[0] ?? null
  }
  return null
}
