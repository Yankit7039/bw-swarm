import yaml from 'js-yaml'
import type {
  ConditionBranch,
  EscalationLadderEntry,
  LlmAgentStep,
  McpCallStep,
  PollLoopStage,
  Stage,
  Step,
  StandardStage,
  WorkflowDoc,
} from './types'

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

function normalizeMcpCall(raw: Record<string, unknown>): McpCallStep {
  return {
    type: 'mcp_call',
    name: (raw.name as string | undefined) ?? undefined,
    tool: typeof raw.tool === 'string' ? raw.tool : '',
    input: isPlainObject(raw.input) ? { ...raw.input } : {},
    output_key: typeof raw.output_key === 'string' ? raw.output_key : '',
    skip_if: raw.skip_if === null || raw.skip_if === undefined ? undefined : String(raw.skip_if),
    input_bindings:
      raw.input_bindings !== undefined && raw.input_bindings !== null && isPlainObject(raw.input_bindings)
        ? Object.fromEntries(
            Object.entries(raw.input_bindings).map(([k, v]) => [k, typeof v === 'string' ? v : String(v)])
          )
        : undefined,
    event_parent_agent:
      raw.event_parent_agent === null || raw.event_parent_agent === undefined
        ? undefined
        : String(raw.event_parent_agent),
  }
}

function normalizeLlmAgent(raw: Record<string, unknown>): LlmAgentStep {
  return {
    type: 'llm_agent',
    name: (raw.name as string | undefined) ?? undefined,
    description: typeof raw.description === 'string' ? raw.description : '',
    instruction: typeof raw.instruction === 'string' ? raw.instruction : '',
    output_key: typeof raw.output_key === 'string' ? raw.output_key : '',
    tool_filter: Array.isArray(raw.tool_filter) ? raw.tool_filter.map((x) => String(x)) : undefined,
    fallback_state:
      raw.fallback_state !== undefined && raw.fallback_state !== null && isPlainObject(raw.fallback_state)
        ? { ...raw.fallback_state }
        : undefined,
    input_keys: Array.isArray(raw.input_keys) ? raw.input_keys.map((x) => String(x)) : undefined,
    skip_if: raw.skip_if === null || raw.skip_if === undefined ? undefined : String(raw.skip_if),
  }
}

function normalizeConditionBranch(raw: Record<string, unknown>): ConditionBranch {
  return {
    if: raw.if === undefined || raw.if === null ? undefined : String(raw.if),
    else: typeof raw.else === 'boolean' ? raw.else : raw.else === undefined ? undefined : Boolean(raw.else),
    set: isPlainObject(raw.set) ? { ...raw.set } : {},
  }
}

function normalizeCondition(raw: Record<string, unknown>): Step {
  const branches = Array.isArray(raw.branches)
    ? raw.branches.map((b) => (isPlainObject(b) ? normalizeConditionBranch(b) : { set: {} }))
    : []
  return {
    type: 'condition',
    name: (raw.name as string | undefined) ?? undefined,
    branches,
    skip_if: raw.skip_if === null || raw.skip_if === undefined ? undefined : String(raw.skip_if),
  }
}

function normalizeStep(raw: unknown): Step {
  if (!isPlainObject(raw)) {
    return { type: 'llm_agent', instruction: '', description: '' }
  }
  const t = raw.type
  if (t === 'mcp_call') return normalizeMcpCall(raw)
  if (t === 'llm_agent') return normalizeLlmAgent(raw)
  if (t === 'condition') return normalizeCondition(raw)
  return { type: 'llm_agent', instruction: '', description: '' }
}

function normalizePollLoop(raw: Record<string, unknown>): PollLoopStage {
  const pollSteps = Array.isArray(raw.poll_steps)
    ? raw.poll_steps.map((s) => (isPlainObject(s) && s.type === 'mcp_call' ? normalizeMcpCall(s) : normalizeMcpCall({ type: 'mcp_call', tool: '', input: {} })))
    : []
  const ladder: EscalationLadderEntry[] = Array.isArray(raw.escalation_ladder)
    ? raw.escalation_ladder.map((e) => {
        if (!isPlainObject(e)) {
          return { iteration: 1, level: 'L1', label: '' }
        }
        const steps =
          e.steps !== undefined && Array.isArray(e.steps)
            ? e.steps.map((s) => (isPlainObject(s) ? normalizeMcpCall(s) : normalizeMcpCall({ type: 'mcp_call', tool: '', input: {} })))
            : undefined
        return {
          iteration: typeof e.iteration === 'number' ? e.iteration : Number(e.iteration) || 1,
          level: typeof e.level === 'string' ? e.level : 'L1',
          label: typeof e.label === 'string' ? e.label : '',
          steps: steps && steps.length ? steps : undefined,
        }
      })
    : []
  return {
    type: 'poll_loop',
    name: (raw.name as string | undefined) ?? undefined,
    skip_if: raw.skip_if === null || raw.skip_if === undefined ? undefined : String(raw.skip_if),
    interval_seconds: typeof raw.interval_seconds === 'number' ? raw.interval_seconds : 10,
    max_iterations: typeof raw.max_iterations === 'number' ? raw.max_iterations : 3,
    exit_if: typeof raw.exit_if === 'string' ? raw.exit_if : '',
    poll_steps: pollSteps,
    escalation_ladder: ladder,
  }
}

function normalizeStandardStage(raw: Record<string, unknown>): StandardStage {
  const type = raw.type === 'deterministic' || raw.type === 'hybrid' ? raw.type : 'hybrid'
  const steps = Array.isArray(raw.steps) ? raw.steps.map(normalizeStep) : []
  return {
    type,
    name: (raw.name as string | undefined) ?? undefined,
    skip_if: raw.skip_if === null || raw.skip_if === undefined ? undefined : String(raw.skip_if),
    steps,
  }
}

function normalizeStage(raw: unknown): Stage {
  if (!isPlainObject(raw)) {
    return { type: 'hybrid', steps: [] }
  }
  const t = raw.type ?? 'hybrid'
  if (t === 'poll_loop') return normalizePollLoop(raw)
  return normalizeStandardStage(raw)
}

/** Parse YAML string into WorkflowDoc. Throws on invalid root or missing template_id. */
export function parseWorkflow(yamlSource: string): WorkflowDoc {
  const data = yaml.load(yamlSource, { schema: yaml.DEFAULT_SCHEMA })
  if (!isPlainObject(data)) {
    throw new Error('Workflow root must be a mapping')
  }
  const template_id = data.template_id
  if (typeof template_id !== 'string' || !template_id) {
    throw new Error('template_id is required')
  }

  const inputRaw = data.input
  const input =
    inputRaw !== undefined && isPlainObject(inputRaw) && Array.isArray((inputRaw as { required?: unknown }).required)
      ? { required: (inputRaw as { required: unknown[] }).required.map((x) => String(x)) }
      : { required: [] }

  const followRaw = data.follow_up
  let follow_up: WorkflowDoc['follow_up'] = null
  if (followRaw !== undefined && followRaw !== null && isPlainObject(followRaw)) {
    const mode = (followRaw as { mode?: string }).mode
    follow_up = {
      mode: mode === 'agentmail' ? 'agentmail' : 'none',
      limit: typeof (followRaw as { limit?: number }).limit === 'number' ? (followRaw as { limit: number }).limit : 3,
      interval_seconds:
        typeof (followRaw as { interval_seconds?: number }).interval_seconds === 'number'
          ? (followRaw as { interval_seconds: number }).interval_seconds
          : 120,
      email_result_key:
        typeof (followRaw as { email_result_key?: string }).email_result_key === 'string'
          ? (followRaw as { email_result_key: string }).email_result_key
          : undefined,
    }
  }

  const stages = Array.isArray(data.stages) ? data.stages.map(normalizeStage) : []

  const tool_labels: Record<string, string> = {}
  if (isPlainObject(data.tool_labels)) {
    for (const [k, v] of Object.entries(data.tool_labels)) {
      if (typeof v === 'string') tool_labels[k] = v
    }
  }

  return {
    template_id,
    version: typeof data.version === 'string' ? data.version : '1.0',
    description: typeof data.description === 'string' ? data.description : '',
    model: data.model === null || data.model === undefined ? null : String(data.model),
    input,
    adapters: Array.isArray(data.adapters) ? data.adapters.map((x) => String(x)) : [],
    tool_labels,
    result_keys: Array.isArray(data.result_keys) ? data.result_keys.map((x) => String(x)) : [],
    follow_up,
    escalation_matrix:
      data.escalation_matrix !== undefined && data.escalation_matrix !== null && isPlainObject(data.escalation_matrix)
        ? { ...data.escalation_matrix }
        : null,
    stages,
  }
}

function stepToPlain(step: Step): Record<string, unknown> {
  if (step.type === 'mcp_call') {
    const o: Record<string, unknown> = {
      type: 'mcp_call',
      tool: step.tool,
      input: step.input,
    }
    if (step.name) o.name = step.name
    if (step.output_key) o.output_key = step.output_key
    if (step.skip_if) o.skip_if = step.skip_if
    if (step.input_bindings && Object.keys(step.input_bindings).length) o.input_bindings = step.input_bindings
    if (step.event_parent_agent) o.event_parent_agent = step.event_parent_agent
    return o
  }
  if (step.type === 'llm_agent') {
    const o: Record<string, unknown> = {
      type: 'llm_agent',
      instruction: step.instruction,
    }
    if (step.name) o.name = step.name
    if (step.description) o.description = step.description
    if (step.output_key) o.output_key = step.output_key
    if (step.tool_filter?.length) o.tool_filter = step.tool_filter
    if (step.fallback_state && Object.keys(step.fallback_state).length) o.fallback_state = step.fallback_state
    if (step.input_keys?.length) o.input_keys = step.input_keys
    if (step.skip_if) o.skip_if = step.skip_if
    return o
  }
  const o: Record<string, unknown> = {
    type: 'condition',
    branches: step.branches.map((b) => {
      const br: Record<string, unknown> = { set: b.set }
      if (b.if !== undefined && b.if !== null) br.if = b.if
      if (b.else !== undefined && b.else !== null) br.else = b.else
      return br
    }),
  }
  if (step.name) o.name = step.name
  if (step.skip_if) o.skip_if = step.skip_if
  return o
}

function stageToPlain(stage: Stage): Record<string, unknown> {
  if (stage.type === 'poll_loop') {
    const o: Record<string, unknown> = {
      type: 'poll_loop',
      interval_seconds: stage.interval_seconds,
      max_iterations: stage.max_iterations,
      exit_if: stage.exit_if,
      poll_steps: stage.poll_steps.map((s) => stepToPlain(s)),
      escalation_ladder: stage.escalation_ladder.map((e) => {
        const en: Record<string, unknown> = {
          iteration: e.iteration,
          level: e.level ?? 'L1',
          label: e.label ?? '',
        }
        if (e.steps?.length) en.steps = e.steps.map((s) => stepToPlain(s))
        return en
      }),
    }
    if (stage.name) o.name = stage.name
    if (stage.skip_if) o.skip_if = stage.skip_if
    return o
  }
  const o: Record<string, unknown> = {
    type: stage.type,
    steps: stage.steps.map(stepToPlain),
  }
  if (stage.name) o.name = stage.name
  if (stage.skip_if) o.skip_if = stage.skip_if
  return o
}

/** Serialize WorkflowDoc to YAML string. */
export function serializeWorkflow(doc: WorkflowDoc): string {
  const root: Record<string, unknown> = {
    template_id: doc.template_id,
    version: doc.version,
    description: doc.description,
  }
  if (doc.model) root.model = doc.model
  if (doc.input.required.length) root.input = { required: doc.input.required }
  else root.input = { required: [] }

  if (doc.adapters.length) root.adapters = doc.adapters
  if (Object.keys(doc.tool_labels).length) root.tool_labels = doc.tool_labels
  if (doc.result_keys.length) root.result_keys = doc.result_keys

  if (doc.follow_up) {
    const fu: Record<string, unknown> = {
      mode: doc.follow_up.mode,
      limit: doc.follow_up.limit,
      interval_seconds: doc.follow_up.interval_seconds,
    }
    if (doc.follow_up.email_result_key) fu.email_result_key = doc.follow_up.email_result_key
    root.follow_up = fu
  }

  if (doc.escalation_matrix && Object.keys(doc.escalation_matrix).length) {
    root.escalation_matrix = doc.escalation_matrix
  }

  root.stages = doc.stages.map(stageToPlain)

  return yaml.dump(root, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  })
}
