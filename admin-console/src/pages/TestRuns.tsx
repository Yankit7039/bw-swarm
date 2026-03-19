import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Play,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Settings,
  Zap,
  BarChart3,
  Layers,
  Eye,
  Network,
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

export const TestRuns = () => {
  const navigate = useNavigate()
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [startOrderId, setStartOrderId] = useState<number>(1)
  const [batchSize, setBatchSize] = useState<number>(10)
  const [orderPrefix, setOrderPrefix] = useState<string>('ORD-')
  const [delaySeconds, setDelaySeconds] = useState<number>(0)
  const [batchResults, setBatchResults] = useState<BatchResult[] | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionName, setSessionName] = useState<string>('')
  const [currentRunIndex, setCurrentRunIndex] = useState<number>(0)

  const { data: templates } = useTemplates(100, 0)

  // Generate order IDs automatically
  const generateOrderIds = (start: number, count: number, prefix: string): string[] => {
    return Array.from({ length: count }, (_, i) => {
      const num = start + i
      return `${prefix}${num.toString().padStart(3, '0')}`
    })
  }

  // Delay helper that returns a Promise
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

    // Initialize all as pending
    orderIds.forEach((orderId) => {
      results.push({
        order_id: orderId,
        status: 'pending' as const,
      })
    })
    setBatchResults([...results])

    // Trigger runs SEQUENTIALLY with delay between each
    for (let i = 0; i < orderIds.length; i++) {
      const orderId = orderIds[i]
      setCurrentRunIndex(i)

      // Add delay before triggering (except for the first run)
      if (i > 0 && delaySeconds > 0) {
        await delay(delaySeconds * 1000)
      }

      const triggeredAt = new Date().toISOString()

      try {
        const result = await runsApi.trigger({
          template_id: selectedTemplate,
          order_id: orderId,
        })

        // Update status to show it's triggered
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

    // Poll for all run completions
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

    // Safety timeout after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval)
      setIsRunning(false)
      setCurrentRunIndex(0)
    }, 5 * 60 * 1000)
  }

  const handleViewVisualization = () => {
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
    navigate(`/bulk-visualization?${params.toString()}`)
  }

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

  return (
    <Layout>
      <div className="w-full px-6 lg:px-10 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-extrabold text-slate-900">Test Runs</h1>
            </div>
            <p className="text-sm text-slate-500">
              Trigger multiple runs sequentially with auto-generated order IDs for load testing
            </p>
          </div>
        </div>

        {/* Configuration Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Settings className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-bold text-slate-900">Batch Configuration</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {/* Template Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Template
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full rounded-lg border-slate-200 bg-slate-50 border px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              >
                <option value="">Select a template</option>
                {templates?.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Batch Size */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Number of Runs
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={batchSize}
                onChange={(e) => setBatchSize(Math.min(500, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full rounded-lg border-slate-200 bg-slate-50 border px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
              <p className="text-xs text-slate-400 mt-1">Max 500 runs per batch</p>
            </div>

            {/* Delay Dropdown */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Delay Between Runs
              </label>
              <select
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(parseInt(e.target.value))}
                className="w-full rounded-lg border-slate-200 bg-slate-50 border px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              >
                {DELAY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">Wait time before triggering each run</p>
            </div>

            {/* Order ID Prefix */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Order ID Prefix
              </label>
              <input
                type="text"
                value={orderPrefix}
                onChange={(e) => setOrderPrefix(e.target.value)}
                placeholder="ORD-"
                className="w-full rounded-lg border-slate-200 bg-slate-50 border px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
            </div>

            {/* Starting Number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Start From
              </label>
              <input
                type="number"
                min={1}
                value={startOrderId}
                onChange={(e) => setStartOrderId(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full rounded-lg border-slate-200 bg-slate-50 border px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
              <p className="text-xs text-slate-400 mt-1">
                e.g., {orderPrefix}{startOrderId.toString().padStart(3, '0')} → {orderPrefix}{(startOrderId + batchSize - 1).toString().padStart(3, '0')}
              </p>
            </div>

            {/* Session Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Session Name (optional)
              </label>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="My bulk run session"
                className="w-full rounded-lg border-slate-200 bg-slate-50 border px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            <p className="text-xs font-medium text-slate-500 mb-2">Preview Order IDs:</p>
            <div className="flex flex-wrap gap-2">
              {generateOrderIds(startOrderId, Math.min(10, batchSize), orderPrefix).map((id) => (
                <span key={id} className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono text-slate-600">
                  {id}
                </span>
              ))}
              {batchSize > 10 && (
                <span className="px-2 py-1 text-xs text-slate-400">
                  +{batchSize - 10} more
                </span>
              )}
            </div>
          </div>

          {/* Run Buttons */}
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={handleRunBatch}
              disabled={!selectedTemplate || isRunning}
              className="flex items-center justify-center gap-2 px-8 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Running {currentRunIndex + 1} of {batchSize}...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  <span>Trigger {batchSize} Test Runs</span>
                </>
              )}
            </button>

            {batchResults && (
              <>
                <button
                  onClick={handleViewVisualization}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-50 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-100 transition-all border border-indigo-200"
                >
                  <Eye className="w-5 h-5" />
                  <span>View Visualization</span>
                </button>
                <button
                  onClick={handleViewExecutionMesh}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-50 text-purple-700 font-semibold rounded-lg hover:bg-purple-100 transition-all border border-purple-200"
                >
                  <Network className="w-5 h-5" />
                  <span>Execution Mesh</span>
                </button>
              </>
            )}

            <Link
              to="/runs"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-50 text-slate-700 font-semibold rounded-lg hover:bg-slate-100 transition-all border border-slate-200"
            >
              <Layers className="w-5 h-5" />
              <span>All Runs</span>
            </Link>
          </div>
        </div>

        {/* Results Section */}
        {batchResults && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-slate-400" />
                <h2 className="text-lg font-bold text-slate-900">Results</h2>
              </div>
              <div className="flex items-center gap-4">
                {pendingCount > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                    <span className="text-sm text-slate-600">{pendingCount} Pending</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-sm text-slate-600">{successCount} Success</span>
                </div>
                {errorCount > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                    <span className="text-sm text-slate-600">{errorCount} Failed</span>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${((batchResults.length - pendingCount) / batchSize) * 100}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {batchResults.length - pendingCount} of {batchSize} completed
              </p>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
              {batchResults.map((result) => (
                <div
                  key={result.order_id}
                  className={`p-3 rounded-lg border ${
                    result.status === 'success'
                      ? 'bg-emerald-50 border-emerald-200'
                      : result.status === 'error'
                      ? 'bg-rose-50 border-rose-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {result.status === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      ) : result.status === 'error' ? (
                        <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin flex-shrink-0" />
                      )}
                      <span className="text-sm font-mono font-medium text-slate-700">
                        {result.order_id}
                      </span>
                    </div>
                  </div>
                  {result.status === 'success' && result.run_id && (
                    <Link
                      to={`/runs/${result.run_id}`}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View Run
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                  {result.status === 'error' && result.error && (
                    <p className="mt-2 text-xs text-rose-600 line-clamp-2">
                      {result.error}
                    </p>
                  )}
                  {result.status === 'pending' && (
                    <p className="mt-2 text-xs text-blue-600">Processing...</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
