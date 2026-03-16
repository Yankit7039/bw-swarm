import { useState } from 'react'
import { Search, Filter } from 'lucide-react'
import { useLogs } from '../hooks/useEvents'

const LEVEL_COLORS = {
  info: 'bg-blue-100 text-blue-700',
  warn: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
}

export const Logs = () => {
  const [filters, setFilters] = useState({
    agent_id: '',
    event_type: '',
    level: '',
    from: '',
    to: '',
  })
  const [offset, setOffset] = useState(0)

  const { data, isLoading } = useLogs({
    ...filters,
    agent_id: filters.agent_id || undefined,
    event_type: filters.event_type || undefined,
    level: filters.level || undefined,
    limit: 50,
    offset,
  })

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setOffset(0)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Event Logs</h2>
        <p className="text-gray-500">Query and filter agent events</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="font-medium">Filters</span>
        </div>
        <div className="grid grid-cols-5 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Agent ID</label>
            <input
              type="text"
              value={filters.agent_id}
              onChange={(e) => handleFilterChange('agent_id', e.target.value)}
              placeholder="UUID..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Event Type</label>
            <select
              value={filters.event_type}
              onChange={(e) => handleFilterChange('event_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All types</option>
              <option value="agent.created">agent.created</option>
              <option value="agent.state_changed">agent.state_changed</option>
              <option value="agent.step_started">agent.step_started</option>
              <option value="agent.step_completed">agent.step_completed</option>
              <option value="agent.completed">agent.completed</option>
              <option value="agent.failed">agent.failed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Level</label>
            <select
              value={filters.level}
              onChange={(e) => handleFilterChange('level', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All levels</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="datetime-local"
              value={filters.from}
              onChange={(e) => handleFilterChange('from', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="datetime-local"
              value={filters.to}
              onChange={(e) => handleFilterChange('to', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : data?.data.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p>No events found</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                    Time
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                    Event Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                    Agent ID
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                    Level
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                    Payload
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((event) => (
                  <tr key={event.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {new Date(event.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-blue-600">
                      {event.event_type}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">
                      {event.agent_run_id.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          LEVEL_COLORS[event.level as keyof typeof LEVEL_COLORS] ||
                          'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {event.level}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <pre className="text-xs bg-gray-100 p-2 rounded max-w-xs overflow-x-auto">
                        {JSON.stringify(event.payload, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Showing {data?.data.length || 0} of {data?.pagination.total || 0} events
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset((o) => Math.max(0, o - 50))}
                  disabled={offset === 0}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setOffset((o) => o + 50)}
                  disabled={
                    !data || offset + data.data.length >= data.pagination.total
                  }
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
