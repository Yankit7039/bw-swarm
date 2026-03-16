import { adminApi } from './adminClient'
import type {
  TemplateSummary,
  TemplateDetail,
  CreateTemplateRequest,
  TemplateResponse,
  ValidateTemplateResponse,
  PaginatedResponse,
} from '../types/template'

export const templatesApi = {
  list: async (limit = 20, offset = 0): Promise<PaginatedResponse<TemplateSummary>> => {
    const response = await adminApi.get('/templates/', { params: { limit, offset } })
    const raw = response.data
    const items = Array.isArray(raw) ? raw : raw?.data ?? []
    const data = items.map(
      (t: {
        template_id?: string
        id?: string
        name: string
        version?: number
        created_at: string
        updated_at: string
      }) => ({
        id: t.template_id ?? t.id ?? '',
        name: t.name,
        version: t.version ?? 1,
        created_at: t.created_at,
        updated_at: t.updated_at,
      })
    )
    return {
      data,
      pagination: { total: data.length, limit, offset },
    }
  },

  get: async (id: string): Promise<TemplateDetail> => {
    const response = await adminApi.get(`/templates/${id}`)
    return response.data
  },

  create: async (data: CreateTemplateRequest): Promise<TemplateResponse> => {
    const response = await adminApi.post('/templates/', data)
    return response.data
  },

  validate: async (
    id: string,
    data: CreateTemplateRequest
  ): Promise<ValidateTemplateResponse> => {
    const response = await adminApi.post(`/templates/${id}/validate`, data)
    return response.data
  },
}
