import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Adapter } from '../../../types/adapter'
import type { McpCallStep } from '../types'
import { splitMcpTool } from '../strings'
import { KeyValueEditor } from '../KeyValueEditor'

const labelClass = 'text-[10px] font-bold uppercase tracking-wider text-slate-500'

const fieldSm =
  'w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs transition focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20'

function getSchemaPropertyKeys(inputSchema: Record<string, unknown>): string[] {
  const props = inputSchema.properties
  if (!props || typeof props !== 'object' || Array.isArray(props)) return []
  return Object.keys(props as Record<string, unknown>)
}

function valueToString(v: unknown): string {
  if (v === undefined || v === null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function parseInputValue(raw: string): unknown {
  const t = raw.trim()
  if (t === 'true') return true
  if (t === 'false') return false
  if (t === 'null') return null
  if (t === '') return ''
  if (/^-?\d+(\.\d+)?$/.test(t) && !t.includes('e')) {
    const n = Number(t)
    if (!Number.isNaN(n)) return n
  }
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      return JSON.parse(t) as unknown
    } catch {
      return raw
    }
  }
  return raw
}

interface McpCallStepFormProps {
  step: McpCallStep
  onChange: (next: McpCallStep) => void
  adapters: Adapter[]
}

export function McpCallStepForm({ step, onChange, adapters }: McpCallStepFormProps) {
  const adapterNames = useMemo(() => adapters.map((a) => a.adapter_name).sort(), [adapters])

  const { adapter: inferredAdapter } = splitMcpTool(step.tool)
  const selectedAdapter =
    inferredAdapter && adapterNames.includes(inferredAdapter)
      ? inferredAdapter
      : adapterNames.find((n) => step.tool.startsWith(`${n}__`)) ?? (adapterNames[0] ?? '')

  const toolsForAdapter = useMemo(() => {
    const a = adapters.find((x) => x.adapter_name === selectedAdapter)
    return a?.tools ?? []
  }, [adapters, selectedAdapter])

  const selectedTool = toolsForAdapter.find((t) => t.mcp_tool_name === step.tool)

  const propKeys = useMemo(() => {
    const schema = selectedTool?.input_schema
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return []
    return getSchemaPropertyKeys(schema as Record<string, unknown>)
  }, [selectedTool])

  const inputBindings = step.input_bindings ?? {}

  const setField = (patch: Partial<McpCallStep>) => onChange({ ...step, ...patch })

  const onAdapterChange = (adapterName: string) => {
    const a = adapters.find((x) => x.adapter_name === adapterName)
    const first = a?.tools?.[0]
    const tool = first?.mcp_tool_name ?? ''
    onChange({
      ...step,
      tool,
      input: first
        ? buildDefaultInputFromSchema(first.input_schema as Record<string, unknown>)
        : {},
    })
  }

  const onToolPick = (mcpToolName: string) => {
    const t = toolsForAdapter.find((x) => x.mcp_tool_name === mcpToolName)
    setField({
      tool: mcpToolName,
      input: t ? buildDefaultInputFromSchema(t.input_schema as Record<string, unknown>, step.input) : {},
    })
  }

  const onInputKeyChange = (key: string, raw: string) => {
    const next = { ...step.input, [key]: parseInputValue(raw) }
    setField({ input: next })
  }

  const bindingEntries = Object.entries(inputBindings).map(([k, v]) => [k, v] as [string, string])

  const selectClass = `${fieldSm} mt-0.5 text-sm`

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={`mb-1 block ${labelClass}`}>Adapter</label>
          {adapters.length === 0 && (
            <p className="mb-1 mt-0.5 text-[10px] text-slate-500">Select adapters under Workflow metadata first.</p>
          )}
          <select className={selectClass} value={selectedAdapter} onChange={(e) => onAdapterChange(e.target.value)}>
            <option value="">— Select —</option>
            {adapterNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={`mb-1 block ${labelClass}`}>Tool (mcp_tool_name)</label>
          <select
            className={selectClass}
            value={step.tool}
            onChange={(e) => onToolPick(e.target.value)}
            disabled={!selectedAdapter}
          >
            <option value="">— Select tool —</option>
            {toolsForAdapter.map((t) => (
              <option key={t.mcp_tool_name} value={t.mcp_tool_name}>
                {t.tool_name} — {t.mcp_tool_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedTool?.description && (
        <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs italic text-slate-600">{selectedTool.description}</p>
      )}

      <div>
        <label className={`mb-1 block ${labelClass}`}>input</label>
        {propKeys.length > 0 ? (
          <div className="mt-1 space-y-2">
            {propKeys.map((key) => (
              <div key={key}>
                <label className="font-mono text-[10px] text-slate-500">{key}</label>
                <input
                  type="text"
                  className={`${fieldSm} mt-0.5`}
                  value={valueToString(step.input[key])}
                  onChange={(e) => onInputKeyChange(key, e.target.value)}
                  placeholder="Value or {{ expression }}"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-[10px] text-slate-400">Select a tool to edit inputs, or use raw JSON below.</p>
        )}
        <details className="group mt-2 rounded-xl border border-slate-100 bg-slate-50/40">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Raw input keys (advanced)</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-90" aria-hidden />
          </summary>
          <div className="space-y-2 border-t border-slate-100 px-4 pb-4 pt-3">
            {Object.keys(step.input).map((key) =>
              propKeys.includes(key) ? null : (
                <div key={key} className="flex gap-2">
                  <span className="w-32 shrink-0 font-mono text-xs">{key}</span>
                  <input
                    type="text"
                    className={`flex-1 ${fieldSm}`}
                    value={valueToString(step.input[key])}
                    onChange={(e) => onInputKeyChange(key, e.target.value)}
                  />
                </div>
              )
            )}
            <button
              type="button"
              className="text-[10px] font-semibold text-primary hover:underline"
              onClick={() => {
                const k = prompt('Input key name')
                if (k?.trim()) setField({ input: { ...step.input, [k.trim()]: '' } })
              }}
            >
              + Add input field
            </button>
          </div>
        </details>
      </div>

      <details className="group mt-1 rounded-xl border border-slate-100 bg-slate-50/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Advanced</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-90" aria-hidden />
        </summary>
        <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`mb-1 block ${labelClass}`}>output_key</label>
              <input type="text" className={fieldSm} value={step.output_key ?? ''} onChange={(e) => setField({ output_key: e.target.value })} />
            </div>
            <div>
              <label className={`mb-1 block ${labelClass}`}>skip_if</label>
              <input
                type="text"
                className={fieldSm}
                value={step.skip_if ?? ''}
                onChange={(e) => setField({ skip_if: e.target.value || undefined })}
                placeholder="optional expression"
              />
            </div>
          </div>

          <div>
            <label className={`mb-1 block ${labelClass}`}>input_bindings (optional)</label>
            <KeyValueEditor
              label=""
              value={Object.fromEntries(bindingEntries)}
              onChange={(m) => setField({ input_bindings: Object.keys(m).length ? m : undefined })}
              keyPlaceholder="state key"
              valuePlaceholder="expression e.g. label_plan['labels_to_add']"
            />
          </div>

          <div>
            <label className={`mb-1 block ${labelClass}`}>event_parent_agent (optional)</label>
            <input
              type="text"
              className={fieldSm}
              value={step.event_parent_agent ?? ''}
              onChange={(e) => setField({ event_parent_agent: e.target.value || undefined })}
            />
          </div>
        </div>
      </details>
    </div>
  )
}

function buildDefaultInputFromSchema(
  inputSchema: Record<string, unknown>,
  previous?: Record<string, unknown>
): Record<string, unknown> {
  const keys = getSchemaPropertyKeys(inputSchema)
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    if (previous && k in previous) out[k] = previous[k]
    else out[k] = ''
  }
  return out
}
