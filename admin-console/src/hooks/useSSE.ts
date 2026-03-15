import { useEffect, useRef } from 'react'
import { useAgentStore } from '../store/agentStore'

export const useSSE = () => {
  const updateAgent = useAgentStore((state) => state.updateAgent)
  const updateStep = useAgentStore((state) => state.updateStep)
  const addAgent = useAgentStore((state) => state.addAgent)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let eventSource: EventSource | null = null
    let isConnecting = false

    const connect = () => {
      if (isConnecting || eventSource?.readyState === EventSource.OPEN) return
      isConnecting = true

      console.log('[SSE] Connecting to /api/events/stream...')
      eventSource = new EventSource('/api/events/stream')

      eventSource.onopen = () => {
        console.log('[SSE] Connected')
        isConnecting = false
      }

      // Handle specific event types from SSE
      const handleEvent = (eventType: string, data: any) => {
        console.log(`[SSE] ${eventType}:`, data)

        switch (eventType) {
          case 'agent.created':
            addAgent({
              id: data.agent_run_id,
              template_id: data.template_id || '',
              template_name: data.template_name || 'Unknown',
              status: 'created',
              triggered_by: data.triggered_by,
              started_at: new Date().toISOString(),
            })
            break

          case 'agent.state_changed':
            updateAgent(data.agent_run_id, { status: data.new_status })
            break

          case 'agent.paused':
            updateAgent(data.agent_run_id, { status: 'paused' })
            break

          case 'agent.resumed':
            updateAgent(data.agent_run_id, { status: 'running' })
            break

          case 'agent.cancelled':
            updateAgent(data.agent_run_id, { status: 'cancelled' })
            break

          case 'agent.completed':
            updateAgent(data.agent_run_id, {
              status: 'completed',
              duration_ms: data.duration_ms,
            })
            break

          case 'agent.failed':
            updateAgent(data.agent_run_id, { status: 'failed' })
            break

          case 'agent.step_started':
            updateAgent(data.agent_run_id, { current_step: data.step_id })
            updateStep(data.agent_run_id, data.step_id, {
              status: 'running',
              step_name: data.step_name,
            })
            break

          case 'agent.step_completed':
            updateStep(data.agent_run_id, data.step_id, {
              status: 'completed',
              duration_ms: data.duration_ms,
              output: data.output,
            })
            break

          case 'agent.step_failed':
            updateStep(data.agent_run_id, data.step_id, {
              status: 'failed',
            })
            break
        }
      }

      // Add listeners for specific event types
      eventSource.addEventListener('agent.created', (e: MessageEvent) => {
        handleEvent('agent.created', JSON.parse(e.data))
      })
      eventSource.addEventListener('agent.state_changed', (e: MessageEvent) => {
        handleEvent('agent.state_changed', JSON.parse(e.data))
      })
      eventSource.addEventListener('agent.paused', (e: MessageEvent) => {
        handleEvent('agent.paused', JSON.parse(e.data))
      })
      eventSource.addEventListener('agent.resumed', (e: MessageEvent) => {
        handleEvent('agent.resumed', JSON.parse(e.data))
      })
      eventSource.addEventListener('agent.cancelled', (e: MessageEvent) => {
        handleEvent('agent.cancelled', JSON.parse(e.data))
      })
      eventSource.addEventListener('agent.completed', (e: MessageEvent) => {
        handleEvent('agent.completed', JSON.parse(e.data))
      })
      eventSource.addEventListener('agent.failed', (e: MessageEvent) => {
        handleEvent('agent.failed', JSON.parse(e.data))
      })
      eventSource.addEventListener('agent.step_started', (e: MessageEvent) => {
        handleEvent('agent.step_started', JSON.parse(e.data))
      })
      eventSource.addEventListener('agent.step_completed', (e: MessageEvent) => {
        handleEvent('agent.step_completed', JSON.parse(e.data))
      })
      eventSource.addEventListener('agent.step_failed', (e: MessageEvent) => {
        handleEvent('agent.step_failed', JSON.parse(e.data))
      })

      eventSource.onerror = (error) => {
        console.error('[SSE] Error:', error)
        isConnecting = false
        eventSource?.close()

        // Reconnect after 3 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[SSE] Reconnecting...')
          connect()
        }, 3000)
      }
    }

    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      eventSource?.close()
    }
  }, [updateAgent, updateStep, addAgent])
}
