import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Plus, Search } from 'lucide-react'
import { useAgents, useCreateAgent } from '../hooks/useAgents'
import { useTemplates } from '../hooks/useTemplates'
import { useAgentStore } from '../store/agentStore'
import type { AgentSummary } from '../types/agent'

const StatusBadge = ({ status }: { status: string }) => {
  const colors = {
    created: 'bg-gray-100 text-gray-700',
    running: 'bg-blue-100 text-blue-700',
    paused: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-600',
  }

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${
        colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700'
      } ${status === 'running' ? 'animate-pulse' : ''}`}
    >
      {status}
    </span>
  )
}

const RunModal = ({
  isOpen,
  onClose,
  onRun,
  isRunning,
}: {
  isOpen: boolean
  onClose: () => void
  onRun: (templateId: string) => void
  isRunning: boolean
}) => {
  const { data: templates } = useTemplates()
  const [selected, setSelected] = useState('')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h3 className="text-lg font-semibold mb-4">Run Template</h3>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
        >
          <option value="">Select a template...</option>
          {templates?.data.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selected) {
                onRun(selected)
                onClose()
              }
            }}
            disabled={!selected || isRunning}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isRunning ? 'Starting...' : 'Run'}
          </button>
        </div>
      </div>
    </div>
  )
}

export const AgentMonitor = () => {
  const navigate = useNavigate()
  const [showRunModal, setShowRunModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  useAgents({ limit: 50, status: statusFilter || undefined })
  const agents = useAgentStore((state) => Object.values(state.agents))
  const createAgent = useCreateAgent()

  const handleRun = async (templateId: string) => {
    await createAgent.mutateAsync({
      template_id: templateId,
      trigger_payload: {},
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Agent Monitor</h2>
          <p className="text-gray-500">Track and manage agent runs</p>
        </div>
        <button
          onClick={() => setShowRunModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Play className="w-4 h-4" />
          Run Template
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200">
          <Search className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border-none outline-none text-sm bg-transparent"
          >
            <option value="">All Statuses</option>
            <option value="running">Running</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                Template
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                Status
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                Current Step
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                Started
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                Duration
              </th>
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No agents yet. Click &quot;Run Template&quot; to start one.
                </td>
              </tr>
            ) : (
              agents.map((agent) => (
                <tr
                  key={agent.id}
                  onClick={() => navigate(`/agents/${agent.id}`)}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{agent.template_name}</p>
                    <p className="text-xs text-gray-500">{agent.id.slice(0, 8)}...</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={agent.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {agent.current_step || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(agent.started_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {agent.duration_ms ? `${(agent.duration_ms / 1000).toFixed(1)}s` : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <RunModal
        isOpen={showRunModal}
        onClose={() => setShowRunModal(false)}
        onRun={handleRun}
        isRunning={createAgent.isPending}
      />
    </div>
  )
}
