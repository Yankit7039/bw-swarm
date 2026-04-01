import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Settings2 } from 'lucide-react'
import type { WorkflowDoc } from './types'
import { TagInput } from './TagInput'
import { KeyValueEditor } from './KeyValueEditor'

const inputClass =
  'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 transition focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40'

interface WorkflowMetaProps {
  doc: WorkflowDoc
  onChange: (next: WorkflowDoc) => void
  /** Adapter names from GET /adapters/ */
  adapterNames: string[]
}

export function WorkflowMeta({ doc, onChange, adapterNames }: WorkflowMetaProps) {
  const toolLabelMap = useMemo(() => doc.tool_labels, [doc.tool_labels])
  const [metaOpen, setMetaOpen] = useState(false)
  const [escalationJsonError, setEscalationJsonError] = useState<string | null>(null)

  const escalationText = useMemo(() => {
    if (!doc.escalation_matrix) return ''
    try {
      return JSON.stringify(doc.escalation_matrix, null, 2)
    } catch {
      return ''
    }
  }, [doc.escalation_matrix])

  const [escalationDraft, setEscalationDraft] = useState(escalationText)
  useEffect(() => {
    setEscalationDraft(escalationText)
  }, [escalationText])

  const set = (patch: Partial<WorkflowDoc>) => onChange({ ...doc, ...patch })

  const toggleAdapter = (name: string) => {
    const has = doc.adapters.includes(name)
    set({
      adapters: has ? doc.adapters.filter((a) => a !== name) : [...doc.adapters, name].sort(),
    })
  }

  const onEscalationBlur = (text: string) => {
    const t = text.trim()
    if (!t) {
      setEscalationJsonError(null)
      set({ escalation_matrix: null })
      return
    }
    try {
      const parsed = JSON.parse(t) as Record<string, unknown>
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setEscalationJsonError('Escalation matrix must be a JSON object')
        return
      }
      setEscalationJsonError(null)
      set({ escalation_matrix: parsed })
    } catch (e) {
      setEscalationJsonError(e instanceof Error ? e.message : 'Invalid JSON')
    }
  }

  const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setMetaOpen((v) => !v)}
        className="flex w-full items-center gap-3 border-b border-slate-100 px-5 py-4 text-left transition hover:bg-slate-50/80"
        aria-expanded={metaOpen}
      >
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 ${metaOpen ? 'rotate-90' : ''}`}
          aria-hidden
        />
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Settings2 className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900">Workflow metadata</h3>
          <p className="text-xs text-slate-500">Identity, model, and workflow inputs</p>
        </div>
      </button>

      {metaOpen && (
      <div className="space-y-8 p-5">
        <section className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Identity</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>template_id</label>
              <input
                type="text"
                className={`${inputClass} font-mono`}
                value={doc.template_id}
                onChange={(e) => set({ template_id: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>version</label>
              <input type="text" className={inputClass} value={doc.version} onChange={(e) => set({ version: e.target.value })} />
            </div>
          </div>

          <div>
            <label className={labelClass}>description</label>
            <textarea
              className={`${inputClass} min-h-[4rem] resize-y`}
              value={doc.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>

          <div>
            <label className={labelClass}>model</label>
            <input
              type="text"
              className={`${inputClass} font-mono`}
              placeholder="openrouter/..."
              value={doc.model ?? ''}
              onChange={(e) => set({ model: e.target.value.trim() ? e.target.value : null })}
            />
          </div>
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-8">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Inputs &amp; outputs</p>
          <TagInput
            label="input.required"
            values={doc.input.required}
            onChange={(required) => set({ input: { required } })}
            placeholder="Add required key (Enter)"
          />

          <TagInput
            label="result_keys"
            values={doc.result_keys}
            onChange={(result_keys) => set({ result_keys })}
            placeholder="Add result key"
          />
        </section>

        <section className="space-y-3 border-t border-slate-100 pt-8">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Adapters</p>
          <div>
            <label className={labelClass}>Allowed for this workflow</label>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-3">
              {adapterNames.length === 0 && <p className="text-xs text-slate-500">Loading adapters…</p>}
              <div className="flex flex-wrap gap-2">
                {adapterNames.map((name) => {
                  const selected = doc.adapters.includes(name)
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleAdapter(name)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold font-mono transition ${
                        selected
                          ? 'border border-primary/30 bg-primary/10 text-primary'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-8">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Advanced</p>
          <KeyValueEditor
            label="tool_labels (optional)"
            value={toolLabelMap}
            onChange={(tool_labels) => set({ tool_labels })}
            keyPlaceholder="tool name"
            valuePlaceholder="label"
          />

          <details className="group rounded-xl border border-slate-100 bg-slate-50/40">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Follow-up config</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-90" aria-hidden />
            </summary>
            <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">mode</label>
                  <select
                    className={`${inputClass} py-2`}
                    value={doc.follow_up?.mode ?? 'none'}
                    onChange={(e) => {
                      const mode = e.target.value as 'none' | 'agentmail'
                      set({
                        follow_up: {
                          mode,
                          limit: doc.follow_up?.limit ?? 3,
                          interval_seconds: doc.follow_up?.interval_seconds ?? 120,
                          email_result_key: doc.follow_up?.email_result_key,
                        },
                      })
                    }}
                  >
                    <option value="none">none</option>
                    <option value="agentmail">agentmail</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">limit</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={doc.follow_up?.limit ?? 3}
                    onChange={(e) =>
                      set({
                        follow_up: {
                          mode: doc.follow_up?.mode ?? 'none',
                          limit: Number(e.target.value) || 0,
                          interval_seconds: doc.follow_up?.interval_seconds ?? 120,
                          email_result_key: doc.follow_up?.email_result_key,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">interval_seconds</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={doc.follow_up?.interval_seconds ?? 120}
                    onChange={(e) =>
                      set({
                        follow_up: {
                          mode: doc.follow_up?.mode ?? 'none',
                          limit: doc.follow_up?.limit ?? 3,
                          interval_seconds: Number(e.target.value) || 0,
                          email_result_key: doc.follow_up?.email_result_key,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">email_result_key</label>
                  <input
                    type="text"
                    className={`${inputClass} font-mono`}
                    value={doc.follow_up?.email_result_key ?? ''}
                    onChange={(e) =>
                      set({
                        follow_up: {
                          mode: doc.follow_up?.mode ?? 'none',
                          limit: doc.follow_up?.limit ?? 3,
                          interval_seconds: doc.follow_up?.interval_seconds ?? 120,
                          email_result_key: e.target.value || undefined,
                        },
                      })
                    }
                  />
                </div>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-rose-600 hover:underline"
                onClick={() => set({ follow_up: null })}
              >
                Clear follow_up block
              </button>
            </div>
          </details>

          <details className="group rounded-xl border border-slate-100 bg-slate-50/40">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Escalation matrix (optional)</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-90" aria-hidden />
            </summary>
            <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
              <div>
                <label className={labelClass}>JSON object</label>
                <textarea
                  className="w-full min-h-[120px] resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs transition focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={escalationDraft}
                  onChange={(e) => setEscalationDraft(e.target.value)}
                  onBlur={(e) => onEscalationBlur(e.target.value)}
                  placeholder='{ "P1": { "L1": { "team": "..." } } }'
                />
                {escalationJsonError && <p className="mt-1 text-xs text-rose-600">{escalationJsonError}</p>}
              </div>
            </div>
          </details>
        </section>
      </div>
      )}
    </div>
  )
}
