/**
 * Groups API run events into orchestrator vs per-agent streams (Ether AI log tree).
 */

export interface RunEventLite {
  id?: string
  event_type: string
  event: string
  created_at: string
  payload?: Record<string, unknown>
}

export interface LogAgentSection {
  id: string
  name: string
  health: 'healthy' | 'processing' | 'standby' | 'failed'
  events: RunEventLite[]
}

function agentHealth(events: RunEventLite[]): LogAgentSection['health'] {
  const types = events.map((e) => e.event_type.toLowerCase())
  if (types.some((t) => t.includes('fail') || t.includes('error'))) return 'failed'
  if (types.includes('agent_completed')) return 'healthy'
  if (types.includes('agent_started')) return 'processing'
  return 'standby'
}

function matchQuery(e: RunEventLite, q: string): boolean {
  if (!q) return true
  const blob = `${e.event_type} ${e.event} ${JSON.stringify(e.payload || {})}`.toLowerCase()
  return blob.includes(q)
}

function bucketEvents(sorted: RunEventLite[]): {
  orchestrator: RunEventLite[]
  agentMap: Map<string, RunEventLite[]>
  order: string[]
} {
  const orchestrator: RunEventLite[] = []
  const agentMap = new Map<string, RunEventLite[]>()
  const order: string[] = []
  let lastAgent: string | null = null

  const ensureAgent = (name: string) => {
    const n = name.trim() || 'Agent'
    if (!agentMap.has(n)) {
      agentMap.set(n, [])
      order.push(n)
    }
    return n
  }

  for (const e of sorted) {
    const type = e.event_type.toLowerCase()
    const parent = e.payload?.parent_agent != null ? String(e.payload.parent_agent) : null

    if (type === 'workflow_started' || type === 'workflow_completed') {
      orchestrator.push(e)
      continue
    }

    if (type === 'agent_started') {
      const name = ensureAgent(String(e.payload?.agent ?? e.event ?? 'Agent'))
      lastAgent = name
      agentMap.get(name)!.push(e)
      continue
    }

    if (type === 'agent_completed') {
      const name = ensureAgent(String(e.payload?.agent ?? e.event ?? lastAgent ?? 'Agent'))
      lastAgent = name
      agentMap.get(name)!.push(e)
      continue
    }

    if (parent) {
      const name = ensureAgent(parent)
      lastAgent = name
      agentMap.get(name)!.push(e)
      continue
    }

    if (lastAgent && (type.includes('tool') || type.includes('llm') || type === 'llm_message')) {
      agentMap.get(lastAgent)!.push(e)
      continue
    }

    orchestrator.push(e)
  }

  return { orchestrator, agentMap, order }
}

export function buildRunLogTree(events: RunEventLite[], logFilter: string): {
  orchestratorEvents: RunEventLite[]
  agentSections: LogAgentSection[]
} {
  const q = logFilter.trim().toLowerCase()
  const sorted = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  const { orchestrator, agentMap, order } = bucketEvents(sorted)

  const agentSections: LogAgentSection[] = order.map((name) => {
    const raw = agentMap.get(name) || []
    const nameHit = q && name.toLowerCase().includes(q)
    const ev = q ? (nameHit ? raw : raw.filter((e) => matchQuery(e, q))) : raw
    return {
      id: `agent:${name}`,
      name,
      health: agentHealth(raw),
      events: ev,
    }
  }).filter((s) => s.events.length > 0)

  const orchEvents = q ? orchestrator.filter((e) => matchQuery(e, q)) : orchestrator

  return { orchestratorEvents: orchEvents, agentSections }
}

export function countLogLines(orch: RunEventLite[], agents: LogAgentSection[]): number {
  return orch.length + agents.reduce((acc, a) => acc + a.events.length, 0)
}
