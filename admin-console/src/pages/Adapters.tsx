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
    <div className="min-w-0 bg-white rounded-xl border border-slate-200 border-l-[3px] border-l-primary/25 shadow-sm hover:shadow-md hover:border-slate-300 hover:border-l-primary/35 transition-all p-5 flex flex-col gap-3 group">
      <div className="min-w-0 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <h4 className="font-bold text-slate-900 text-base group-hover:text-primary transition-colors min-w-0 break-words">
            {tool.tool_name}
          </h4>
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            <Wrench className="w-3 h-3" />
            MCP
          </span>
        </div>
        <code className="block text-xs font-mono bg-slate-100 text-slate-700 px-2 py-1.5 rounded-md max-w-full min-w-0 break-all overflow-x-auto">
          {tool.mcp_tool_name}
        </code>
        {tool.description && (
          <p className="text-sm text-slate-600 leading-relaxed break-words">{tool.description}</p>
        )}
      </div>

      {params.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight mb-2">Parameters</p>
          <ul className="space-y-2">
            {params.map((p) => (
              <li
                key={p.name}
                className="text-sm border-l-2 border-primary/30 pl-3 py-0.5 min-w-0 break-words"
              >
                <span className="font-mono font-semibold text-slate-800 break-all">{p.name}</span>
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

  const hasSearch = searchQuery.trim().length > 0
  const noSearchResults = hasSearch && displayAdapters.length === 0

  return (
    <Layout>
      <div className="w-full min-w-0 max-w-[1536px] mx-auto px-4 sm:px-6 pb-16">
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm px-5 py-6 sm:px-8 sm:py-7 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
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
          <>
            <div
              className="sticky top-0 z-10 -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 mb-8 border-b border-slate-200/90 bg-slate-50/95 backdrop-blur-md supports-[backdrop-filter]:bg-slate-50/80"
              aria-label="Find adapters and tools"
            >
              <div className="w-full min-w-0 flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
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
                      placeholder="Search adapters and tools…"
                      autoComplete="off"
                      aria-controls="adapter-tools-sections"
                      aria-describedby="adapter-tools-search-hint"
                      className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0 sm:w-48">
                    <label
                      htmlFor="adapter-sort"
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" aria-hidden />
                      Sort
                    </label>
                    <select
                      id="adapter-sort"
                      value={adapterSort}
                      onChange={(e) => setAdapterSort(e.target.value as AdapterSort)}
                      className="w-full rounded-xl border border-slate-200/90 bg-white py-2.5 pl-3 pr-9 text-sm text-slate-800 shadow-sm cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 hover:border-slate-300/90"
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
                <p id="adapter-tools-search-hint" className="text-xs text-slate-500">
                  Filter by adapter name or any tool name, identifier, or parameter.
                </p>
              </div>
            </div>

            {noSearchResults ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                <p className="text-slate-700 font-medium">No matching adapters or tools</p>
                <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
                  Try a different search, or clear the field to see everything again.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-5 text-sm font-bold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="flex gap-8 items-start">
                <div id="adapter-tools-sections" className="min-w-0 flex-1 space-y-14">
                  {displayAdapters.map((adapter: Adapter) => {
                    const sectionId = slugForAdapter(adapter.adapter_name)
                    const latest = maxUpdatedAt(adapter.tools)
                    return (
                      <section
                        key={adapter.adapter_name}
                        id={sectionId}
                        className="scroll-mt-36 min-w-0"
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4 mb-6 pb-4 border-b border-slate-200">
                          <div className="min-w-0 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                            <h2 className="text-2xl font-extrabold text-slate-900 break-words">
                              {adapter.adapter_name}
                            </h2>
                            <span className="text-sm text-slate-500 tabular-nums">
                              {adapter.tool_count} tool{adapter.tool_count === 1 ? '' : 's'}
                            </span>
                          </div>
                          {latest && (
                            <span className="text-xs text-slate-400 font-mono shrink-0 sm:text-right">
                              updated {latest}
                            </span>
                          )}
                        </div>
                        <div className="grid min-w-0 w-full grid-cols-1 xl:grid-cols-2 gap-6">
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
