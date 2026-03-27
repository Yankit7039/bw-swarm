const PRIMARY_KEYS = ['order_id', 'ticket_id', 'issue_key', 'case_id'] as const

function asNonEmptyString(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim()
    return t.length ? t : null
  }
  if (v != null && typeof v !== 'object') {
    const s = String(v).trim()
    return s.length ? s : null
  }
  return null
}

/**
 * Template-agnostic primary reference for a run (order id, ticket key, etc.).
 */
export function runPayloadPrimaryRef(payload: Record<string, unknown> | undefined): string {
  if (!payload) return ''
  for (const k of PRIMARY_KEYS) {
    const hit = asNonEmptyString(payload[k])
    if (hit) return hit
  }
  const input = asNonEmptyString(payload.input)
  if (input) return input
  return ''
}
