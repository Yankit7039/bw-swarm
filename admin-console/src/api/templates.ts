import { adminApi } from './adminClient'
import type {
  TemplateSummary,
  TemplateDetail,
  CreateTemplateRequest,
  TemplateResponse,
  ValidateTemplateResponse,
  PaginatedResponse,
  UpdateTemplateWorkflowRequest,
} from '../types/template'

function mapTemplateDetail(raw: {
  template_id?: string
  id?: string
  name: string
  config?: Record<string, unknown> | null
  workflow_yaml?: string | null
  version?: number
  created_at: string
  updated_at: string
  definition?: TemplateDetail['definition']
}): TemplateDetail {
  return {
    id: raw.template_id ?? raw.id ?? '',
    name: raw.name,
    version: raw.version ?? 1,
    config: raw.config,
    workflow_yaml: raw.workflow_yaml,
    definition: raw.definition,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  }
}

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
        config?: Record<string, unknown> | null
        workflow_yaml?: string | null
        version?: number
        created_at: string
        updated_at: string
      }) => ({
        id: t.template_id ?? t.id ?? '',
        name: t.name,
        config: t.config,
        workflow_yaml: t.workflow_yaml,
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
    return mapTemplateDetail(response.data)
  },

  updateWorkflowYaml: async (
    id: string,
    body: UpdateTemplateWorkflowRequest
  ): Promise<TemplateDetail> => {
    const response = await adminApi.patch(`/templates/${id}`, body)
    return mapTemplateDetail(response.data)
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
