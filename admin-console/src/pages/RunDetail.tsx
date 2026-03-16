import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  PlayCircle,
  CheckCircle,
  XCircle,
  Clock,
  Timer,
  RefreshCw,
  Download,
  Share2,
  Bot,
  Wrench,
  MessageSquare,
  Play,
  ChevronDown,
  ChevronUp,
  Calendar,
  Filter,
  Copy,
  ArrowLeft,
  Hourglass,
  GitBranch,
  Layers,
} from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { runsApi } from '../api/runs'
import { useState, useMemo } from 'react'

interface WorkflowNode {
  id: string
  type: 'start' | 'agent' | 'llm' | 'tool' | 'end' | 'parallel-group'
  label: string
  sublabel?: string
  status: 'completed' | 'running' | 'pending' | 'failed'
  timestamp?: string
  duration?: string
  input?: string
  output?: string
  payload?: Record<string, unknown>
  isExpanded?: boolean
  isParallel?: boolean
  parallelNodes?: WorkflowNode[]
  parentId?: string
}

export const RunDetail = () => {
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  const {
    data: run,
  } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => runsApi.get(runId || ''),
    enabled: !!runId,
    refetchInterval: (query) => {
      const data = query.state.data
      return data && (data.status === 'completed' || data.status === 'failed') ? false : 2000
    },
  })

  const {
    data: events = [],
  } = useQuery({
    queryKey: ['run-events', runId],
    queryFn: () => runsApi.events(runId || ''),
    enabled: !!runId,
    refetchInterval: 1500,
  })

  const reRunMutation = useMutation({
    mutationFn: () => {
      if (!run) throw new Error('No run data')
      return runsApi.trigger({
        template_id: run.template_id,
        order_id: (run.payload?.order_id as string) || 'test-order',
      })
    },
    onSuccess: (data) => {
      navigate(`/runs/${data.run_id}`)
    },
  })

  // Transform events into workflow nodes with parallel detection
  const workflowNodes: WorkflowNode[] = useMemo(() => {
    if (!events.length) return []

    const nodes: WorkflowNode[] = []
    const toolEvents: Record<string, any[]> = {}

    // Group events by agent/tool name to detect parallel execution
    events.forEach((event) => {
      if (event.event_type === 'tool_started' || event.event_type === 'tool_completed') {
        const name = event.event || event.payload?.tool || 'tool'
        if (!toolEvents[name]) toolEvents[name] = []
        toolEvents[name].push(event)
      }
    })

    // Detect parallel tools (same timestamp or overlapping)
    const parallelTools: string[] = []
    const toolNames = Object.keys(toolEvents)
    if (toolNames.length > 1) {
      // Tools with same parent agent are parallel
      const parentAgent = events.find(e => e.event_type === 'agent_started')?.event
      if (parentAgent) {
        parallelTools.push(...toolNames.slice(0, 2)) // First 2 tools are parallel
      }
    }

    // Add start node
    const startEvent = events.find(e => e.event_type === 'workflow_started')
    if (startEvent) {
      nodes.push({
        id: 'start',
        type: 'start',
        label: 'Start',
        status: 'completed',
        timestamp: startEvent.created_at,
      })
    }

    // Process agent events
    const agentStartedEvents = events.filter(e => e.event_type === 'agent_started')
    const agentCompletedEvents = events.filter(e => e.event_type === 'agent_completed')
    
    agentStartedEvents.forEach((agentEvent, idx) => {
      const agentName = agentEvent.event || agentEvent.payload?.agent || `Agent ${idx + 1}`
      const completedEvent = agentCompletedEvents.find(e => 
        (e.event === agentName) || 
        (e.payload?.agent === agentEvent.payload?.agent)
      )

      // Find tools that belong to this agent
      const agentTools = events.filter(e => 
        (e.event_type === 'tool_started' || e.event_type === 'tool_completed') &&
        e.payload?.parent_agent === agentEvent.payload?.agent
      )

      // Check if this agent has parallel tools
      const hasParallelTools = agentTools.length >= 2

      if (hasParallelTools) {
        // Add agent as parallel group
        nodes.push({
          id: `agent-${agentEvent.id}`,
          type: 'parallel-group',
          label: agentName,
          sublabel: 'Agent (Parallel Execution)',
          status: completedEvent ? 'completed' : 'running',
          timestamp: agentEvent.created_at,
          isParallel: true,
          parallelNodes: agentTools
            .filter(e => e.event_type === 'tool_started' || e.event_type === 'tool_completed')
            .slice(0, 2)
            .map((toolEvent, i) => ({
              id: `tool-${toolEvent.id}-${i}`,
              type: 'tool',
              label: toolEvent.event || toolEvent.payload?.tool || 'Tool',
              sublabel: 'Tool Node',
              status: toolEvent.event_type === 'tool_completed' ? 'completed' : 'running',
              timestamp: toolEvent.created_at,
              payload: toolEvent.payload,
              parentId: `agent-${agentEvent.id}`,
            })),
        })
      } else {
        // Add agent as regular node
        nodes.push({
          id: `agent-${agentEvent.id}`,
          type: 'agent',
          label: agentName,
          sublabel: 'Agent Node',
          status: completedEvent ? 'completed' : 'running',
          timestamp: agentEvent.created_at,
          payload: agentEvent.payload,
        })
      }
    })

    // Add standalone tools (not part of parallel groups)
    const standaloneTools = events.filter(e => 
      (e.event_type === 'tool_started' || e.event_type === 'tool_completed') &&
      !parallelTools.some(pt => e.event?.includes(pt) || e.payload?.tool?.includes(pt))
    )

    standaloneTools.forEach((toolEvent) => {
      if (toolEvent.event_type === 'tool_started') {
        const completedEvent = events.find(e => 
          e.event_type === 'tool_completed' && 
          (e.event === toolEvent.event || e.payload?.tool === toolEvent.payload?.tool)
        )
        
        nodes.push({
          id: `tool-${toolEvent.id}`,
          type: 'tool',
          label: toolEvent.event || toolEvent.payload?.tool || 'Tool',
          sublabel: 'Tool Node',
          status: completedEvent ? 'completed' : 'running',
          timestamp: toolEvent.created_at,
          payload: toolEvent.payload,
        })
      }
    })

    // Add end node if workflow completed
    const workflowCompleted = events.find(e => e.event_type === 'workflow_completed')
    if (workflowCompleted || nodes.length > 0) {
      nodes.push({
        id: 'end',
        type: 'end',
        label: 'End',
        status: workflowCompleted ? 'completed' : 'pending',
        timestamp: workflowCompleted?.created_at,
      })
    }

    return nodes
  }, [events])

  const toggleNodeExpand = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          border: 'border-emerald-500',
          bg: 'bg-emerald-500',
          text: 'text-emerald-600',
          lightBg: 'bg-emerald-100',
          line: 'bg-emerald-500',
        }
      case 'running':
        return {
          border: 'border-primary',
          bg: 'bg-primary',
          text: 'text-primary',
          lightBg: 'bg-primary/10',
          line: 'bg-primary',
        }
      case 'failed':
        return {
          border: 'border-rose-500',
          bg: 'bg-rose-500',
          text: 'text-rose-600',
          lightBg: 'bg-rose-100',
          line: 'bg-rose-500',
        }
      default:
        return {
          border: 'border-slate-300',
          bg: 'bg-slate-400',
          text: 'text-slate-500',
          lightBg: 'bg-slate-100',
          line: 'bg-slate-300',
        }
    }
  }

  const getNodeIcon = (type: string, status: string) => {
    const colors = getStatusColor(status)
    switch (type) {
      case 'start':
        return (
          <div className={`size-10 ${colors.lightBg} rounded-lg flex items-center justify-center ${colors.text}`}>
            <Play className="w-5 h-5" />
          </div>
        )
      case 'agent':
        return (
          <div className={`size-10 ${colors.lightBg} rounded-lg flex items-center justify-center ${colors.text}`}>
            <Bot className="w-5 h-5" />
          </div>
        )
      case 'parallel-group':
        return (
          <div className={`size-10 ${colors.lightBg} rounded-lg flex items-center justify-center ${colors.text}`}>
            <GitBranch className="w-5 h-5" />
          </div>
        )
      case 'llm':
        return (
          <div className={`size-10 ${colors.lightBg} rounded-lg flex items-center justify-center ${colors.text}`}>
            <MessageSquare className="w-5 h-5" />
          </div>
        )
      case 'tool':
        return (
          <div className={`size-10 ${colors.lightBg} rounded-lg flex items-center justify-center ${colors.text}`}>
            <Wrench className="w-5 h-5" />
          </div>
        )
      case 'end':
        return (
          <div className={`size-10 ${colors.lightBg} rounded-lg flex items-center justify-center ${colors.text}`}>
            <CheckCircle className="w-5 h-5" />
          </div>
        )
      default:
        return null
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-emerald-500" />
      case 'running':
        return (
          <div className="flex gap-1">
            <div className="size-1.5 rounded-full bg-primary animate-bounce" />
            <div className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
            <div className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
          </div>
        )
      case 'failed':
        return <XCircle className="w-6 h-6 text-rose-500" />
      default:
        return <Hourglass className="w-6 h-6 text-slate-300" />
    }
  }

  const formatTime = (timestamp?: string | null) => {
    if (!timestamp) return '-'
    return new Date(timestamp).toLocaleTimeString()
  }

  const calculateDuration = (start?: string | null, end?: string | null) => {
    if (!start) return '-'
    const startTime = new Date(start)
    const endTime = end ? new Date(end) : new Date()
    const diffMs = endTime.getTime() - startTime.getTime()
    const minutes = Math.floor(diffMs / 60000)
    const seconds = Math.floor((diffMs % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  if (!runId) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-sm text-slate-500">No run selected.</div>
        </div>
      </Layout>
    )
  }

  const runStatus = run?.status || 'pending'
  const statusColors = getStatusColor(runStatus)
  const isRunning = runStatus === 'running'

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Summary Bar */}
        <div className="bg-white border-b border-slate-200 px-6 lg:px-10 py-4 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link to="/runs" className="flex items-center gap-1 text-sm text-slate-500 hover:text-primary transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to Runs
              </Link>
            </div>
          </div>
          <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-wrap gap-6 items-center">
              <div className={`flex items-center gap-3 ${statusColors.lightBg} px-4 py-2 rounded-xl border ${isRunning ? 'border-primary/20 running-pulse' : statusColors.border}`}>
                <PlayCircle className={`w-6 h-6 ${statusColors.text}`} />
                <div>
                  <p className={`text-[10px] ${statusColors.text} font-bold uppercase tracking-tight`}>Status</p>
                  <p className={`text-sm font-bold ${statusColors.text}`}>{runStatus.toUpperCase()}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Run ID</p>
                <p className="text-base font-bold text-slate-900">#{run?.run_id?.slice(0, 8).toUpperCase() || 'N/A'}</p>
              </div>
              <div className="h-10 w-px bg-slate-200" />
              <div>
                <p className="text-xs text-slate-500 font-medium">Template</p>
                <p className="text-base font-bold text-slate-900">{run?.template_id || 'Unknown'}</p>
              </div>
              <div className="h-10 w-px bg-slate-200" />
              <div>
                <p className="text-xs text-slate-500 font-medium">Start Time</p>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <p className="text-base font-bold text-slate-900">{formatTime(run?.created_at)}</p>
                </div>
              </div>
              <div className="h-10 w-px bg-slate-200" />
              <div>
                <p className="text-xs text-slate-500 font-medium">Duration</p>
                <div className="flex items-center gap-1.5">
                  <Timer className="w-4 h-4 text-slate-400" />
                  <p className="text-base font-bold text-slate-900">
                    {calculateDuration(run?.created_at, run?.completed_at)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => reRunMutation.mutate()}
                disabled={reRunMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${reRunMutation.isPending ? 'animate-spin' : ''}`} />
                <span>Re-run</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-all">
                <Download className="w-5 h-5" />
                <span>Logs</span>
              </button>
              <button className="flex items-center justify-center size-11 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="flex-1 flex overflow-hidden">
          {/* Workflow Canvas */}
          <div className="flex-1 bg-slate-50 overflow-auto p-6 lg:p-8 relative">
            <div className="max-w-4xl mx-auto space-y-12 relative">
              {workflowNodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Clock className="w-12 h-12 mb-4" />
                  <p className="text-lg font-medium">Waiting for workflow to start...</p>
                  <p className="text-sm">Events will appear here as they occur</p>
                </div>
              ) : (
                workflowNodes.map((node, index) => {
                  const colors = getStatusColor(node.status)
                  const isLast = index === workflowNodes.length - 1
                  const isExpanded = expandedNodes.has(node.id)

                  // Render parallel group differently
                  if (node.type === 'parallel-group' && node.parallelNodes) {
                    return (
                      <div key={node.id} className="relative flex flex-col items-center">
                        {/* Parent Agent Node */}
                        <div
                          className={`w-full max-w-md bg-white ${node.status === 'running' ? 'border-2' : 'border'} ${colors.border} rounded-xl p-5 shadow-sm relative z-10 ${node.status === 'running' ? 'running-pulse' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              {getNodeIcon(node.type, node.status)}
                              <div>
                                <h3 className="font-bold text-sm">{node.label}</h3>
                                <p className="text-[10px] text-slate-400 uppercase font-semibold">{node.sublabel}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Layers className="w-4 h-4 text-slate-400" />
                              {getStatusIcon(node.status)}
                            </div>
                          </div>

                          {/* Expandable Parallel Branches */}
                          <div className="mt-4 pt-4 border-t border-slate-100">
                            <button
                              onClick={() => toggleNodeExpand(node.id)}
                              className="flex items-center justify-between w-full text-xs font-medium text-slate-500 hover:text-primary transition-colors"
                            >
                              <span>Parallel Branches ({node.parallelNodes?.length})</span>
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            
                            {isExpanded && (
                              <div className="mt-3 grid grid-cols-2 gap-3">
                                {node.parallelNodes?.map((parallelNode) => (
                                  <div
                                    key={parallelNode.id}
                                    className={`p-3 rounded-lg border ${parallelNode.status === 'completed' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Wrench className={`w-4 h-4 ${parallelNode.status === 'completed' ? 'text-emerald-500' : 'text-slate-400'}`} />
                                      <span className="text-xs font-medium text-slate-700">{parallelNode.label}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Connector Line */}
                        {!isLast && (
                          <div className="h-12 w-0.5 bg-slate-300" />
                        )}
                      </div>
                    )
                  }

                  // Regular node rendering
                  return (
                    <div key={node.id} className="relative flex flex-col items-center">
                      {/* Node Card */}
                      <div
                        className={`w-full max-w-md bg-white ${node.status === 'running' ? 'border-2' : 'border'} ${colors.border} rounded-xl p-5 shadow-sm relative z-10 ${node.status === 'running' ? 'running-pulse' : ''} ${node.status === 'pending' ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            {getNodeIcon(node.type, node.status)}
                            <div>
                              <h3 className="font-bold text-sm">{node.label}</h3>
                              <p className="text-[10px] text-slate-400 uppercase font-semibold">{node.sublabel || node.type}</p>
                            </div>
                          </div>
                          {getStatusIcon(node.status)}
                        </div>

                        {/* Expandable Content */}
                        {node.payload && node.status !== 'pending' && (
                          <div className="bg-slate-50 rounded-lg p-3 text-xs border border-slate-100">
                            <button
                              onClick={() => toggleNodeExpand(node.id)}
                              className="flex justify-between items-center w-full cursor-pointer group"
                            >
                              <span className="text-slate-500 font-medium">
                                {isExpanded ? 'Hide Details' : 'Show Details'}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-slate-400 group-hover:translate-y-[-2px] transition-transform" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400 group-hover:translate-y-[2px] transition-transform" />
                              )}
                            </button>
                            {isExpanded && node.payload && (
                              <pre className="mt-3 text-[10px] font-mono text-slate-600 leading-tight overflow-auto max-h-40">
                                {JSON.stringify(node.payload, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}

                        {/* Running Progress */}
                        {node.status === 'running' && (
                          <div className="bg-slate-50 rounded-lg p-3 text-xs border border-slate-100 mt-3">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium">Current Status</span>
                              <span className="text-primary font-bold">Processing...</span>
                            </div>
                            <div className="mt-3 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                              <div className="h-full bg-primary w-2/3 rounded-full animate-pulse" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Connector Line */}
                      {!isLast && (
                        <div className={`h-12 w-0.5 ${colors.line} ${node.status === 'pending' ? 'bg-slate-300' : ''}`} />
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Panel: Events & JSON */}
          <div className="w-80 lg:w-96 border-l border-slate-200 bg-white flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-sm">Event Log</h3>
              <div className="flex gap-2">
                <button className="p-1 hover:bg-slate-100 rounded text-slate-500">
                  <Filter className="w-5 h-5" />
                </button>
                <button className="p-1 hover:bg-slate-100 rounded text-slate-500">
                  <Copy className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <div className="p-4 space-y-4">
                {events.length === 0 ? (
                  <div className="text-center text-slate-400 py-8">
                    <Clock className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">No events yet</p>
                  </div>
                ) : (
                  events.map((event, idx) => {
                    let statusColor = 'bg-slate-300'
                    let statusText = 'text-slate-500'
                    let statusLabel = event.event_type

                    if (event.event_type === 'workflow_started' || event.event_type === 'agent_completed' || event.event_type === 'tool_completed' || event.event_type === 'workflow_completed') {
                      statusColor = 'bg-emerald-500'
                      statusText = 'text-emerald-600'
                      statusLabel = 'COMPLETED'
                    } else if (event.event_type === 'agent_started' || event.event_type === 'tool_started' || event.event_type === 'llm_message') {
                      statusColor = 'bg-primary'
                      statusText = 'text-primary'
                      statusLabel = 'RUNNING'
                    }

                    return (
                      <div key={idx} className="flex gap-3">
                        <div className={`mt-1 size-2 ${statusColor} rounded-full flex-shrink-0 ${statusLabel === 'RUNNING' ? 'animate-pulse' : ''}`} />
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-400">{formatTime(event.created_at)}</span>
                            <span className={`text-xs font-bold ${statusText}`}>{statusLabel}</span>
                          </div>
                          <p className="text-xs text-slate-600">{event.event}</p>
                          {event.payload && (
                            <div className="bg-slate-50 rounded p-2 border border-slate-100 mt-2">
                              <pre className="text-[10px] font-mono text-primary leading-tight overflow-auto max-h-32">
                                {JSON.stringify(event.payload, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
            {/* Footer Log Info */}
            <div className="p-4 bg-slate-50 border-t border-slate-200">
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>{events.length} Events logged</span>
                <div className="flex items-center gap-1">
                  <div className="size-1.5 bg-emerald-500 rounded-full" />
                  <span>Connected</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
