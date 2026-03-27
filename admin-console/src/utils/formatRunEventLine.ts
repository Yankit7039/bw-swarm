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
