import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Adapter } from '../../../types/adapter'
import type { LlmAgentStep } from '../types'
import { KeyValueEditor, recordToStringMap, stringMapToRecord } from '../KeyValueEditor'

const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500'

const fieldSm =
  'w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs transition focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20'

interface LlmAgentStepFormProps {
  step: LlmAgentStep
  onChange: (next: LlmAgentStep) => void
  adapters: Adapter[]
  /** Known state keys from result_keys and output_keys in doc */
  knownStateKeys: string[]
}

export function LlmAgentStepForm({ step, onChange, adapters, knownStateKeys }: LlmAgentStepFormProps) {
  const allMcpTools = useMemo(() => {
    const list: { mcp_tool_name: string; description: string | null }[] = []
    for (const a of adapters) {
      for (const t of a.tools) {
        list.push({ mcp_tool_name: t.mcp_tool_name, description: t.description })
      }
    }
    return list.sort((x, y) => x.mcp_tool_name.localeCompare(y.mcp_tool_name))
  }, [adapters])

  const setField = (patch: Partial<LlmAgentStep>) => onChange({ ...step, ...patch })

  const fallbackMap = recordToStringMap(step.fallback_state ?? undefined)

  const toggleToolFilter = (name: string) => {
    const cur = step.tool_filter ?? []
    const has = cur.includes(name)
    setField({ tool_filter: has ? cur.filter((x) => x !== name) : [...cur, name] })
  }

  const toggleInputKey = (key: string) => {
    const cur = step.input_keys ?? []
    const has = cur.includes(key)
    setField({ input_keys: has ? cur.filter((x) => x !== key) : [...cur, key] })
  }

  const keysForPick = useMemo(() => {
    const s = new Set(knownStateKeys)
    if (step.input_keys) step.input_keys.forEach((k) => s.add(k))
    return Array.from(s).sort()
  }, [knownStateKeys, step.input_keys])

  return (
    <div className="space-y-4 text-sm">
      <div>
        <label className={`${labelClass} mb-1.5`}>description</label>
        <input
          type="text"
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm transition focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
          value={step.description ?? ''}
          onChange={(e) => setField({ description: e.target.value })}
        />
      </div>

      <div>
        <label className={`${labelClass} mb-1.5`}>instruction</label>
        <textarea
          className="min-h-[200px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm transition focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
          value={step.instruction}
          onChange={(e) => setField({ instruction: e.target.value })}
          spellCheck={false}
        />
      </div>

      <div>
        <label className={`${labelClass} mb-1`}>output_key</label>
        <input type="text" className={fieldSm} value={step.output_key ?? ''} onChange={(e) => setField({ output_key: e.target.value })} />
      </div>

      <details className="group mt-1 rounded-xl border border-slate-100 bg-slate-50/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Advanced</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-90" aria-hidden />
        </summary>
        <div className="space-y-4 border-t border-slate-100 px-4 pb-4 pt-3">
          <div>
            <label className={`${labelClass} mb-1`}>skip_if</label>
            <input
              type="text"
              className={fieldSm}
              value={step.skip_if ?? ''}
              onChange={(e) => setField({ skip_if: e.target.value || undefined })}
            />
          </div>

          <div>
            <label className={`${labelClass} mb-1.5 block`}>input_keys</label>
            <div className="flex min-h-[2.5rem] flex-wrap gap-1.5 rounded-xl border border-slate-100 bg-white p-2">
              {keysForPick.length === 0 && (
                <span className="text-[10px] text-slate-400">Add result_keys or output_keys to suggest inputs.</span>
              )}
              {keysForPick.map((k) => {
                const selected = (step.input_keys ?? []).includes(k)
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleInputKey(k)}
                    className={`cursor-pointer rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold transition ${
                      selected
                        ? 'border border-primary/20 bg-primary/10 text-primary'
                        : 'border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {k}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className={`${labelClass} mb-1.5 block`}>tool_filter (MCP tools)</label>
            {adapters.length === 0 && (
              <p className="mb-2 text-[10px] text-slate-500">Select one or more adapters under Workflow metadata to list tools here.</p>
            )}
            <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-100 bg-white p-2">
              <div className="flex flex-wrap gap-1.5">
                {allMcpTools.map((t) => {
                  const selected = (step.tool_filter ?? []).includes(t.mcp_tool_name)
                  const title = t.description ? `${t.mcp_tool_name} — ${t.description}` : t.mcp_tool_name
                  return (
                    <button
                      key={t.mcp_tool_name}
                      type="button"
                      title={title}
                      onClick={() => toggleToolFilter(t.mcp_tool_name)}
                      className={`max-w-full cursor-pointer truncate rounded-full px-2.5 py-0.5 text-left font-mono text-[11px] font-semibold transition ${
                        selected
                          ? 'border border-primary/20 bg-primary/10 text-primary'
                          : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {t.mcp_tool_name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div>
            <KeyValueEditor
              label="fallback_state (optional)"
              value={fallbackMap}
              onChange={(m) => setField({ fallback_state: Object.keys(m).length ? stringMapToRecord(m) : undefined })}
              multiline
            />
          </div>
        </div>
      </details>
    </div>
  )
}
