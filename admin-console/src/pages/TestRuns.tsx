import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CheckCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  BarChart3,
  Layers,
  // Eye,
  Network,
  Zap,
} from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { runsApi } from '../api/runs'
import { useTemplates } from '../hooks/useTemplates'

interface BatchResult {
  order_id: string
  run_id?: string
  status: 'success' | 'error' | 'pending'
  error?: string
  triggered_at?: string
  completed_at?: string
}

const DELAY_OPTIONS = [
  { label: 'No delay (0 seconds)', value: 0 },
  { label: '1 second', value: 1 },
  { label: '2 seconds', value: 2 },
  { label: '3 seconds', value: 3 },
  { label: '5 seconds', value: 5 },
  { label: '10 seconds', value: 10 },
]

/** Editorial / M3-inspired tokens (reference design) */
const c = {
  surface: 'bg-[#f7f9fb]',
  onSurface: 'text-[#2a3439]',
  onSurfaceVariant: 'text-[#566166]',
  surfaceLow: 'bg-[#f0f4f7]',
  surfaceLowest: 'bg-white',
  surfaceContainer: 'bg-[#e8eff3]',
  primary: 'text-[#6d3bd7]',
  primaryBg: 'bg-[#e9ddff]',
  primaryOnContainer: 'text-[#6029c9]',
  outlineVariant: 'border-[#a9b4b9]/40',
}

const clampBatch = (n: number) => Math.min(500, Math.max(1, Number.isFinite(n) ? n : 1))

export const TestRuns = () => {
  const navigate = useNavigate()
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [startOrderId, setStartOrderId] = useState<number>(1)
  const [batchSize, setBatchSize] = useState<number>(10)
  const [batchSizeDraft, setBatchSizeDraft] = useState<string>('10')
  const [orderPrefix, setOrderPrefix] = useState<string>('ORD-')
  const [delaySeconds, setDelaySeconds] = useState<number>(0)
  const [batchResults, setBatchResults] = useState<BatchResult[] | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionName, setSessionName] = useState<string>('')
  const [currentRunIndex, setCurrentRunIndex] = useState<number>(0)

  const { data: templates } = useTemplates(100, 0)

  const updateBatchSize = (n: number) => {
    const c = clampBatch(n)
    setBatchSize(c)
    setBatchSizeDraft(String(c))
  }

  const generateOrderIds = (start: number, count: number, prefix: string): string[] => {
    return Array.from({ length: count }, (_, i) => {
      const num = start + i
      return `${prefix}${String(num)}`
    })
  }

  const delay = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  const handleRunBatch = async () => {
    if (!selectedTemplate) return

    setIsRunning(true)
    setCurrentRunIndex(0)
    setBatchResults([])

    const orderIds = generateOrderIds(startOrderId, batchSize, orderPrefix)
    const results: BatchResult[] = []

    orderIds.forEach((orderId) => {
      results.push({
        order_id: orderId,
        status: 'pending' as const,
      })
    })
    setBatchResults([...results])

    for (let i = 0; i < orderIds.length; i++) {
      const orderId = orderIds[i]
      setCurrentRunIndex(i)

      if (i > 0 && delaySeconds > 0) {
        await delay(delaySeconds * 1000)
      }

      const triggeredAt = new Date().toISOString()

      try {
        const result = await runsApi.trigger({
          template_id: selectedTemplate,
          order_id: orderId,
        })

        const resultIndex = results.findIndex((r) => r.order_id === orderId)
        if (resultIndex !== -1) {
          results[resultIndex] = {
            order_id: orderId,
            run_id: result.run_id,
            status: 'pending',
            triggered_at: triggeredAt,
          }
        }
        setBatchResults([...results])
      } catch (error) {
        const resultIndex = results.findIndex((r) => r.order_id === orderId)
        if (resultIndex !== -1) {
          results[resultIndex] = {
            order_id: orderId,
            status: 'error',
            error: error instanceof Error ? error.message : 'Failed to trigger run',
            triggered_at: triggeredAt,
          }
        }
        setBatchResults([...results])
      }
    }

    const pendingRuns = results.filter((r) => r.run_id && r.status === 'pending')
    const pollInterval = setInterval(async () => {
      let allComplete = true

      for (const result of pendingRuns) {
        if (!result.run_id) continue

        try {
          const run = await runsApi.get(result.run_id)
          const resultIndex = results.findIndex((r) => r.order_id === result.order_id)

          if (resultIndex !== -1) {
            if (run.status === 'completed') {
              results[resultIndex] = {
                ...results[resultIndex],
                status: 'success',
                completed_at: new Date().toISOString(),
              }
            } else if (run.status === 'failed') {
              results[resultIndex] = {
                ...results[resultIndex],
                status: 'error',
                completed_at: new Date().toISOString(),
              }
            } else {
              allComplete = false
            }
          }
        } catch {
          allComplete = false
        }
      }

      setBatchResults([...results])

      if (allComplete) {
        clearInterval(pollInterval)
        setIsRunning(false)
        setCurrentRunIndex(0)
      }
    }, 2000)

    setTimeout(() => {
      clearInterval(pollInterval)
      setIsRunning(false)
      setCurrentRunIndex(0)
    }, 5 * 60 * 1000)
  }

  // const handleViewVisualization = () => {
  //   if (!selectedTemplate) return
  //   const params = new URLSearchParams({
  //     templateId: selectedTemplate,
  //     prefix: orderPrefix,
  //     start: String(startOrderId),
  //     count: String(batchSize),
  //     delaySeconds: String(delaySeconds),
  //     startedAt: new Date().toISOString(),
  //     name: sessionName || '',
  //   })
  //   navigate(`/bulk-visualization?${params.toString()}`)
  // }

  const handleViewExecutionMesh = () => {
    if (!selectedTemplate) return
    const params = new URLSearchParams({
      templateId: selectedTemplate,
      prefix: orderPrefix,
      start: String(startOrderId),
      count: String(batchSize),
      delaySeconds: String(delaySeconds),
      startedAt: new Date().toISOString(),
      name: sessionName || '',
    })
    navigate(`/execution-mesh?${params.toString()}`)
  }

  const successCount = batchResults?.filter((r) => r.status === 'success').length || 0
  const errorCount = batchResults?.filter((r) => r.status === 'error').length || 0
  const pendingCount = batchResults?.filter((r) => r.status === 'pending').length || 0

  // const previewIds = generateOrderIds(startOrderId, Math.min(10, batchSize), orderPrefix)
  // const moreCount = Math.max(0, batchSize - 10)
  // const completedRuns = successCount + errorCount
  // const healthPct =
  //   batchResults && batchResults.length > 0
  //     ? Math.round((completedRuns / batchResults.length) * 100)
  //     : 72

  const labelClass = `block font-body text-sm font-semibold ${c.onSurfaceVariant}`

  return (
    <Layout>
      <div className={`min-h-full font-body ${c.surface} ${c.onSurface}`}>
        <div className="w-full max-w-[1400px] mx-auto px-6 lg:px-10 py-8 pb-16">
          {/* Page header */}
          <div className="mb-10">
            <h2 className={`font-headline text-3xl sm:text-4xl font-extrabold tracking-tight mb-2 ${c.onSurface}`}>
              {/* Batch Configuration */}
              Test Runs
            </h2>
            <p className={`${c.onSurfaceVariant} text-sm sm:text-base max-w-2xl leading-relaxed`}>
              Define your test parameters and orchestrate high-precision swarms. Every run is audited for performance and
              consistency.
            </p>
          </div>

          <div className="grid grid-cols-12 gap-8">
            {/* Main form — Runner Settings */}
            <div className={`col-span-12 lg:col-span-8 ${c.surfaceLowest} rounded-[1.5rem] p-6 sm:p-8 shadow-sm border ${c.outlineVariant}`}>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl ${c.primaryBg} flex items-center justify-center ${c.primary}`}
                  >
                    <SlidersHorizontal className="w-5 h-5" strokeWidth={2} />
                  </div>
                  <h3 className="font-headline text-xl font-bold">Runner Settings</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="space-y-2">
                  <label className={labelClass}>Template</label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className={`w-full ${c.surfaceLow} border-0 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-[#6d3bd7]/20 outline-none appearance-none cursor-pointer`}
                  >
                    <option value="">Select a template</option>
                    {templates?.data?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Session Name</label>
                  <input
                    type="text"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="My bulk run session"
                    className={`w-full ${c.surfaceLow} border-0 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-[#6d3bd7]/20 outline-none placeholder:text-[#566166]/50`}
                  />
                </div>

                <div className="space-y-2 md:col-span-1">
                  <label className={labelClass}>Number of Runs</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={1}
                      max={500}
                      value={batchSize}
                      onChange={(e) => updateBatchSize(Number(e.target.value))}
                      className="flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-[#6d3bd7] bg-[#e8eff3]"
                    />
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={batchSizeDraft}
                      onChange={(e) => {
                        const v = e.target.value
                        setBatchSizeDraft(v)
                        const n = parseInt(v, 10)
                        if (!Number.isNaN(n)) setBatchSize(clampBatch(n))
                      }}
                      onBlur={() => {
                        const n = parseInt(batchSizeDraft, 10)
                        if (Number.isNaN(n) || batchSizeDraft.trim() === '') updateBatchSize(1)
                        else updateBatchSize(n)
                      }}
                      className={`text-sm font-bold w-14 sm:w-16 text-center ${c.primaryBg} ${c.primaryOnContainer} py-2 rounded-lg border-0 focus:ring-2 focus:ring-[#6d3bd7]/20 outline-none`}
                    />
                  </div>
                  <p className="text-xs text-[#566166]/80">1–500 runs. Adjust with the slider or type a value.</p>
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Delay Between Runs</label>
                  <select
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10))}
                    className={`w-full ${c.surfaceLow} border-0 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-[#6d3bd7]/20 outline-none appearance-none cursor-pointer`}
                  >
                    {DELAY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Order ID Prefix</label>
                  <input
                    type="text"
                    value={orderPrefix}
                    onChange={(e) => setOrderPrefix(e.target.value)}
                    placeholder="ORD-"
                    className={`w-full ${c.surfaceLow} border-0 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-[#6d3bd7]/20 outline-none placeholder:text-[#566166]/50`}
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Start From Index</label>
                  <input
                    type="text"
                    value={startOrderId}
                    onChange={(e) => setStartOrderId(parseInt(e.target.value, 10) || 0)}
                    className={`w-full ${c.surfaceLow} border-0 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-[#6d3bd7]/20 outline-none`}
                  />
                </div>
              </div>

              <div className="mt-10 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-3">
                <Link
                  to="/runs"
                  className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold ${c.surfaceLow} ${c.onSurface} hover:bg-[#e1e9ee] transition-colors`}
                >
                  <Layers className="w-4 h-4" />
                  All Runs
                </Link>
                {batchResults && (
                  <>
                    {/* <button
                      type="button"
                      onClick={handleViewVisualization}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-[#d3e4fe] text-[#435368] hover:bg-[#c5d6f0] transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      Visualization
                    </button> */}
                    <button
                      type="button"
                      onClick={handleViewExecutionMesh}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-[#dbdafb] text-[#4c4c67] hover:bg-[#cdccec] transition-colors"
                    >
                      <Network className="w-4 h-4" />
                      View Runs
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleRunBatch}
                  disabled={!selectedTemplate || batchSize === 0 || isRunning}
                  className="inline-flex items-center justify-center gap-3 px-10 py-4 rounded-xl font-bold text-base text-white shadow-xl shadow-[#6d3bd7]/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 bg-gradient-to-br from-[#6d3bd7] to-[#612aca]"
                >
                  {isRunning ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Running {currentRunIndex + 1} of {batchSize}…
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" strokeWidth={2.5} />
                      Trigger Batch
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Sidebar: preview + health */}
            {/* <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
              <div className={`${c.surfaceLow} rounded-[1.5rem] p-6 flex-1 border ${c.outlineVariant}`}>
                <h3 className="font-headline text-lg font-bold mb-4 flex items-center gap-2">
                  <Eye className={`w-5 h-5 ${c.primary}`} />
                  Preview Order IDs
                </h3>
                <div className="flex flex-wrap gap-2">
                  {previewIds.map((id, idx) => (
                    <span
                      key={id}
                      className={`${c.surfaceContainer} ${c.onSurfaceVariant} text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${
                        idx >= 8 ? 'opacity-60' : ''
                      } ${idx >= 9 ? 'opacity-40' : ''}`}
                    >
                      {id}
                    </span>
                  ))}
                </div>
                {moreCount > 0 && (
                  <p className={`mt-6 text-xs ${c.onSurfaceVariant} italic leading-relaxed`}>
                    The batch will generate sequential IDs based on your prefix and start index. {moreCount} more{' '}
                    {moreCount === 1 ? 'item' : 'items'} not shown.
                  </p>
                )}
                {moreCount === 0 && batchSize <= 10 && (
                  <p className={`mt-6 text-xs ${c.onSurfaceVariant} italic leading-relaxed`}>
                    All {batchSize} order IDs are listed above.
                  </p>
                )}
              </div>

              <div
                className={`${c.surfaceLowest} rounded-[1.5rem] p-6 border ${c.outlineVariant} shadow-sm`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-xs font-bold ${c.onSurfaceVariant} uppercase tracking-widest`}>
                    Environment Health
                  </span>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      errorCount > 0 && !isRunning ? 'bg-amber-500' : 'bg-emerald-500'
                    } shadow-sm shadow-emerald-500/50`}
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <span className={`text-sm font-medium ${c.onSurfaceVariant}`}>Batch readiness</span>
                    <span className={`text-2xl font-black ${c.onSurface}`}>{healthPct}%</span>
                  </div>
                  <div className={`w-full ${c.surfaceContainer} h-1.5 rounded-full overflow-hidden`}>
                    <div
                      className="bg-[#6d3bd7] h-full rounded-full transition-all duration-500"
                      style={{ width: `${healthPct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#566166]/70">
                    {isRunning
                      ? 'Batch in progress…'
                      : batchResults
                        ? `${successCount} succeeded, ${errorCount} failed, ${pendingCount} in flight or pending.`
                        : 'Configure a template and trigger a batch to update live metrics.'}
                  </p>
                </div>
              </div>
            </div> */}

            {/* Recent run history */}
            {/* <div className="col-span-12 mt-2">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline text-xl font-bold">Recent Run History</h3>
                <Link
                  to="/runs"
                  className={`text-sm font-semibold ${c.primary} flex items-center gap-1 hover:underline`}
                >
                  View full archive
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {lastBatchMeta ? (
                  <div
                    className={`${c.surfaceLow} p-5 rounded-2xl flex flex-col gap-4 border ${c.outlineVariant} hover:bg-white transition-all duration-300`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-bold truncate">{lastBatchMeta.name}</h4>
                        <p className="text-xs text-[#566166]">
                          {new Date(lastBatchMeta.at).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-sm ${
                          lastBatchMeta.failed === 0 ? `${c.primaryBg} ${c.primaryOnContainer}` : 'bg-[#d9e4ea] text-[#566166]'
                        }`}
                      >
                        {lastBatchMeta.failed === 0 ? 'COMPLETED' : 'WITH ERRORS'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-medium text-[#566166]">
                      <div className="flex items-center gap-1">
                        <List className="w-3.5 h-3.5" />
                        {lastBatchMeta.total} Runs
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        {lastBatchMeta.success} ok
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`${c.surfaceLow} p-5 rounded-2xl flex flex-col gap-3 border border-dashed ${c.outlineVariant}`}
                  >
                    <p className={`text-sm ${c.onSurfaceVariant}`}>
                      No batch finished in this session yet. Trigger a batch to see a summary card here.
                    </p>
                  </div>
                )}
                <div
                  className={`${c.surfaceLow} p-5 rounded-2xl flex flex-col gap-4 hover:bg-white transition-all duration-300 border ${c.outlineVariant} opacity-90`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold">Observe tab</h4>
                      <p className="text-xs text-[#566166]">All historical runs</p>
                    </div>
                    <span className={`${c.primaryBg} ${c.primaryOnContainer} text-[10px] font-bold px-2 py-0.5 rounded-sm`}>
                      LIVE
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium text-[#566166]">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Real-time list
                    </div>
                    <Link to="/runs" className={`${c.primary} font-semibold hover:underline`}>
                      Open →
                    </Link>
                  </div>
                </div>
                <div
                  className={`${c.surfaceLow} p-5 rounded-2xl flex flex-col gap-4 hover:bg-white transition-all duration-300 border ${c.outlineVariant} opacity-90`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold">Execution Mesh</h4>
                      <p className="text-xs text-[#566166]">Visualize active batches</p>
                    </div>
                  </div>
                  <p className="text-xs text-[#566166]">
                    After a batch starts, use Execution Mesh from the actions row to watch orchestration.
                  </p>
                </div>
              </div>
            </div> */}
          </div>

          {/* Results (current batch) */}
          {batchResults && (
            <div
              className={`mt-10 ${c.surfaceLowest} rounded-[1.5rem] p-6 sm:p-8 shadow-sm border ${c.outlineVariant}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#566166]" />
                  <h2 className="font-headline text-lg font-bold">Current Batch Results</h2>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  {pendingCount > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-sm text-[#566166]">{pendingCount} Pending</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-sm text-[#566166]">{successCount} Success</span>
                  </div>
                  {errorCount > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-rose-500" />
                      <span className="text-sm text-[#566166]">{errorCount} Failed</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <div className={`h-2 w-full ${c.surfaceContainer} rounded-full overflow-hidden`}>
                  <div
                    className="h-full bg-[#6d3bd7] rounded-full transition-all duration-300"
                    style={{ width: `${((batchResults.length - pendingCount) / batchSize) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-[#566166] mt-2">
                  {batchResults.length - pendingCount} of {batchSize} completed
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
                {batchResults.map((result) => (
                  <div
                    key={result.order_id}
                    className={`p-3 rounded-xl border ${
                      result.status === 'success'
                        ? 'bg-emerald-50/80 border-emerald-200/80'
                        : result.status === 'error'
                          ? 'bg-rose-50/80 border-rose-200/80'
                          : 'bg-blue-50/80 border-blue-200/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {result.status === 'success' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : result.status === 'error' ? (
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
                        )}
                        <span className="text-sm font-mono font-medium text-[#2a3439] truncate">
                          {result.order_id}
                        </span>
                      </div>
                    </div>
                    {result.status === 'success' && result.run_id && (
                      <Link
                        to={`/runs/${result.run_id}`}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-[#6d3bd7] font-semibold hover:underline"
                      >
                        View Run
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                    {result.status === 'error' && result.error && (
                      <p className="mt-2 text-xs text-rose-600 line-clamp-2">{result.error}</p>
                    )}
                    {result.status === 'pending' && (
                      <p className="mt-2 text-xs text-blue-600">Processing…</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
