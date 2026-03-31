import { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowUpDown,
  Puzzle,
  AlertTriangle,
  Layers,
  Wrench,
  Search,
  Plus,
} from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { TableOfContents } from '../components/TableOfContents'
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

function toolMatchesQuery(tool: AdapterTool, queryLower: string): boolean {
  if (!queryLower) return true
  const hay = [
    tool.tool_name,
    tool.mcp_tool_name,
    tool.description ?? '',
    ...paramRowsFromSchema(tool.input_schema).map((p) => p.name),
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(queryLower)
}

function filterAdaptersForSearch(adapters: Adapter[], rawQuery: string): Adapter[] {
  const queryLower = rawQuery.trim().toLowerCase()
  if (!queryLower) {
    return adapters
  }

  const out: Adapter[] = []
  for (const adapter of adapters) {
    const nameMatch = adapter.adapter_name.toLowerCase().includes(queryLower)
    const tools = nameMatch
      ? adapter.tools
      : adapter.tools.filter((t) => toolMatchesQuery(t, queryLower))
    if (tools.length === 0) continue
    out.push({
      ...adapter,
      tools,
      tool_count: tools.length,
    })
  }
  return out
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

type AdapterSort = 'name-asc' | 'name-desc' | 'tools-desc' | 'updated-desc'

const ADAPTER_SORT_OPTIONS: { value: AdapterSort; label: string }[] = [
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'tools-desc', label: 'Most tools first' },
  { value: 'updated-desc', label: 'Recently updated' },
]

function sortAdapters(adapters: Adapter[], sort: AdapterSort): Adapter[] {
  const copy = [...adapters]
  switch (sort) {
    case 'name-asc':
      return copy.sort((a, b) => a.adapter_name.localeCompare(b.adapter_name))
    case 'name-desc':
      return copy.sort((a, b) => b.adapter_name.localeCompare(a.adapter_name))
    case 'tools-desc':
      return copy.sort((a, b) => b.tool_count - a.tool_count || a.adapter_name.localeCompare(b.adapter_name))
    case 'updated-desc':
      return copy.sort((a, b) => {
        const ua = maxUpdatedAt(a.tools) ?? ''
        const ub = maxUpdatedAt(b.tools) ?? ''
        if (ua === ub) return a.adapter_name.localeCompare(b.adapter_name)
        if (!ua) return 1
        if (!ub) return -1
        return ub.localeCompare(ua)
      })
    default:
      return copy
  }
}

function ToolCard({ tool }: { tool: AdapterTool }) {
  const params = paramRowsFromSchema(tool.input_schema)
  const warnings = tool.docstring_warnings?.length ? tool.docstring_warnings : null

  return (
    <div className="min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300/90 transition-all flex flex-col overflow-hidden group">
      <div className="px-5 pt-5 pb-4 border-b border-slate-100/90 bg-gradient-to-b from-slate-50/40 to-white">
        <div className="flex items-start justify-between gap-3 min-w-0">
          <h4 className="font-bold text-slate-900 text-[15px] leading-snug group-hover:text-primary transition-colors min-w-0 break-words">
            {tool.tool_name}
          </h4>
          <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            <Wrench className="w-3 h-3 opacity-80" aria-hidden />
            MCP
          </span>
        </div>
        <code className="mt-2.5 block text-xs font-mono text-slate-600 bg-slate-100/80 px-2.5 py-1.5 rounded-md max-w-full min-w-0 break-all">
          {tool.mcp_tool_name}
        </code>
        {tool.description && (
          <p className="mt-3 text-sm text-slate-600 leading-relaxed break-words">{tool.description}</p>
        )}
      </div>

      <div className="px-5 py-4 flex flex-col gap-4 flex-1">
        {params.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              Parameters
            </p>
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 divide-y divide-slate-100/80">
              {params.map((p) => (
                <div key={p.name} className="px-3 py-2.5 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-mono text-sm font-semibold text-slate-800 break-all">
                      {p.name}
                      {p.required && <span className="text-rose-500 font-bold"> *</span>}
                    </span>
                    <span className="text-[10px] font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                      {p.typeLabel}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{p.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {warnings && (
          <div className="rounded-lg bg-amber-50/90 border border-amber-100 px-3 py-2.5 flex gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden />
            <ul className="text-xs text-amber-900/90 space-y-1 list-disc list-inside leading-relaxed">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export const Adapters = () => {
  const navigate = useNavigate()
  const { data: adapters, isLoading, isError, error } = useAdapters()
  const [searchQuery, setSearchQuery] = useState('')
  const [adapterSort, setAdapterSort] = useState<AdapterSort>('name-asc')

  const filteredAdapters = useMemo(
    () => (adapters?.length ? filterAdaptersForSearch(adapters, searchQuery) : []),
    [adapters, searchQuery]
  )

  const displayAdapters = useMemo(
    () => sortAdapters(filteredAdapters, adapterSort),
    [filteredAdapters, adapterSort]
  )

  const tocItems = useMemo(
    () =>
      displayAdapters.map((a) => ({
        id: slugForAdapter(a.adapter_name),
        label: a.adapter_name,
        toolCount: a.tool_count,
      })),
    [displayAdapters]
  )

  const totals = useMemo(() => {
    if (!adapters?.length) return null
    const toolTotal = adapters.reduce((n, a) => n + a.tool_count, 0)
    return { adapters: adapters.length, tools: toolTotal }
  }, [adapters])

  const hasSearch = searchQuery.trim().length > 0
  const noSearchResults = hasSearch && displayAdapters.length === 0

  return (
    <Layout>
      <div className="w-full px-6 lg:px-10 py-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div className="space-y-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/templates')}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              Back to Swarms
            </button>
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Puzzle className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Adapter tools</h1>
                <p className="text-slate-500 text-base mt-1 max-w-xl">
                  MCP tools exposed by the adapter service—use these names and parameters when authoring workflow YAML.
                </p>
                {totals && (
                  <p className="text-sm text-slate-400 mt-2 tabular-nums">
                    <span className="font-semibold text-slate-600">{totals.adapters}</span> adapters ·{' '}
                    <span className="font-semibold text-slate-600">{totals.tools}</span> tools
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              to="/templates"
              className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-slate-50 transition-colors"
            >
              Swarm workflows
            </Link>
            <Link
              to="/templates/new"
              className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-primary/20 hover:brightness-110 transition-all"
            >
              <Plus className="w-4 h-4" />
              Create template
            </Link>
          </div>
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-slate-100 bg-white">
            <div className="animate-spin w-9 h-9 border-2 border-primary border-t-transparent rounded-full" />
            <p className="text-slate-500 text-sm mt-4 font-medium">Loading adapters…</p>
          </div>
        )}

        {isError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-rose-800 text-sm"
          >
            {(error as Error)?.message || 'Failed to load adapters'}
          </div>
        )}

        {!isLoading && !isError && adapters && adapters.length === 0 && (
          <div className="text-center py-16 px-6 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-5">
              <Layers className="w-7 h-7" />
            </div>
            <p className="text-slate-800 font-semibold text-lg">No adapter tools registered</p>
            <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto leading-relaxed">
              When the adapter service is connected to this database, tool definitions appear here for template authors.
            </p>
          </div>
        )}

        {!isLoading && !isError && adapters && adapters.length > 0 && (
          <>
            <div className="mb-8 rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-5">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                    aria-hidden
                  />
                  <input
                    id="adapter-tools-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by adapter, tool name, MCP id, or parameter…"
                    autoComplete="off"
                    aria-controls="adapter-tools-sections"
                    aria-describedby="adapter-tools-search-hint"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 focus:bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1.5 shrink-0 w-full sm:w-52 lg:w-56">
                  <label
                    htmlFor="adapter-sort"
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" aria-hidden />
                    Sort
                  </label>
                  <select
                    id="adapter-sort"
                    value={adapterSort}
                    onChange={(e) => setAdapterSort(e.target.value as AdapterSort)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm text-slate-800 shadow-sm cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 hover:border-slate-300"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                    }}
                  >
                    {ADAPTER_SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p id="adapter-tools-search-hint" className="text-xs text-slate-500 mt-3">
                Filter the list without leaving the page. Table of contents updates with visible adapters.
              </p>
            </div>

            {noSearchResults ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
                <p className="text-slate-800 font-semibold">No matching adapters or tools</p>
                <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
                  Try another term, or clear the search to see the full catalog.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-6 text-sm font-bold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded px-1"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="flex gap-8 lg:gap-10 items-start">
                <div id="adapter-tools-sections" className="min-w-0 flex-1 space-y-16">
                  {displayAdapters.map((adapter: Adapter) => {
                    const sectionId = slugForAdapter(adapter.adapter_name)
                    const latest = maxUpdatedAt(adapter.tools)
                    return (
                      <section
                        key={adapter.adapter_name}
                        id={sectionId}
                        className="scroll-mt-28 min-w-0"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 mb-6">
                          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight break-words">
                              {adapter.adapter_name}
                            </h2>
                            <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-2.5 py-0.5 text-xs font-bold tabular-nums">
                              {adapter.tool_count} tool{adapter.tool_count === 1 ? '' : 's'}
                            </span>
                          </div>
                          {latest && (
                            <span className="text-xs text-slate-400 font-mono shrink-0">
                              Updated {latest}
                            </span>
                          )}
                        </div>
                        <div className="grid min-w-0 w-full grid-cols-1 xl:grid-cols-2 gap-5">
                          {adapter.tools.map((tool) => (
                            <ToolCard key={`${adapter.adapter_name}-${tool.tool_name}`} tool={tool} />
                          ))}
                        </div>
                      </section>
                    )
                  })}
                </div>
                {displayAdapters.length > 1 && <TableOfContents items={tocItems} />}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
