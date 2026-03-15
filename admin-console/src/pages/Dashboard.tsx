import { useNavigate } from 'react-router-dom'
import { Play, Pause, CheckCircle, AlertCircle } from 'lucide-react'
import { useMetrics } from '../hooks/useEvents'
import { useAgents } from '../hooks/useAgents'
import { useAgentStore } from '../store/agentStore'

const StatCard = ({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: React.ElementType
  color: string
}) => (
  <div className="bg-white rounded-lg border border-gray-200 p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </div>
)

export const Dashboard = () => {
  const navigate = useNavigate()
  const { data: metrics } = useMetrics()
  useAgents({ limit: 10 }) // Load recent agents
  const agents = useAgentStore((state) => Object.values(state.agents).slice(0, 10))

  const running = metrics?.agents.running || 0
  const paused = metrics?.agents.paused || 0
  const completed = metrics?.agents.completed_last_hour || 0
  const failed = metrics?.agents.failed_last_hour || 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Running"
          value={running}
          icon={Play}
          color="bg-blue-100 text-blue-600"
        />
        <StatCard
          label="Paused"
          value={paused}
          icon={Pause}
          color="bg-yellow-100 text-yellow-600"
        />
        <StatCard
          label="Completed (1h)"
          value={completed}
          icon={CheckCircle}
          color="bg-green-100 text-green-600"
        />
        <StatCard
          label="Failed (1h)"
          value={failed}
          icon={AlertCircle}
          color="bg-red-100 text-red-600"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold">Recent Agents</h3>
          </div>
          <div className="p-4">
            {agents.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No agents yet</p>
            ) : (
              <div className="space-y-2">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    onClick={() => navigate(`/agents/${agent.id}`)}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-md cursor-pointer"
                  >
                    <div>
                      <p className="font-medium text-sm">{agent.template_name}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(agent.started_at).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        agent.status === 'running'
                          ? 'bg-blue-100 text-blue-700'
                          : agent.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : agent.status === 'paused'
                          ? 'bg-yellow-100 text-yellow-700'
                          : agent.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold">Quick Actions</h3>
          </div>
          <div className="p-4 space-y-2">
            <button
              onClick={() => navigate('/templates/new')}
              className="w-full text-left p-3 hover:bg-gray-50 rounded-md border border-dashed border-gray-300"
            >
              <p className="font-medium text-blue-600">Create Template</p>
              <p className="text-sm text-gray-500">Define a new workflow</p>
            </button>
            <button
              onClick={() => navigate('/agents')}
              className="w-full text-left p-3 hover:bg-gray-50 rounded-md border border-dashed border-gray-300"
            >
              <p className="font-medium text-blue-600">Run Agent</p>
              <p className="text-sm text-gray-500">Execute a workflow</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
