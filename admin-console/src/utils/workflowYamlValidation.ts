/**
 * Client-side validation aligned with swarm_core.schema.WorkflowSchema
 * (see swarm-core/swarm_core/schema.py). Kept in sync manually with that file.
 */
import yaml from 'js-yaml'

class WorkflowValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkflowValidationError'
  }
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

function expectMapping(x: unknown, path: string): Record<string, unknown> {
  if (!isPlainObject(x)) {
    throw new WorkflowValidationError(`${path} must be a mapping`)
  }
  return x
}

function validateMcpCallStep(step: unknown, path: string): void {
  const o = expectMapping(step, path)
  if (o.type !== 'mcp_call') {
    throw new WorkflowValidationError(`${path}.type must be "mcp_call"`)
  }
  if (typeof o.tool !== 'string') {
    throw new WorkflowValidationError(`${path}.tool is required (string)`)
  }
  if (o.input !== undefined && !isPlainObject(o.input)) {
    throw new WorkflowValidationError(`${path}.input must be a mapping when set`)
  }
}

function validateLlmAgentStep(step: unknown, path: string): void {
  const o = expectMapping(step, path)
  if (o.type !== 'llm_agent') {
    throw new WorkflowValidationError(`${path}.type must be "llm_agent"`)
  }
  if (typeof o.instruction !== 'string') {
    throw new WorkflowValidationError(`${path}.instruction is required (string)`)
  }
}

function validateConditionBranch(branch: unknown, path: string): void {
  const o = expectMapping(branch, path)
  if (o.if !== undefined && o.if !== null && typeof o.if !== 'string') {
    throw new WorkflowValidationError(`${path}.if must be a string when set`)
  }
  if (o.else !== undefined && o.else !== null && typeof o.else !== 'boolean') {
    throw new WorkflowValidationError(`${path}.else must be a boolean when set`)
  }
  if (o.set !== undefined && o.set !== null && !isPlainObject(o.set)) {
    throw new WorkflowValidationError(`${path}.set must be a mapping when set`)
  }
}

function validateConditionStep(step: unknown, path: string): void {
  const o = expectMapping(step, path)
  if (o.type !== 'condition') {
    throw new WorkflowValidationError(`${path}.type must be "condition"`)
  }
  if (o.branches !== undefined && o.branches !== null) {
    if (!Array.isArray(o.branches)) {
      throw new WorkflowValidationError(`${path}.branches must be a list`)
    }
    o.branches.forEach((b, k) => validateConditionBranch(b, `${path}.branches[${k}]`))
  }
}

function validateStandardStageSteps(st: Record<string, unknown>, stagePath: string): void {
  const steps = st.steps
  const list = Array.isArray(steps) ? steps : []
  list.forEach((step, j) => {
    const p = `${stagePath}.steps[${j}]`
    if (!isPlainObject(step)) {
      throw new WorkflowValidationError(`${p} must be a mapping`)
    }
    const stype = step.type
    if (stype === 'mcp_call') {
      validateMcpCallStep(step, p)
    } else if (stype === 'llm_agent') {
      validateLlmAgentStep(step, p)
    } else if (stype === 'condition') {
      validateConditionStep(step, p)
    } else {
      throw new WorkflowValidationError(`${p}: unknown step type ${String(stype)}`)
    }
  })
}

function validatePollLoopStage(st: Record<string, unknown>, stagePath: string): void {
  if (st.type !== 'poll_loop') {
    throw new WorkflowValidationError(`${stagePath}.type must be "poll_loop"`)
  }
  const pollSteps = st.poll_steps
  if (pollSteps !== undefined && pollSteps !== null) {
    if (!Array.isArray(pollSteps)) {
      throw new WorkflowValidationError(`${stagePath}.poll_steps must be a list`)
    }
    pollSteps.forEach((s, j) => validateMcpCallStep(s, `${stagePath}.poll_steps[${j}]`))
  }
  const ladder = st.escalation_ladder
  if (ladder !== undefined && ladder !== null) {
    if (!Array.isArray(ladder)) {
      throw new WorkflowValidationError(`${stagePath}.escalation_ladder must be a list`)
    }
    ladder.forEach((entry, k) => {
      const ep = `${stagePath}.escalation_ladder[${k}]`
      const e = expectMapping(entry, ep)
      if (typeof e.iteration !== 'number' || !Number.isInteger(e.iteration)) {
        throw new WorkflowValidationError(`${ep}.iteration is required (integer)`)
      }
      if (e.steps !== undefined && e.steps !== null) {
        if (!Array.isArray(e.steps)) {
          throw new WorkflowValidationError(`${ep}.steps must be a list`)
        }
        e.steps.forEach((s, m) => validateMcpCallStep(s, `${ep}.steps[${m}]`))
      }
    })
  }
}

function validateWorkflowInput(input: unknown, path: string): void {
  if (input === undefined || input === null) return
  const o = expectMapping(input, path)
  if (o.required !== undefined && o.required !== null) {
    if (!Array.isArray(o.required) || !o.required.every((x) => typeof x === 'string')) {
      throw new WorkflowValidationError(`${path}.required must be a list of strings`)
    }
  }
}

function validateFollowUp(fu: unknown, path: string): void {
  if (fu === undefined || fu === null) return
  const o = expectMapping(fu, path)
  if (o.mode !== undefined && o.mode !== null && o.mode !== 'none' && o.mode !== 'agentmail') {
    throw new WorkflowValidationError(`${path}.mode must be "none" or "agentmail"`)
  }
}

/** Mirrors WorkflowSchema + nested validators in swarm_core/schema.py */
function validateWorkflowSchema(root: Record<string, unknown>): void {
  if (typeof root.template_id !== 'string') {
    throw new WorkflowValidationError('template_id is required (string)')
  }

  validateWorkflowInput(root.input, 'input')
  validateFollowUp(root.follow_up, 'follow_up')

  if (root.adapters !== undefined && root.adapters !== null) {
    if (!Array.isArray(root.adapters) || !root.adapters.every((x) => typeof x === 'string')) {
      throw new WorkflowValidationError('adapters must be a list of strings')
    }
  }
  if (root.tool_labels !== undefined && root.tool_labels !== null) {
    if (!isPlainObject(root.tool_labels)) {
      throw new WorkflowValidationError('tool_labels must be a mapping')
    }
    for (const [k, v] of Object.entries(root.tool_labels)) {
      if (typeof v !== 'string') {
        throw new WorkflowValidationError(`tool_labels.${k} must be a string`)
      }
    }
  }
  if (root.result_keys !== undefined && root.result_keys !== null) {
    if (!Array.isArray(root.result_keys) || !root.result_keys.every((x) => typeof x === 'string')) {
      throw new WorkflowValidationError('result_keys must be a list of strings')
    }
  }
  if (root.escalation_matrix !== undefined && root.escalation_matrix !== null && !isPlainObject(root.escalation_matrix)) {
    throw new WorkflowValidationError('escalation_matrix must be a mapping when set')
  }

  const stages = root.stages
  if (!Array.isArray(stages)) {
    throw new WorkflowValidationError('stages is required (list)')
  }
  if (stages.length === 0) {
    throw new WorkflowValidationError('Workflow must have at least one stage')
  }

  stages.forEach((st, i) => {
    const stagePath = `stages[${i}]`
    if (!isPlainObject(st)) {
      throw new WorkflowValidationError(`${stagePath} must be a mapping`)
    }
    const t = (st.type as string | undefined) ?? 'hybrid'
    if (st.steps !== undefined && st.steps !== null && !Array.isArray(st.steps)) {
      throw new WorkflowValidationError(`${stagePath}.steps must be a list`)
    }
    if (t === 'poll_loop') {
      validatePollLoopStage(st, stagePath)
    } else if (t === 'deterministic' || t === 'hybrid') {
      // StandardStage.steps validated below with all stages
    } else {
      throw new WorkflowValidationError(`Unknown stage type: ${JSON.stringify(t)}`)
    }
    // Same as Python WorkflowSchema._validate_stages: always walk st["steps"]
    validateStandardStageSteps(st, stagePath)
  })
}

/**
 * YAML syntax + WorkflowSchema validation (swarm_core.schema).
 */
export function validateTemplateYaml(source: string): { ok: true } | { ok: false; message: string } {
  if (!source.trim()) {
    return { ok: false, message: 'YAML cannot be empty.' }
  }
  let data: unknown
  try {
    data = yaml.load(source, { schema: yaml.DEFAULT_SCHEMA })
  } catch (err) {
    if (err instanceof yaml.YAMLException) {
      return { ok: false, message: err.message }
    }
    if (err instanceof Error) {
      return { ok: false, message: err.message }
    }
    return { ok: false, message: String(err) }
  }

  if (!isPlainObject(data)) {
    return { ok: false, message: 'Workflow root must be a mapping' }
  }

  try {
    validateWorkflowSchema(data)
  } catch (e) {
    if (e instanceof WorkflowValidationError) {
      return { ok: false, message: e.message }
    }
    throw e
  }

  return { ok: true }
}
