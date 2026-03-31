import { adminApi } from './adminClient'
import type { Run } from '../types/common'
import type { PaginatedResponse } from '../types/template'

export interface TriggerRunRequest {
  template_id: string
  order_id: string
}

export interface TriggerBatchRequest {
  template_id: string
  order_ids: string[]
}

export interface TriggerBatchResult {
  successful: { order_id: string; run_id: string }[]
  failed: { order_id: string; error: string }[]
}

export const runsApi = {
  list: async (
    params: { template_id?: string; status?: string; time_period?: string; limit?: number; offset?: number } = {}
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
    const response = await adminApi.post('/runs/enqueue', {
      template_id,
      payload: { order_id },
    })
    return response.data
  },

  triggerBatch: async ({ template_id, order_ids }: TriggerBatchRequest): Promise<TriggerBatchResult> => {
    const results: TriggerBatchResult = { successful: [], failed: [] }

    await Promise.all(
      order_ids.map(async (order_id) => {
        try {
          const response = await adminApi.post('/runs/enqueue', {
            template_id,
            payload: { order_id },
          })
          results.successful.push({ order_id, run_id: response.data.run_id })
        } catch (error) {
          results.failed.push({
            order_id,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      })
    )

    return results
  },

  listWithEvents: async (params: { status?: string; limit?: number } = {}): Promise<Run[]> => {
    const runsResponse = await adminApi.get('/runs/', { params })
    const runs: Run[] = Array.isArray(runsResponse.data)
      ? runsResponse.data
      : runsResponse.data?.data ?? []

    const runsWithEvents = await Promise.all(
      runs.map(async (run) => {
        try {
          const eventsResponse = await adminApi.get(`/runs/${run.run_id}/events`)
          return {
            ...run,
            events: eventsResponse.data || [],
          }
        } catch {
          return { ...run, events: [] }
        }
      })
    )

    return runsWithEvents
  },
}

