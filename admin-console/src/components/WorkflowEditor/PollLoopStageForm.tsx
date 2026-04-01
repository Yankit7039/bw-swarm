import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Adapter } from '../../types/adapter'
import type { EscalationLadderEntry, McpCallStep, PollLoopStage } from './types'
import { McpCallStepForm } from './steps/McpCallStepForm'

interface PollLoopStageFormProps {
  stage: PollLoopStage
  onChange: (next: PollLoopStage) => void
  adapters: Adapter[]
}

export function PollLoopStageForm({ stage, onChange, adapters }: PollLoopStageFormProps) {
  const set = (patch: Partial<PollLoopStage>) => onChange({ ...stage, ...patch })

  const updatePollStep = (index: number, next: McpCallStep) => {
    const poll_steps = [...stage.poll_steps]
    poll_steps[index] = next
    set({ poll_steps })
  }

  const addPollStep = () => {
    const empty: McpCallStep = { type: 'mcp_call', tool: '', input: {} }
    set({ poll_steps: [...stage.poll_steps, empty] })
  }

  const removePollStep = (index: number) => {
    set({ poll_steps: stage.poll_steps.filter((_, i) => i !== index) })
  }

  const movePollStep = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= stage.poll_steps.length) return
    const poll_steps = [...stage.poll_steps]
    ;[poll_steps[index], poll_steps[j]] = [poll_steps[j], poll_steps[index]]
    set({ poll_steps })
  }

  const updateLadder = (index: number, next: EscalationLadderEntry) => {
    const escalation_ladder = [...stage.escalation_ladder]
    escalation_ladder[index] = next
    set({ escalation_ladder })
  }

  const addLadder = () => {
    const n = stage.escalation_ladder.length + 1
    set({
      escalation_ladder: [
        ...stage.escalation_ladder,
        { iteration: n, level: 'L1', label: `Step ${n}` },
      ],
    })
  }

  const removeLadder = (index: number) => {
    set({ escalation_ladder: stage.escalation_ladder.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <label className="text-[10px] font-semibold text-slate-500">interval_seconds</label>
          <input
            type="number"
            className="w-full text-sm border border-slate-200 rounded px-2 py-1.5"
            value={stage.interval_seconds}
            onChange={(e) => set({ interval_seconds: Number(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-500">max_iterations</label>
          <input
            type="number"
            className="w-full text-sm border border-slate-200 rounded px-2 py-1.5"
            value={stage.max_iterations}
            onChange={(e) => set({ max_iterations: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-semibold text-slate-500">exit_if</label>
          <input
            type="text"
            className="w-full text-xs font-mono border border-slate-200 rounded px-2 py-1.5"
            value={stage.exit_if}
            onChange={(e) => set({ exit_if: e.target.value })}
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-slate-700">poll_steps (mcp_call only)</span>
          <button type="button" className="text-xs text-primary font-semibold" onClick={addPollStep}>
            + Add poll step
          </button>
        </div>
        <div className="space-y-3">
          {stage.poll_steps.map((st, i) => (
            <details key={i} className="border border-slate-200 rounded-lg bg-white open:shadow-sm">
              <summary className="px-3 py-2 cursor-pointer text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span className="font-mono">{st.name || st.tool || `poll_steps[${i}]`}</span>
                <span className="flex gap-1" onClick={(e) => e.preventDefault()}>
                  <button
                    type="button"
                    className="p-1 text-slate-400 hover:text-slate-700"
                    onClick={() => movePollStep(i, -1)}
                    aria-label="Move up"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="p-1 text-slate-400 hover:text-slate-700"
                    onClick={() => movePollStep(i, 1)}
                    aria-label="Move down"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="text-[10px] text-rose-600 ml-2"
                    onClick={() => removePollStep(i)}
                  >
                    Remove
                  </button>
                </span>
              </summary>
              <div className="px-3 pb-3 border-t border-slate-100 pt-2">
                <div className="mb-2">
                  <label className="text-[10px] text-slate-500">step name (optional)</label>
                  <input
                    type="text"
                    className="w-full text-xs font-mono border border-slate-200 rounded px-2 py-1"
                    value={st.name ?? ''}
                    onChange={(e) =>
                      updatePollStep(i, { ...st, name: e.target.value || undefined })
                    }
                  />
                </div>
                <McpCallStepForm step={st} onChange={(next) => updatePollStep(i, next)} adapters={adapters} />
              </div>
            </details>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-slate-700">escalation_ladder</span>
          <button type="button" className="text-xs text-primary font-semibold" onClick={addLadder}>
            + Add entry
          </button>
        </div>
        <div className="space-y-2">
          {stage.escalation_ladder.map((entry, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-2">
              <div className="flex justify-end">
                <button type="button" className="text-[10px] text-rose-600" onClick={() => removeLadder(i)}>
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500">iteration</label>
                  <input
                    type="number"
                    className="w-full text-sm border border-slate-200 rounded px-2 py-1"
                    value={entry.iteration}
                    onChange={(e) =>
                      updateLadder(i, { ...entry, iteration: Number(e.target.value) || 1 })
                    }
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">level</label>
                  <input
                    type="text"
                    className="w-full text-sm border border-slate-200 rounded px-2 py-1"
                    value={entry.level ?? ''}
                    onChange={(e) => updateLadder(i, { ...entry, level: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">label</label>
                  <input
                    type="text"
                    className="w-full text-sm border border-slate-200 rounded px-2 py-1"
                    value={entry.label ?? ''}
                    onChange={(e) => updateLadder(i, { ...entry, label: e.target.value })}
                  />
                </div>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-primary">Optional MCP steps for this rung</summary>
                <div className="mt-2 space-y-2 pl-2 border-l-2 border-slate-200">
                  {(entry.steps ?? []).map((st, j) => (
                    <div key={j} className="border border-slate-200 rounded p-2 bg-white">
                      <McpCallStepForm
                        step={st}
                        onChange={(next) => {
                          const steps = [...(entry.steps ?? [])]
                          steps[j] = next
                          updateLadder(i, { ...entry, steps })
                        }}
                        adapters={adapters}
                      />
                      <button
                        type="button"
                        className="text-[10px] text-rose-600 mt-1"
                        onClick={() => {
                          const steps = (entry.steps ?? []).filter((_, k) => k !== j)
                          updateLadder(i, { ...entry, steps: steps.length ? steps : undefined })
                        }}
                      >
                        Remove nested step
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-[10px] text-primary"
                    onClick={() => {
                      const steps = [...(entry.steps ?? []), { type: 'mcp_call' as const, tool: '', input: {} }]
                      updateLadder(i, { ...entry, steps })
                    }}
                  >
                    + Add MCP step
                  </button>
                </div>
              </details>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
