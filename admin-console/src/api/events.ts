import type { EventSummary, MetricsSnapshot, PaginatedResponse } from '../types/event'

export const eventsApi = {
  getLogs: async (
    params?: {
      agent_id?: string
      step_id?: string
      event_type?: string
      level?: string
      from?: string
      to?: string
      limit?: number
      offset?: number
    }
  ): Promise<PaginatedResponse<EventSummary>> => {
    const empty: PaginatedResponse<EventSummary> = {
      items: [],
      total: 0,
    }
    return empty
  },

  getMetrics: async (): Promise<MetricsSnapshot> => {
    const metrics: MetricsSnapshot = {
      agents: {
        running: 0,
        paused: 0,
        completed_last_hour: 0,
        failed_last_hour: 0,
      },
    }
    return metrics
  },

  getHealth: async (): Promise<{ status: string }> => {
    return { status: 'disabled' }
  },
}
