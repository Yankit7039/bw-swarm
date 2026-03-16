import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { runsApi } from '../api/runs'
import { useTemplates } from '../hooks/useTemplates'
import type { Run } from '../types/common'
import { Link } from 'react-router-dom'

export const Runs = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [orderId, setOrderId] = useState<string>('ORD-001')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data: templates } = useTemplates(100, 0)

  const { data: runs, refetch, isFetching } = useQuery({
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

  const handleTrigger = async () => {
    if (!selectedTemplate || !orderId.trim()) return
    await runsApi.trigger({ template_id: selectedTemplate, order_id: orderId.trim() })
    refetch()
  }

  const items: Run[] = runs?.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Runs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Trigger new runs and monitor existing ones. Payload supports manual order IDs like OH-1; the numeric part of the ID maps deterministically to scenarios via n % 5.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white rounded-lg border border-gray-200">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
          <select
            className="w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
          >
            <option value="">Select template</option>
            {templates?.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.id})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Order ID</label>
          <input
            type="text"
            className="w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="OH-1"
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={handleTrigger}
            disabled={!selectedTemplate || !orderId.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 disabled:bg-blue-300 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 w-full"
          >
            Trigger Run
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex gap-3 items-center">
            <span className="text-sm font-medium text-gray-700">Filter by status:</span>
            <select
              className="rounded-md border-gray-300 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          {isFetching && <span className="text-xs text-gray-400">Refreshing…</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Run ID</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Template</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Created</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((run) => (
                <tr key={run.run_id}>
                  <td className="px-4 py-2">
                    <Link
                      to={`/runs/${run.run_id}`}
                      className="text-blue-600 hover:text-blue-800 font-mono"
                    >
                      {run.run_id}
                    </Link>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{run.template_id}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        run.status === 'completed'
                          ? 'bg-green-50 text-green-700'
                          : run.status === 'failed'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-yellow-50 text-yellow-700'
                      }`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {run.created_at ? new Date(run.created_at).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-sm text-gray-500"
                    colSpan={4}
                  >
                    No runs yet. Trigger your first run above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

