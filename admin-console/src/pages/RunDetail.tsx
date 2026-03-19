import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Play,
  Check,
  X,
  Clock,
  Calendar,
  RefreshCw,
  FileText,
  Share2,
  Bot,
  Wrench,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { runsApi } from '../api/runs'
import { useState, useMemo } from 'react'
import type { Run } from '../types/common'

interface WorkflowNode {
  id: string
  type: 'start' | 'agent' | 'llm' | 'tool' | 'end'
  label: string
  sublabel?: string
  status: 'completed' | 'running' | 'pending' | 'failed'
  timestamp?: string
  payload?: Record<string, unknown>
  isExpanded?: boolean
}

interface RunEvent {
  id: string
  event_type: string
  event: string
  created_at: string
  payload?: Record<string, unknown>
}

export const RunDetail = () => {
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  const { data: run } = useQuery<Run>({
    queryKey: ['run', runId],
    queryFn: () => runsApi.get(runId || ''),
    enabled: !!runId,
    refetchInterval: (query) => {
      const data = query.state.data as Run | undefined
      return data && (data.status === 'completed' || data.status === 'failed') ? false : 2000
    },
  })

  const { data: events = [] } = useQuery<RunEvent[]>({
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

  // Transform events into workflow nodes
  const workflowNodes: WorkflowNode[] = useMemo(() => {
    if (!events.length) return []

    const nodes: WorkflowNode[] = []

    // Add start node
    const startEvent = events.find((e) => e.event_type === 'workflow_started')
    if (startEvent) {
      nodes.push({
        id: 'start',
        type: 'start',
        label: 'Start',
        sublabel: 'START',
        status: 'completed',
        timestamp: startEvent.created_at,
      })
    }

    // Process agent events
    const agentStartedEvents = events.filter((e) => e.event_type === 'agent_started')
    const agentCompletedEvents = events.filter((e) => e.event_type === 'agent_completed')

    agentStartedEvents.forEach((agentEvent) => {
      const agentName = String(agentEvent.event || agentEvent.payload?.agent || 'Agent')
      const completedEvent = agentCompletedEvents.find(
        (e) => e.event === agentName || e.payload?.agent === agentEvent.payload?.agent
      )

      nodes.push({
        id: `agent-${agentEvent.id}`,
        type: 'agent',
        label: agentName,
        sublabel: 'AGENT NODE',
        status: completedEvent ? 'completed' : 'running',
        timestamp: agentEvent.created_at,
        payload: agentEvent.payload,
      })

      // Find tools that belong to this agent
      const agentTools = events.filter(
        (e) =>
          (e.event_type === 'tool_started' || e.event_type === 'tool_completed') &&
          e.payload?.parent_agent === agentEvent.payload?.agent
      )

      agentTools.forEach((toolEvent) => {
        if (toolEvent.event_type === 'tool_started') {
          const toolCompleted = events.find(
            (e) =>
              e.event_type === 'tool_completed' &&
              (e.event === toolEvent.event || e.payload?.tool === toolEvent.payload?.tool)
          )

          nodes.push({
            id: `tool-${toolEvent.id}`,
            type: 'tool',
            label: String(toolEvent.event || toolEvent.payload?.tool || 'Tool'),
            sublabel: 'TOOL CALL',
            status: toolCompleted ? 'completed' : 'running',
            timestamp: toolEvent.created_at,
            payload: toolEvent.payload,
          })
        }
      })
    })

    // Add standalone LLM messages
    const llmEvents = events.filter((e) => e.event_type === 'llm_message')
    llmEvents.forEach((llmEvent) => {
      nodes.push({
        id: `llm-${llmEvent.id}`,
        type: 'llm',
        label: 'LLM Response',
        sublabel: 'AI MODEL',
        status: 'completed',
        timestamp: llmEvent.created_at,
        payload: llmEvent.payload,
      })
    })

    // Add end node
    const workflowCompleted = events.find((e) => e.event_type === 'workflow_completed')
    if (workflowCompleted || nodes.length > 0) {
      nodes.push({
        id: 'end',
        type: 'end',
        label: 'End',
        sublabel: 'END',
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

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          border: 'border-emerald-400',
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          badgeBg: 'bg-emerald-50',
          badgeText: 'text-emerald-700',
          badgeBorder: 'border-emerald-100',
          line: 'bg-emerald-300',
          icon: 'text-emerald-500',
          iconBg: 'bg-emerald-50',
        }
      case 'running':
        return {
          border: 'border-indigo-400',
          bg: 'bg-indigo-50',
          text: 'text-indigo-700',
          badgeBg: 'bg-indigo-50',
          badgeText: 'text-indigo-700',
          badgeBorder: 'border-indigo-100',
          line: 'bg-indigo-300',
          icon: 'text-indigo-600',
          iconBg: 'bg-indigo-50',
        }
      case 'failed':
        return {
          border: 'border-rose-400',
          bg: 'bg-rose-50',
          text: 'text-rose-700',
          badgeBg: 'bg-rose-50',
          badgeText: 'text-rose-700',
          badgeBorder: 'border-rose-100',
          line: 'bg-rose-300',
          icon: 'text-rose-500',
          iconBg: 'bg-rose-50',
        }
      default:
        return {
          border: 'border-slate-200',
          bg: 'bg-slate-50',
          text: 'text-slate-500',
          badgeBg: 'bg-slate-100',
          badgeText: 'text-slate-600',
          badgeBorder: 'border-slate-200',
          line: 'bg-slate-200',
          icon: 'text-slate-400',
          iconBg: 'bg-slate-100',
        }
    }
  }

  const getNodeIcon = (type: string, status: string) => {
    const config = getStatusConfig(status)
    switch (type) {
      case 'start':
        return (
          <div className={`w-10 h-10 ${config.iconBg} rounded-lg flex items-center justify-center ${config.icon}`}>
            <Play className="w-5 h-5" />
          </div>
        )
      case 'agent':
        return (
          <div className={`w-10 h-10 ${config.iconBg} rounded-lg flex items-center justify-center ${config.icon}`}>
            <Bot className="w-5 h-5" />
          </div>
        )
      case 'llm':
        return (
          <div className={`w-10 h-10 ${config.iconBg} rounded-lg flex items-center justify-center ${config.icon}`}>
            <MessageSquare className="w-5 h-5" />
          </div>
        )
      case 'tool':
        return (
          <div className={`w-10 h-10 ${config.iconBg} rounded-lg flex items-center justify-center ${config.icon}`}>
            <Wrench className="w-5 h-5" />
          </div>
        )
      case 'end':
        return (
          <div className={`w-10 h-10 ${config.iconBg} rounded-lg flex items-center justify-center ${config.icon}`}>
            <Check className="w-5 h-5" />
          </div>
        )
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    const config = getStatusConfig(status)
    const label = status === 'completed' ? 'COMPLETED' : status === 'running' ? 'RUNNING' : status === 'failed' ? 'FAILED' : 'PENDING'

    return (
      <div className={`flex items-center px-3 py-1 ${config.badgeBg} ${config.badgeText} rounded-lg text-sm font-bold border ${config.badgeBorder}`}>
        {status === 'completed' && <Check className="w-4 h-4 mr-1.5" />}
        {status === 'running' && <div className="w-4 h-4 mr-1.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
        {status === 'failed' && <X className="w-4 h-4 mr-1.5" />}
        {status === 'pending' && <Clock className="w-4 h-4 mr-1.5" />}
        {label}
      </div>
    )
  }

  const formatTime = (timestamp?: string | null) => {
    if (!timestamp) return '-'
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const formatShortTime = (timestamp?: string | null) => {
    if (!timestamp) return '-'
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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

  const getEventStatusConfig = (eventType: string) => {
    if (eventType.includes('completed') || eventType === 'workflow_started') {
      return { color: 'bg-emerald-500', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-700', label: 'COMPLETED' }
    }
    if (eventType.includes('started') || eventType === 'llm_message') {
      return { color: 'bg-indigo-500', badgeBg: 'bg-indigo-100', badgeText: 'text-indigo-700', label: 'RUNNING' }
    }
    return { color: 'bg-slate-300', badgeBg: 'bg-slate-100', badgeText: 'text-slate-600', label: eventType.toUpperCase() }
  }


  // Render payload details in a structured format
  const renderPayloadDetails = (payload: Record<string, unknown> | undefined): React.ReactNode => {
    if (!payload) return null

    const entries = Object.entries(payload).filter(([key]) =>
      !['parent_agent', 'agent', 'tool'].includes(key)
    )

    return entries.map(([key, value], i) => {
      // Format key for display
      const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

      // Format value based on type
      let displayValue: React.ReactNode
      if (typeof value === 'string') {
        if (value.length > 100) {
          displayValue = <span className="text-slate-600">{value.slice(0, 100)}...</span>
        } else {
          displayValue = <span className="text-slate-600">{value}</span>
        }
      } else if (typeof value === 'number') {
        displayValue = <span className="text-slate-600 font-mono">{value}</span>
      } else if (typeof value === 'boolean') {
        displayValue = <span className="text-slate-600">{value ? 'Yes' : 'No'}</span>
      } else if (value === null) {
        displayValue = <span className="text-slate-400 italic">null</span>
      } else if (Array.isArray(value)) {
        displayValue = <span className="text-slate-600">[{value.length} items]</span>
      } else if (typeof value === 'object') {
        const objEntries = Object.entries(value as object).slice(0, 3)
        displayValue = (
          <div className="pl-2 border-l-2 border-slate-200 space-y-1">
            {objEntries.map(([k, v], idx) => (
              <div key={idx} className="text-[10px]">
                <span className="text-slate-400">{k}:</span>{' '}
                <span className="text-slate-600">
                  {typeof v === 'string' ? v.slice(0, 50) : JSON.stringify(v).slice(0, 50)}
                </span>
              </div>
            ))}
            {Object.keys(value as object).length > 3 && (
              <div className="text-[10px] text-slate-400">+{Object.keys(value as object).length - 3} more...</div>
            )}
          </div>
        )
      }

      return (
        <div key={i} className="text-xs">
          <span className="text-slate-400 font-medium">{displayKey}:</span>{' '}
          {displayValue}
        </div>
      )
    })
  }

  // Format event payload into readable text
  const formatPayload = (payload: Record<string, unknown> | undefined): string | null => {
    if (!payload || Object.keys(payload).length === 0) return null

    // Handle LLM response text
    if (payload.text && typeof payload.text === 'string') {
      return payload.text
    }

    // Handle tool calls
    if (payload.tool && typeof payload.tool === 'string') {
      const toolName = payload.tool
      const label = payload.label && typeof payload.label === 'string' ? payload.label : toolName
      let result = `${label}`

      // Add parameters if present
      const params = Object.entries(payload)
        .filter(([key]) => !['tool', 'label', 'parent_agent', 'agent'].includes(key))
        .map(([key, value]) => {
          if (typeof value === 'string') return `${key}: ${value}`
          if (typeof value === 'number') return `${key}: ${value}`
          if (typeof value === 'boolean') return `${key}: ${value}`
          return `${key}: ${JSON.stringify(value).slice(0, 50)}`
        })
        .join(', ')

      if (params) {
        result += ` (${params})`
      }

      return result
    }

    // Handle agent info
    if (payload.agent && typeof payload.agent === 'string') {
      const agentName = payload.agent
      const details = Object.entries(payload)
        .filter(([key]) => !['agent', 'parent_agent'].includes(key))
        .map(([key, value]) => {
          if (typeof value === 'string') return `${key}: ${value}`
          if (typeof value === 'number') return `${key}: ${value}`
          return `${key}: ${JSON.stringify(value).slice(0, 50)}`
        })
        .join(', ')

      return details ? `Agent: ${agentName} - ${details}` : `Agent: ${agentName}`
    }

    // Handle order/workflow info
    if (payload.order_id && typeof payload.order_id === 'string') {
      return `Order ID: ${payload.order_id}`
    }

    // Generic formatting for other payloads
    const entries = Object.entries(payload)
    if (entries.length === 0) return null

    return entries
      .map(([key, value]) => {
        if (typeof value === 'string') return `${key}: ${value}`
        if (typeof value === 'number') return `${key}: ${value}`
        if (typeof value === 'boolean') return `${key}: ${value}`
        if (value === null) return `${key}: null`
        if (Array.isArray(value)) return `${key}: [${value.length} items]`
        if (typeof value === 'object') return `${key}: {${Object.keys(value as object).join(', ')}}`
        return `${key}: ${String(value).slice(0, 50)}`
      })
      .join(' · ')
  }

  if (!runId) {
    return (
      <Layout>
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="text-slate-500">No run selected.</div>
        </div>
      </Layout>
    )
  }

  const runStatus = run?.status || 'pending'
  const statusConfig = getStatusConfig(runStatus)

  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Central Flow View */}
        <section className="flex-1 flex flex-col overflow-y-auto bg-slate-50 relative">
          {/* Breadcrumb & Top Bar */}
          <div className="p-6 pb-0">

            {/* Status Bar */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-6 gap-4">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Status</span>
                  {getStatusBadge(runStatus)}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Run ID</span>
                  <span className="text-sm font-bold text-slate-900">#{run?.run_id?.slice(0, 8).toUpperCase() || 'N/A'}</span>
                </div>
                <div className="hidden sm:flex flex-col border-l border-slate-100 pl-6">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Template</span>
                  <span className="text-sm font-medium text-slate-700">{run?.template_id || 'Unknown'}</span>
                </div>
                <div className="hidden md:flex flex-col border-l border-slate-100 pl-6">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Order ID</span>
                  <span className="text-sm font-mono font-medium text-slate-700">
                    {(run?.payload?.order_id as string) || (run?.payload?.input as string) || '-'}
                  </span>
                </div>
                <div className="hidden lg:flex flex-col border-l border-slate-100 pl-6">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Start Time</span>
                  <div className="flex items-center text-sm text-slate-700 font-medium">
                    <Calendar className="w-4 h-4 mr-1.5 text-slate-400" />
                    {formatTime(run?.created_at)}
                  </div>
                </div>
                <div className="hidden lg:flex flex-col border-l border-slate-100 pl-6">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Duration</span>
                  <div className="flex items-center text-sm text-slate-700 font-medium">
                    <Clock className="w-4 h-4 mr-1.5 text-slate-400" />
                    {calculateDuration(run?.created_at, run?.completed_at)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => reRunMutation.mutate()}
                  disabled={reRunMutation.isPending}
                  className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition shadow-sm disabled:opacity-50 whitespace-nowrap"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${reRunMutation.isPending ? 'animate-spin' : ''}`} />
                  Re-run
                </button>
                <button className="inline-flex items-center px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition shadow-sm">
                  <FileText className="w-4 h-4 mr-2 text-slate-400" />
                  Logs
                </button>
                <button className="p-2 border border-slate-300 bg-white text-slate-500 rounded-lg hover:bg-slate-50">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Vertical Flow Diagram - No scrollbar visible */}
          <div className="flex flex-col items-center py-6 px-6 overflow-y-auto scrollbar-hide">
            <style>{`
              .scrollbar-hide::-webkit-scrollbar {
                display: none;
              }
              .scrollbar-hide {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
            `}</style>
            {workflowNodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Clock className="w-12 h-12 mb-4" />
                <p className="text-lg font-medium">Waiting for workflow to start...</p>
                <p className="text-sm">Events will appear here as they occur</p>
              </div>
            ) : (
              workflowNodes.map((node, index) => {
                const config = getStatusConfig(node.status)
                const isLast = index === workflowNodes.length - 1
                const isExpanded = expandedNodes.has(node.id)

                return (
                  <div key={node.id} className="relative flex flex-col items-center w-full max-w-md">
                    {/* Node Card */}
                    <div
                      className={`w-full bg-white rounded-xl border ${node.status === 'running' ? 'border-2' : ''} ${config.border} shadow-sm p-5 relative`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {getNodeIcon(node.type, node.status)}
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{node.label}</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{node.sublabel}</p>
                          </div>
                        </div>
                        <div className={config.icon}>
                          {node.status === 'completed' && <Check className="w-5 h-5" />}
                          {node.status === 'running' && (
                            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          )}
                          {node.status === 'failed' && <X className="w-5 h-5" />}
                          {node.status === 'pending' && <Clock className="w-5 h-5" />}
                        </div>
                      </div>

                      {/* Expandable Content */}
                      {node.payload && node.status !== 'pending' && (
                        <button
                          onClick={() => toggleNodeExpand(node.id)}
                          className="w-full flex items-center justify-between text-xs font-medium text-slate-500 py-2 px-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition"
                        >
                          <span>{isExpanded ? 'Hide Details' : 'Show Details'}</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}

                      {isExpanded && node.payload && (
                        <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {formatPayload(node.payload) || 'No additional details'}
                          </p>
                        </div>
                      )}

                      {/* Running Progress */}
                      {node.status === 'running' && (
                        <div className="mt-3 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-indigo-600 font-medium">Processing...</span>
                            <div className="flex gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" />
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Connector Line */}
                    {!isLast && (
                      <div className={`w-0.5 h-10 ${node.status === 'completed' ? statusConfig.line : 'bg-slate-200'}`} />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* Event Log Sidebar */}
        <aside className="w-80 lg:w-96 bg-white border-l border-slate-200 flex flex-col shadow-lg z-10">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Event Log</h2>
            <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition">
              <Filter className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 relative scrollbar-hide">
            <style>{`
              .scrollbar-hide::-webkit-scrollbar {
                display: none;
              }
              .scrollbar-hide {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
            `}</style>

            {events.length === 0 ? (
              <div className="text-center text-slate-400 py-8">
                <Clock className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No events yet</p>
              </div>
            ) : (
              events.map((event, idx) => {
                const eventConfig = getEventStatusConfig(event.event_type)
                const isExpanded = expandedNodes.has(`event-${idx}`)
                const hasPayload = event.payload && Object.keys(event.payload).length > 0

                return (
                  <div
                    key={idx}
                    className={`relative p-3 rounded-lg border cursor-pointer transition-all ${
                      isExpanded ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100 hover:border-slate-200'
                    }`}
                    onClick={() => toggleNodeExpand(`event-${idx}`)}
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${eventConfig.color}`}></div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${eventConfig.badgeBg} ${eventConfig.badgeText}`}>
                          {eventConfig.label}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">{formatShortTime(event.created_at)}</span>
                    </div>

                    {/* Event Name - always visible */}
                    <h4 className="text-sm font-semibold text-slate-900 mt-2">{event.event}</h4>

                    {/* Expanded Details - only when expanded */}
                    {isExpanded && hasPayload && (
                      <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                        {renderPayloadDetails(event.payload)}
                      </div>
                    )}

                    {/* Expand/Collapse Hint */}
                    {hasPayload && (
                      <div className="flex items-center justify-center mt-2">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
          <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">{events.length} Events logged</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-bold text-slate-700">Connected</span>
            </div>
          </div>
        </aside>
      </div>
    </Layout>
  )
}
