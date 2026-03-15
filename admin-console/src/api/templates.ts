import { api } from './client'
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
    const response = await api.get('/templates', { params: { limit, offset } })
    return response.data
  },

  get: async (id: string): Promise<TemplateDetail> => {
    const response = await api.get(`/templates/${id}`)
    return response.data
  },

  create: async (data: CreateTemplateRequest): Promise<TemplateResponse> => {
    const response = await api.post('/templates', data)
    return response.data
  },

  validate: async (
    id: string,
    data: CreateTemplateRequest
  ): Promise<ValidateTemplateResponse> => {
    const response = await api.post(`/templates/${id}/validate`, data)
    return response.data
  },
}
