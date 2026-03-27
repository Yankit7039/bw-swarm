export type LogTone = 'neutral' | 'error' | 'success'

export interface RunEventLineInput {
  event_type: string
  event: string
  payload?: Record<string, unknown> | null
}

export function toneFromEventType(eventType: string): LogTone {
  const t = eventType.toLowerCase()
  if (t.includes('fail') || t.includes('error')) return 'error'
  if (t.includes('complete')) return 'success'
  return 'neutral'
}

function formatPayloadSnippet(payload: Record<string, unknown> | null | undefined): string | null {
  if (!payload || Object.keys(payload).length === 0) return null
  if (payload.text && typeof payload.text === 'string') return payload.text
  if (payload.tool && typeof payload.tool === 'string') {
    const toolName = payload.tool
    const label = payload.label && typeof payload.label === 'string' ? payload.label : toolName
    const params = Object.entries(payload)
      .filter(([key]) => !['tool', 'label', 'parent_agent', 'agent'].includes(key))
      .map(([key, value]) => {
        if (typeof value === 'string') return `${key}: ${value}`
        if (typeof value === 'number') return `${key}: ${value}`
        return `${key}: ${JSON.stringify(value).slice(0, 80)}`
      })
      .join(', ')
    return params ? `${label} (${params})` : label
  }
  if (payload.agent && typeof payload.agent === 'string') {
    const agentName = payload.agent
    const details = Object.entries(payload)
      .filter(([key]) => !['agent', 'parent_agent'].includes(key))
      .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value).slice(0, 60)}`)
      .join(', ')
    return details ? `${agentName} — ${details}` : agentName
  }
  return Object.entries(payload)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v).slice(0, 60)}`)
    .join(' · ')
}

/**
 * Single-line summary for workflow ticker / compact log views.
 */
export function formatRunEventLine(e: RunEventLineInput, maxLen = 96): string {
  const ev = (e.event ?? '').trim()
  const fromPayload = formatPayloadSnippet(e.payload ?? undefined)
  let line = ev
  if (fromPayload) {
    line = ev ? `${ev} · ${fromPayload}` : fromPayload
  }
  if (!line) line = e.event_type || 'event'
  if (line.length <= maxLen) return line
  return `${line.slice(0, maxLen - 1)}…`
}

function formatTickerTime(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function shortEventTypeLabel(eventType: string): string {
  const t = (eventType || 'event').trim()
  if (!t) return 'event'
  const leaf = t.includes('.') ? t.slice(t.lastIndexOf('.') + 1) : t
  return leaf.replace(/_/g, ' ')
}

/**
 * Two-line ticker: compact type + time, then full summary (Flow page multi-order logs).
 */
export function splitTickerLines(input: RunEventLineInput & { created_at?: string }): {
  primary: string
  secondary: string
} {
  const time = formatTickerTime(input.created_at)
  const typeLabel = shortEventTypeLabel(input.event_type)
  const primary = [typeLabel, time].filter(Boolean).join(' · ') || typeLabel
  const secondary = formatRunEventLine(input, 140)
  return { primary, secondary }
}
