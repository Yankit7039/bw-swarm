import { api } from './client'
import type {
  AgentSummary,
  AgentDetail,
  CreateAgentRequest,
  AgentResponse,
  AgentStateResponse,
  StepListResponse,
  PaginatedResponse,
} from '../types/agent'

export const agentsApi = {
  list: async (
    params?: {
      status?: string
      template_id?: string
      from?: string
      to?: string
      limit?: number
      offset?: number
    }
  ): Promise<PaginatedResponse<AgentSummary>> => {
    const response = await api.get('/agents', { params })
    return response.data
  },

  get: async (id: string): Promise<AgentDetail> => {
    const response = await api.get(`/agents/${id}`)
    return response.data
  },

  getSteps: async (id: string): Promise<StepListResponse> => {
    const response = await api.get(`/agents/${id}/steps`)
    return response.data
  },

  create: async (data: CreateAgentRequest): Promise<AgentResponse> => {
    const response = await api.post('/agents', data)
    return response.data
  },

  pause: async (id: string): Promise<AgentStateResponse> => {
    const response = await api.post(`/agents/${id}/pause`)
    return response.data
  },

  resume: async (id: string): Promise<AgentStateResponse> => {
    const response = await api.post(`/agents/${id}/resume`)
    return response.data
  },

  cancel: async (id: string): Promise<AgentStateResponse> => {
    const response = await api.post(`/agents/${id}/cancel`)
    return response.data
  },
}
