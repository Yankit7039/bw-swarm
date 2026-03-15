import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Play, Pause, X, ChevronDown, ChevronRight } from 'lucide-react'
import { useAgent, usePauseAgent, useResumeAgent, useCancelAgent } from '../hooks/useAgents'
import { useAgentStore } from '../store/agentStore'

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
      className={`px-3 py-1 rounded-full text-sm font-medium ${
        colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700'
      } ${status === 'running' ? 'animate-pulse' : ''}`}
    >
      {status}
    </span>
  )
}

const StepItem = ({
  step,
  isExpanded,
  onToggle,
}: {
  step: {
    step_id: string
    step_name: string
    step_type: string
    status: string
    input?: Record<string, unknown>
    output?: Record<string, unknown>
    duration_ms?: number
  }
  isExpanded: boolean
  onToggle: () => void
}) => {
  const isRunning = step.status === 'running'

  return (
    <div className="border-l-2 border-gray-200 pl-4 py-2">
      <div
        className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
        onClick={onToggle}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
        <span className="text-xs text-gray-500 w-16">{step.step_id}</span>
        <span className="font-medium">{step.step_name}</span>
        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">{step.step_type}</span>
        {isRunning && (
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        )}
        <span
          className={`ml-auto text-xs px-2 py-0.5 rounded ${
            step.status === 'completed'
              ? 'bg-green-100 text-green-700'
              : step.status === 'running'
              ? 'bg-blue-100 text-blue-700'
              : step.status === 'failed'
              ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {step.status}
        </span>
        {step.duration_ms && (
          <span className="text-xs text-gray-500">
            {(step.duration_ms / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="mt-2 ml-8 space-y-2">
          {step.input && Object.keys(step.input).length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Input:</p>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(step.input, null, 2)}
              </pre>
            </div>
          )}
          {step.output && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Output:</p>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(step.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const EventFeed = ({ agentId }: { agentId: string }) => {
  return (
    <div className="bg-gray-900 rounded-lg p-4 h-64 overflow-y-auto">
      <p className="text-gray-400 text-xs mb-2">Live Events (SSE)</p>
      <div className="space-y-1 text-xs font-mono">
        <p className="text-green-400">→ Listening for events...</p>
        <p className="text-gray-500">Agent ID: {agentId.slice(0, 8)}...</p>
      </div>
    </div>
  )
}

export const AgentDetail = () => {
  const { id } = useParams<{ id: string }>()
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())

  const { data: agentData, isLoading } = useAgent(id!)
  const liveAgent = useAgentStore((state) => state.agents[id!])
  const liveSteps = liveAgent?.steps || {}

  const pauseMutation = usePauseAgent()
  const resumeMutation = useResumeAgent()
  const cancelMutation = useCancelAgent()

  const agent = agentData

  if (isLoading || !agent) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  const status = liveAgent?.status || agent.status
  const canPause = status === 'running'
  const canResume = status === 'paused'
  const canCancel = status === 'running' || status === 'paused'

  // Merge steps from initial API load with live updates from SSE
  // Include any new steps that were created after the initial load
  const allStepIds = new Set([
    ...agent.steps.map(s => s.step_id),
    ...Object.keys(liveSteps)
  ])
  
  const steps = Array.from(allStepIds).map(stepId => {
    const initialStep = agent.steps.find(s => s.step_id === stepId)
    const liveStep = liveSteps[stepId]
    return {
      step_id: stepId,
      step_name: liveStep?.step_name || initialStep?.step_name || stepId,
      step_type: initialStep?.step_type || liveStep?.step_type || 'subagent',
      status: liveStep?.status || initialStep?.status || 'pending',
      input: liveStep?.input || initialStep?.input,
      output: liveStep?.output || initialStep?.output,
      started_at: liveStep?.started_at || initialStep?.started_at,
      completed_at: liveStep?.completed_at || initialStep?.completed_at,
      duration_ms: liveStep?.duration_ms || initialStep?.duration_ms,
      id: liveStep?.id || initialStep?.id,
    }
  }).sort((a, b) => {
    // Sort by step_id which should be step_1, step_2, etc.
    const aNum = parseInt(a.step_id.replace('step_', '')) || 0
    const bNum = parseInt(b.step_id.replace('step_', '')) || 0
    return aNum - bNum
  })

  const toggleStep = (stepId: string) => {
    const newSet = new Set(expandedSteps)
    if (newSet.has(stepId)) {
      newSet.delete(stepId)
    } else {
      newSet.add(stepId)
    }
    setExpandedSteps(newSet)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-semibold">Agent Run</h2>
            <StatusBadge status={status} />
          </div>
          <p className="text-gray-500">{agent.template_name}</p>
          <p className="text-sm text-gray-400 mt-1">ID: {agent.id}</p>
        </div>

        <div className="flex gap-2">
          {canPause && (
            <button
              onClick={() => pauseMutation.mutate(id!)}
              disabled={pauseMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          )}
          {canResume && (
            <button
              onClick={() => resumeMutation.mutate(id!)}
              disabled={resumeMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Resume
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => cancelMutation.mutate(id!)}
              disabled={cancelMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-gray-500">Triggered By</p>
          <p className="font-medium">{agent.triggered_by}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-gray-500">Started At</p>
          <p className="font-medium">{new Date(agent.started_at).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold mb-4">Step Timeline</h3>
          <div className="space-y-1">
            {steps.length === 0 ? (
              <p className="text-gray-500">No steps yet...</p>
            ) : (
              steps.map((step) => (
                <StepItem
                  key={step.step_id}
                  step={step}
                  isExpanded={expandedSteps.has(step.step_id)}
                  onToggle={() => toggleStep(step.step_id)}
                />
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <EventFeed agentId={id!} />

          {agent.trigger_payload && Object.keys(agent.trigger_payload).length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-medium mb-2">Trigger Payload</h4>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(agent.trigger_payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
