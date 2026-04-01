import { useState, KeyboardEvent } from 'react'
import { X } from 'lucide-react'

interface TagInputProps {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  hint?: string
}

export function TagInput({ label, values, onChange, placeholder, hint }: TagInputProps) {
  const [input, setInput] = useState('')

  const add = (raw: string) => {
    const t = raw.trim()
    if (!t || values.includes(t)) return
    onChange([...values, t])
    setInput('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(input)
    } else if (e.key === 'Backspace' && !input && values.length) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
      {hint && <p className="mb-1 text-[10px] text-slate-500">{hint}</p>}
      <div className="flex min-h-[2.25rem] flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5 focus-within:ring-2 focus-within:ring-primary/20">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary"
          >
            {v}
            <button
              type="button"
              className="rounded p-0.5 text-primary/70 hover:bg-primary/10 hover:text-primary"
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          className="min-w-[8rem] flex-1 border-0 bg-transparent py-0.5 text-sm outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => input.trim() && add(input)}
          placeholder={placeholder}
        />
      </div>
    </div>
  )
}
