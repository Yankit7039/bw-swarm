import { X } from 'lucide-react'

const fieldClass =
  'rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs transition focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20'

interface KeyValueEditorProps {
  label: string
  value: Record<string, string>
  onChange: (next: Record<string, string>) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  /** When true, values are shown as multiline (e.g. fallback_state) */
  multiline?: boolean
}

export function KeyValueEditor({
  label,
  value,
  onChange,
  keyPlaceholder = 'key',
  valuePlaceholder = 'value',
  multiline,
}: KeyValueEditorProps) {
  const entries = Object.entries(value)

  const updateKey = (oldKey: string, newKey: string) => {
    if (!newKey.trim() || (newKey !== oldKey && newKey in value)) return
    const next: Record<string, string> = {}
    for (const [k, v] of entries) {
      if (k === oldKey) next[newKey.trim()] = v
      else next[k] = v
    }
    onChange(next)
  }

  const updateVal = (k: string, v: string) => {
    onChange({ ...value, [k]: v })
  }

  const remove = (k: string) => {
    const next = { ...value }
    delete next[k]
    onChange(next)
  }

  const add = () => {
    let k = 'key'
    let n = 1
    while (k in value) {
      k = `key_${n++}`
    }
    onChange({ ...value, [k]: '' })
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        {label ? (
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
        ) : (
          <span />
        )}
        <button type="button" onClick={add} className="text-[10px] font-semibold text-primary hover:underline">
          + Add field
        </button>
      </div>
      <div className="space-y-2">
        {entries.length === 0 && (
          <p className="text-[10px] italic text-slate-400">No entries. Click &quot;Add field&quot;.</p>
        )}
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-start gap-2">
            <input
              type="text"
              className={`w-28 shrink-0 ${fieldClass}`}
              value={k}
              onChange={(e) => updateKey(k, e.target.value)}
              placeholder={keyPlaceholder}
            />
            {multiline ? (
              <textarea
                className={`min-h-[4rem] flex-1 ${fieldClass}`}
                value={v}
                onChange={(e) => updateVal(k, e.target.value)}
                placeholder={valuePlaceholder}
              />
            ) : (
              <input
                type="text"
                className={`flex-1 ${fieldClass}`}
                value={v}
                onChange={(e) => updateVal(k, e.target.value)}
                placeholder={valuePlaceholder}
              />
            )}
            <button
              type="button"
              className="shrink-0 p-1.5 text-slate-400 hover:text-rose-600"
              onClick={() => remove(k)}
              aria-label={`Remove ${k}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/** String-only map for YAML object values that may be nested — flattened as JSON strings for editing. */
export function recordToStringMap(obj: Record<string, unknown> | null | undefined): Record<string, string> {
  if (!obj) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') out[k] = v
    else out[k] = JSON.stringify(v)
  }
  return out
}

export function stringMapToRecord(map: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(map)) {
    const t = v.trim()
    if (t === 'true') out[k] = true
    else if (t === 'false') out[k] = false
    else if (t === 'null') out[k] = null
    else if (/^-?\d+(\.\d+)?$/.test(t) && !t.includes('e')) {
      const n = Number(t)
      if (!Number.isNaN(n)) out[k] = n
      else out[k] = v
    } else if (t.startsWith('{') || t.startsWith('[')) {
      try {
        out[k] = JSON.parse(t) as unknown
      } catch {
        out[k] = v
      }
    } else out[k] = v
  }
  return out
}
