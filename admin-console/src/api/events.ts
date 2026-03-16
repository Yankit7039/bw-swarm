import { adminApi } from './adminClient'
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
    const response = await adminApi.get('/events', { params })
    const raw = response.data
    const items = Array.isArray(raw) ? raw : raw?.data ?? []
    return {
      data: items,
      pagination: {
        total: items.length,
        limit: params?.limit ?? 50,
        offset: params?.offset ?? 0,
      },
    }
  },

  getMetrics: async (): Promise<MetricsSnapshot> => {
    const response = await adminApi.get('/metrics')
    return response.data
  },

  getHealth: async (): Promise<{ status: string }> => {
    const response = await adminApi.get('/health')
    return response.data
  },
}
