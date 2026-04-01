import type { WorkflowDoc } from './types'
import { isPollLoopStage, isStandardStage } from './types'

/** Keys useful for LLM input_keys pickers: required inputs, result_keys, and step output_keys. */
export function collectKnownStateKeys(doc: WorkflowDoc): string[] {
  const s = new Set<string>([...doc.input.required, ...doc.result_keys])
  for (const stage of doc.stages) {
    if (isStandardStage(stage)) {
      for (const step of stage.steps) {
        if ('output_key' in step && step.output_key) s.add(step.output_key)
      }
    } else if (isPollLoopStage(stage)) {
      for (const step of stage.poll_steps) {
        if (step.output_key) s.add(step.output_key)
      }
      for (const entry of stage.escalation_ladder) {
        for (const step of entry.steps ?? []) {
          if (step.output_key) s.add(step.output_key)
        }
      }
    }
  }
  return Array.from(s).filter(Boolean).sort()
}
