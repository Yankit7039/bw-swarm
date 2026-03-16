import { api } from './client'
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
    const response = await api.get('/events/logs', { params })
    return response.data
  },

  getMetrics: async (): Promise<MetricsSnapshot> => {
    const response = await api.get('/events/metrics')
    return response.data
  },

  getHealth: async (): Promise<{ status: string }> => {
    const response = await api.get('/health')
    return response.data
  },
}
