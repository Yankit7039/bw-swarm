import { adminApi } from './adminClient'
import { runtimeApi } from './runtimeClient'
import type { Run } from '../types/common'
import type { PaginatedResponse } from '../types/template'

export interface TriggerRunRequest {
  template_id: string
  order_id: string
}

export const runsApi = {
  list: async (
    params: { template_id?: string; status?: string; limit?: number; offset?: number } = {}
  ): Promise<PaginatedResponse<Run>> => {
    const response = await adminApi.get('/runs/', { params })
    const raw = response.data
    const items = Array.isArray(raw) ? raw : raw?.data ?? []
    return {
      data: items,
      pagination: {
        total: items.length,
        limit: params.limit ?? 50,
        offset: params.offset ?? 0,
      },
    }
  },

  get: async (runId: string): Promise<Run> => {
    const response = await adminApi.get(`/runs/${runId}`)
    return response.data
  },

  events: async (runId: string): Promise<any[]> => {
    const response = await adminApi.get(`/runs/${runId}/events`)
    return response.data
  },

  trigger: async ({ template_id, order_id }: TriggerRunRequest): Promise<{ run_id: string }> => {
    const response = await runtimeApi.post('/runs', {
      template_id,
      payload: { order_id },
    })
    return response.data
  },
}

