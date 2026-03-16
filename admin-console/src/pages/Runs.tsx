import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  Play,
  Filter,
  ChevronDown,
  Calendar,
  ArrowRight,
  RotateCcw,
  Lock,
  Check,
  X,
  Network,
} from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { runsApi } from '../api/runs'
import { useTemplates } from '../hooks/useTemplates'
import type { Run } from '../types/common'

interface RunWithProgress extends Run {
  progress?: number
  totalSteps?: number
  completedSteps?: number
}

const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
    running: {
      color: 'text-blue-500',
      bg: 'bg-blue-50',
      icon: <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />,
      label: 'Running',
    },
    completed: {
      color: 'text-emerald-500',
      bg: 'bg-emerald-50',
      icon: <Check className="w-4 h-4" />,
      label: 'Completed',
    },
    failed: {
      color: 'text-rose-500',
      bg: 'bg-rose-50',
      icon: <X className="w-4 h-4" />,
      label: 'Failed',
    },
    pending: {
      color: 'text-slate-500',
      bg: 'bg-slate-100',
      icon: <div className="w-4 h-4 rounded-full border-2 border-slate-400" />,
      label: 'Queued',
    },
  }

  const c = config[status] || config.pending

  return (
    <div className="flex items-center gap-3">
      <div className={`size-12 flex items-center justify-center rounded-xl ${c.bg} ${c.color}`}>
        {status === 'running' ? (
          <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <div className="w-6 h-6">{c.icon}</div>
        )}
      </div>
      <div>
        <h3 className="font-bold text-slate-900">Run</h3>
        <p className={`text-xs font-bold ${c.color} uppercase`}>{c.label}</p>
      </div>
    </div>
  )
}

const StepVisualizer = ({ status, progress = 0 }: { status: string; progress?: number }) => {
  const totalSteps = 4
  const completedSteps = status === 'completed' ? totalSteps : status === 'failed' ? Math.floor(totalSteps * progress) : Math.floor(totalSteps * progress)

  const getLineColor = () => {
    if (status === 'completed') return 'bg-emerald-500'
    if (status === 'failed') return 'bg-rose-500'
    if (status === 'running') return 'bg-primary'
    return 'bg-slate-200'
  }

  const lineWidth = status === 'pending' ? '0%' : status === 'completed' ? '100%' : `${(completedSteps / (totalSteps - 1)) * 100}%`

  return (
    <div className="flex-1 flex items-center justify-center w-full max-w-md">
      <div className="relative flex items-center w-full">
        <div className="absolute h-0.5 bg-slate-200 w-full top-1/2 -translate-y-1/2 z-0" />
        <div
          className={`absolute h-0.5 ${getLineColor()} top-1/2 -translate-y-1/2 z-0 transition-all`}
          style={{ width: lineWidth }}
        />
        <div className="relative flex justify-between w-full z-10">
          {Array.from({ length: totalSteps }).map((_, i) => {
            const isCompleted = i < completedSteps
            const isCurrent = i === completedSteps && status === 'running'
            const isFailed = i === completedSteps && status === 'failed'

            return (
              <div
                key={i}
                className={`size-6 rounded-full flex items-center justify-center transition-all ${
                  isFailed
                    ? 'bg-rose-500 text-white border-4 border-white'
                    : isCurrent
                    ? 'bg-primary text-white step-pulse border-4 border-white'
                    : isCompleted
                    ? `${status === 'completed' ? 'bg-emerald-500' : 'bg-primary'} text-white`
                    : 'bg-slate-200 border-4 border-white'
                }`}
              >
                {isCompleted && !isFailed && <Check className="w-3 h-3" />}
                {isFailed && <X className="w-3 h-3" />}
                {isCurrent && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const RunCard = ({ run, templateName }: { run: RunWithProgress; templateName?: string }) => {
  const getBorderColor = () => {
    switch (run.status) {
      case 'running':
        return 'border-l-blue-500'
      case 'completed':
        return 'border-l-emerald-500'
      case 'failed':
        return 'border-l-rose-500'
      default:
        return 'border-l-slate-400'
    }
  }

  const formatDuration = () => {
    if (!run.created_at) return '--'
    const start = new Date(run.created_at)
    const end = run.completed_at ? new Date(run.completed_at) : new Date()
    const diffMs = end.getTime() - start.getTime()
    const minutes = Math.floor(diffMs / 60000)
    const seconds = Math.floor((diffMs % 60000) / 1000)
    return `${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
  }

  const formatTime = () => {
    if (!run.created_at) return '-'
    const date = new Date(run.created_at)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const isPending = run.status === 'pending'

  return (
    <div
      className={`group relative bg-white border-l-4 ${getBorderColor()} border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row items-center gap-6 hover:shadow-lg transition-all`}
    >
      <div className="min-w-[200px]">
        <StatusBadge status={run.status} />
        <p className="text-sm text-slate-500 mt-1">{templateName || run.template_id}</p>
      </div>

      <StepVisualizer status={run.status} progress={run.status === 'running' ? 0.66 : run.status === 'completed' ? 1 : 0.33} />

      <div className="flex items-center justify-between md:justify-end gap-8 min-w-[240px] w-full md:w-auto">
        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">{formatDuration()}</p>
          <p className="text-xs text-slate-500">{isPending ? 'Waiting in queue' : `Today at ${formatTime()}`}</p>
        </div>
        {isPending ? (
          <button className="flex items-center gap-1 text-sm font-bold text-slate-400 cursor-not-allowed">
            View Details
            <Lock className="w-4 h-4" />
          </button>
        ) : (
          <Link
            to={`/runs/${run.run_id}`}
            className="flex items-center gap-1 text-sm font-bold text-primary hover:underline"
          >
            {run.status === 'failed' ? (
              <>
                Retry Run
                <RotateCcw className="w-4 h-4" />
              </>
            ) : (
              <>
                View Details
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Link>
        )}
      </div>
    </div>
  )
}

export const Runs = () => {
  const navigate = useNavigate()
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [orderId, setOrderId] = useState<string>('ORD-001')
  const [statusFilter] = useState<string>('all')

  const { data: templates } = useTemplates(100, 0)

  const { data: runs, isFetching } = useQuery({
    queryKey: ['runs', selectedTemplate, statusFilter],
    queryFn: () =>
      runsApi.list({
        template_id: selectedTemplate || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 50,
        offset: 0,
      }),
    refetchInterval: 3000,
  })

  const triggerMutation = useMutation({
    mutationFn: () => {
      if (!selectedTemplate || !orderId.trim()) throw new Error('Missing required fields')
      return runsApi.trigger({ template_id: selectedTemplate, order_id: orderId.trim() })
    },
    onSuccess: (data) => {
      navigate(`/runs/${data.run_id}`)
    },
  })

  const items: RunWithProgress[] = runs?.data ?? []

  const getTemplateName = (templateId: string) => {
    return templates?.data?.find((t) => t.id === templateId)?.name
  }

  return (
    <Layout>
      <div className="w-full px-6 lg:px-10 py-8">
        {/* Control Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Execution Runs</h1>
            <p className="text-sm text-slate-500">Monitor and manage your active swarm processes</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium shadow-sm hover:border-primary/30 transition-colors">
              <Filter className="w-4 h-4" />
              All Statuses
              <ChevronDown className="w-4 h-4" />
            </button>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium shadow-sm hover:border-primary/30 transition-colors outline-none"
            >
              <option value="">All Templates</option>
              {templates?.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium shadow-sm hover:border-primary/30 transition-colors">
              <Calendar className="w-4 h-4" />
              Today
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Trigger Run Form */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-8 shadow-sm">
          <div className="flex flex-col md:flex-row items-end gap-4">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Template</label>
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
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Order ID / Input</label>
              <input
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="OH-1 or custom input"
                className="w-full rounded-lg border-slate-200 bg-slate-50 border px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
            </div>
            <button
              onClick={() => triggerMutation.mutate()}
              disabled={!selectedTemplate || !orderId.trim() || triggerMutation.isPending}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {triggerMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Triggering...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Trigger Run</span>
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Supports manual order IDs like OH-1; the numeric part maps deterministically to scenarios via n % 5.
          </p>
        </div>

        {/* Execution List */}
        <div className="space-y-4">
          {isFetching && items.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p>Loading runs...</p>
            </div>
          )}

          {items.map((run) => (
            <RunCard key={run.run_id} run={run} templateName={getTemplateName(run.template_id)} />
          ))}

          {items.length === 0 && !isFetching && (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <p className="text-slate-500">No runs yet. Trigger your first run to get started.</p>
            </div>
          )}
        </div>

        {/* Pagination/Footer */}
        <div className="mt-10 flex items-center justify-between border-t border-slate-200 pt-6">
          <p className="text-sm text-slate-500">Showing 1-{items.length} of {items.length} runs</p>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              Previous
            </button>
            <button className="px-4 py-2 text-sm font-bold rounded-lg bg-primary text-white shadow-lg shadow-primary/20 hover:brightness-110 transition-all">
              Next
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-auto py-6 border-t border-slate-200 bg-white -mx-6 lg:-mx-10 px-6 lg:px-10 mt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-primary" />
              <p className="text-slate-500 text-xs font-medium">© 2026 Swarm Admin Console. Enterprise Edition.</p>
            </div>
            <div className="flex gap-6">
              <a className="text-slate-400 hover:text-primary text-xs font-bold transition-colors" href="#">Privacy Policy</a>
              <a className="text-slate-400 hover:text-primary text-xs font-bold transition-colors" href="#">Documentation</a>
              <a className="text-slate-400 hover:text-primary text-xs font-bold transition-colors" href="#">API Keys</a>
            </div>
          </div>
        </footer>
      </div>
    </Layout>
  )
}
