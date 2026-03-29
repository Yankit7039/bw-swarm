import { useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Puzzle,
  AlertTriangle,
  Layers,
  Wrench,
} from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { useAdapters } from '../hooks/useAdapters'
import type { Adapter, AdapterTool } from '../types/adapter'

function slugForAdapter(name: string): string {
  return `adapter-${encodeURIComponent(name).replace(/%/g, '_')}`
}

type ParamRow = {
  name: string
  typeLabel: string
  required: boolean
  description?: string
}

function paramRowsFromSchema(inputSchema: Record<string, unknown>): ParamRow[] {
  const props = inputSchema.properties
  if (!props || typeof props !== 'object' || Array.isArray(props)) {
    return []
  }
  const requiredSet = new Set(
    Array.isArray(inputSchema.required) ? (inputSchema.required as unknown[]).map(String) : []
  )
  const rows: ParamRow[] = []
  for (const [name, def] of Object.entries(props as Record<string, unknown>)) {
    if (!def || typeof def !== 'object' || Array.isArray(def)) {
      rows.push({
        name,
        typeLabel: 'any',
        required: requiredSet.has(name),
      })
      continue
    }
    const d = def as Record<string, unknown>
    let typeLabel = 'any'
    if (typeof d.type === 'string') {
      typeLabel = d.type
    } else if (Array.isArray(d.type)) {
      typeLabel = d.type.map(String).join(' | ')
    }
    rows.push({
      name,
      typeLabel,
      required: requiredSet.has(name),
      description: typeof d.description === 'string' ? d.description : undefined,
    })
  }
  return rows
}

function maxUpdatedAt(tools: AdapterTool[]): string | null {
  let best: string | null = null
  for (const t of tools) {
    const u = t.updated_at
    if (!u) continue
    if (!best || u > best) best = u
  }
  return best
}

function ToolCard({ tool }: { tool: AdapterTool }) {
  const params = paramRowsFromSchema(tool.input_schema)
  const warnings = tool.docstring_warnings?.length ? tool.docstring_warnings : null

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all p-5 flex flex-col gap-3 group">
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-bold text-slate-900 text-base group-hover:text-primary transition-colors">
            {tool.tool_name}
          </h4>
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            <Wrench className="w-3 h-3" />
            MCP
          </span>
        </div>
        <code className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded-md w-fit max-w-full break-all">
          {tool.mcp_tool_name}
        </code>
        {tool.description && (
          <p className="text-sm text-slate-600 leading-relaxed">{tool.description}</p>
        )}
      </div>

      {params.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight mb-2">Parameters</p>
          <ul className="space-y-2">
            {params.map((p) => (
              <li
                key={p.name}
                className="text-sm border-l-2 border-primary/30 pl-3 py-0.5"
              >
                <span className="font-mono font-semibold text-slate-800">{p.name}</span>
                {p.required && <span className="text-rose-500 font-bold ml-0.5">*</span>}
                <span className="ml-2 text-[11px] font-mono text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">
                  {p.typeLabel}
                </span>
                {p.description && (
                  <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings && (
        <div className="rounded-lg bg-amber-50 border border-amber-200/80 px-3 py-2 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <ul className="text-xs text-amber-900 space-y-1 list-disc list-inside">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export const Adapters = () => {
  const navigate = useNavigate()
  const { data: adapters, isLoading, isError, error } = useAdapters()

  const scrollToAdapter = useCallback((adapterName: string) => {
    const id = slugForAdapter(adapterName)
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pb-16">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8 pt-2">
          <div>
            <button
              type="button"
              onClick={() => navigate('/templates')}
              className="flex items-center gap-2 text-slate-500 hover:text-primary text-sm font-medium mb-3 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Swarms
            </button>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Puzzle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Adapter tools</h1>
                <p className="text-slate-500 text-base mt-0.5">
                  Reference for MCP tools available when authoring workflow YAML.
                </p>
              </div>
            </div>
          </div>
          <Link
            to="/templates/new"
            className="shrink-0 self-start text-sm font-bold text-primary hover:underline"
          >
            Create template
          </Link>
        </div>

        {isLoading && (
          <div className="text-center py-24">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-slate-500 text-sm mt-4">Loading adapters…</p>
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 text-sm">
            {(error as Error)?.message || 'Failed to load adapters'}
          </div>
        )}

        {!isLoading && !isError && adapters && adapters.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No adapter tools registered yet</p>
            <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
              When the adapter service runs against this database, tool definitions appear here for template authors.
            </p>
          </div>
        )}

        {!isLoading && !isError && adapters && adapters.length > 0 && (
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
            <nav
              className="w-full lg:w-64 shrink-0 lg:sticky lg:top-24 space-y-1"
              aria-label="Adapters"
            >
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
                Jump to adapter
              </p>
              {adapters.map((a) => (
                <button
                  key={a.adapter_name}
                  type="button"
                  onClick={() => scrollToAdapter(a.adapter_name)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all flex items-center justify-between gap-2"
                >
                  <span className="truncate">{a.adapter_name}</span>
                  <span className="shrink-0 text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    {a.tool_count}
                  </span>
                </button>
              ))}
            </nav>

            <div className="flex-1 min-w-0 space-y-14">
              {adapters.map((adapter: Adapter) => {
                const sectionId = slugForAdapter(adapter.adapter_name)
                const latest = maxUpdatedAt(adapter.tools)
                return (
                  <section
                    key={adapter.adapter_name}
                    id={sectionId}
                    className="scroll-mt-24"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-6 pb-4 border-b border-slate-200">
                      <h2 className="text-2xl font-extrabold text-slate-900">{adapter.adapter_name}</h2>
                      <span className="text-sm text-slate-500">
                        {adapter.tool_count} tool{adapter.tool_count === 1 ? '' : 's'}
                      </span>
                      {latest && (
                        <span className="text-xs text-slate-400 font-mono ml-auto">
                          updated {latest}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {adapter.tools.map((tool) => (
                        <ToolCard key={`${adapter.adapter_name}-${tool.tool_name}`} tool={tool} />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
