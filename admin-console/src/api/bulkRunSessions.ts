import { adminApi } from './adminClient'
import type {
  BulkRunSession,
  CreateBulkRunSessionRequest,
  UpdateBulkRunSessionRunsRequest,
  CompleteBulkRunSessionRequest,
} from '../types/bulkRunSession'
import type { PaginatedResponse } from '../types/template'

export const bulkRunSessionsApi = {
  list: async (
    params: { template_id?: string; limit?: number; offset?: number } = {}
  ): Promise<PaginatedResponse<BulkRunSession>> => {
    const response = await adminApi.get('/bulk-run-sessions/', { params })
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

  get: async (sessionId: string): Promise<BulkRunSession> => {
    const response = await adminApi.get(`/bulk-run-sessions/${sessionId}`)
    return response.data
  },

  create: async (request: CreateBulkRunSessionRequest): Promise<BulkRunSession> => {
    const response = await adminApi.post('/bulk-run-sessions/', request)
    return response.data
  },

  updateRuns: async (
    sessionId: string,
    request: UpdateBulkRunSessionRunsRequest
  ): Promise<void> => {
    await adminApi.put(`/bulk-run-sessions/${sessionId}/runs`, request)
  },

  complete: async (
    sessionId: string,
    request: CompleteBulkRunSessionRequest
  ): Promise<void> => {
    await adminApi.post(`/bulk-run-sessions/${sessionId}/complete`, request)
  },
}
