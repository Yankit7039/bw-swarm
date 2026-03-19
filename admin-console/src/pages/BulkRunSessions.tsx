import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Layers,
  ArrowRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  BarChart3,
  Search,
  Filter,
} from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { bulkRunSessionsApi } from '../api/bulkRunSessions'
import { useTemplates } from '../hooks/useTemplates'
import type { BulkRunSession } from '../types/bulkRunSession'

function SessionCard({ session }: { session: BulkRunSession }) {
  const { data: templates } = useTemplates()
  const templateName = templates?.data?.find((t) => t.id === session.template_id)?.name || session.template_id

  const formatDate = (date?: string) => {
    if (!date) return '-'
    return new Date(date).toLocaleString()
  }

  const formatDuration = () => {
    if (!session.created_at) return '-'
    const start = new Date(session.created_at)
    const end = session.completed_at ? new Date(session.completed_at) : new Date()
    const diff = end.getTime() - start.getTime()
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  const progress = session.stats.total > 0
    ? ((session.stats.success + session.stats.failed) / session.stats.total) * 100
    : 0

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              session.status === 'running'
                ? 'bg-indigo-50 text-indigo-600'
                : session.status === 'completed'
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-rose-50 text-rose-600'
            }`}
          >
            {session.status === 'running' ? (
              <Play className="w-5 h-5" />
            ) : session.status === 'completed' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-slate-900">{session.name || `Session ${session.session_id.slice(0, 8)}`}</h3>
            <p className="text-sm text-slate-500">{templateName}</p>
          </div>
        </div>
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            session.status === 'running'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              : session.status === 'completed'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          {session.status}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="text-center p-2 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500">Total</p>
          <p className="text-lg font-bold text-slate-900">{session.stats.total}</p>
        </div>
        <div className="text-center p-2 bg-emerald-50 rounded-lg">
          <p className="text-xs text-emerald-600">Success</p>
          <p className="text-lg font-bold text-emerald-600">{session.stats.success}</p>
        </div>
        <div className="text-center p-2 bg-rose-50 rounded-lg">
          <p className="text-xs text-rose-600">Failed</p>
          <p className="text-lg font-bold text-rose-600">{session.stats.failed}</p>
        </div>
        <div className="text-center p-2 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500">Pending</p>
          <p className="text-lg font-bold text-slate-900">{session.stats.pending}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {formatDuration()}
          </span>
          <span>Created {formatDate(session.created_at)}</span>
        </div>
        <Link
          to={`/bulk-run-sessions/${session.session_id}`}
          className="flex items-center gap-1 text-primary font-medium hover:underline"
        >
          View Visualization
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}

export function BulkRunSessions() {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['bulk-run-sessions'],
    queryFn: () => bulkRunSessionsApi.list({ limit: 100 }),
  })

  return (
    <Layout>
      <div className="w-full px-6 lg:px-10 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-extrabold text-slate-900">Bulk Run Sessions</h1>
            </div>
            <p className="text-sm text-slate-500">
              View and analyze historical bulk test run sessions with visualization
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/test-runs"
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition shadow-lg shadow-primary/20"
            >
              <Play className="w-5 h-5" />
              New Bulk Run
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search sessions..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition">
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </div>

        {/* Sessions List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-slate-500">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
              <span className="text-lg">Loading sessions...</span>
            </div>
          </div>
        ) : sessions?.data?.length === 0 ? (
          <div className="text-center py-20">
            <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No bulk run sessions yet</h3>
            <p className="text-slate-500 mb-6">Create your first bulk run to see visualizations here</p>
            <Link
              to="/test-runs"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition shadow-lg shadow-primary/20"
            >
              <Play className="w-5 h-5" />
              Start New Bulk Run
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sessions?.data?.map((session) => (
              <SessionCard key={session.session_id} session={session} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
