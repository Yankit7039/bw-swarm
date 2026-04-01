import type { ConditionBranch, ConditionStep } from '../types'
import { KeyValueEditor, recordToStringMap, stringMapToRecord } from '../KeyValueEditor'

const fieldSm =
  'w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs transition focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20'

interface ConditionStepFormProps {
  step: ConditionStep
  onChange: (next: ConditionStep) => void
}

function branchSetToMap(set: Record<string, unknown>): Record<string, string> {
  return recordToStringMap(set)
}

function mapToBranchSet(map: Record<string, string>): Record<string, unknown> {
  return stringMapToRecord(map)
}

export function ConditionStepForm({ step, onChange }: ConditionStepFormProps) {
  const setField = (patch: Partial<ConditionStep>) => onChange({ ...step, ...patch })

  const updateBranch = (index: number, next: ConditionBranch) => {
    const branches = [...step.branches]
    branches[index] = next
    setField({ branches })
  }

  const addBranch = () => {
    setField({
      branches: [...step.branches, { if: '', set: {} }],
    })
  }

  const removeBranch = (index: number) => {
    setField({ branches: step.branches.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-[10px] text-slate-500">
        Each branch can have an <code className="font-mono">if</code> expression, or{' '}
        <code className="font-mono">else: true</code> for a fallback. <code className="font-mono">set</code> updates
        workflow state.
      </p>

      {step.branches.map((br, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Branch {i + 1}</span>
            <button
              type="button"
              className="text-xs font-semibold text-rose-500 hover:text-rose-600 hover:underline"
              onClick={() => removeBranch(i)}
            >
              Remove
            </button>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">if (expression)</label>
            <input
              type="text"
              className={fieldSm}
              value={br.if ?? ''}
              onChange={(e) =>
                updateBranch(i, {
                  ...br,
                  if: e.target.value || undefined,
                  else: e.target.value ? undefined : br.else,
                })
              }
              placeholder='e.g. order_status["status"] == "COMPLETED"'
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-primary focus:ring-primary/20"
              checked={br.else === true}
              onChange={(e) =>
                updateBranch(i, {
                  ...br,
                  else: e.target.checked ? true : undefined,
                  if: e.target.checked ? undefined : br.if,
                })
              }
            />
            Else branch (else: true)
          </label>
          <KeyValueEditor
            label="set"
            value={branchSetToMap(br.set)}
            onChange={(m) => updateBranch(i, { ...br, set: mapToBranchSet(m) })}
            multiline
          />
        </div>
      ))}

      <button
        type="button"
        className="text-xs font-semibold text-primary hover:underline"
        onClick={addBranch}
      >
        + Add branch
      </button>
    </div>
  )
}
