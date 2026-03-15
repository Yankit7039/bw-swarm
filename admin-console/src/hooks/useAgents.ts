import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentsApi } from '../api/agents'
import { useAgentStore } from '../store/agentStore'
import type { CreateAgentRequest } from '../types/agent'

export const useAgents = (params?: {
  status?: string
  template_id?: string
  limit?: number
  offset?: number
}) => {
  const setAgents = useAgentStore((state) => state.setAgents)

  return useQuery({
    queryKey: ['agents', params],
    queryFn: async () => {
      const result = await agentsApi.list(params)
      setAgents(result.data)
      return result
    },
  })
}

export const useAgent = (id: string) => {
  const setSteps = useAgentStore((state) => state.setSteps)

  return useQuery({
    queryKey: ['agents', id],
    queryFn: async () => {
      const result = await agentsApi.get(id)
      setSteps(id, result.steps)
      return result
    },
    enabled: !!id,
  })
}

export const useCreateAgent = () => {
  const queryClient = useQueryClient()
  const addAgent = useAgentStore((state) => state.addAgent)

  return useMutation({
    mutationFn: agentsApi.create,
    onSuccess: (data) => {
      addAgent({
        id: data.id,
        template_id: data.template_id,
        template_name: 'New Agent',
        status: data.status,
        triggered_by: 'manual',
        started_at: data.started_at,
      })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

export const usePauseAgent = () => {
  const queryClient = useQueryClient()
  const updateAgent = useAgentStore((state) => state.updateAgent)

  return useMutation({
    mutationFn: agentsApi.pause,
    onSuccess: (data) => {
      updateAgent(data.id, { status: data.status })
      queryClient.invalidateQueries({ queryKey: ['agents', data.id] })
    },
  })
}

export const useResumeAgent = () => {
  const queryClient = useQueryClient()
  const updateAgent = useAgentStore((state) => state.updateAgent)

  return useMutation({
    mutationFn: agentsApi.resume,
    onSuccess: (data) => {
      updateAgent(data.id, { status: data.status })
      queryClient.invalidateQueries({ queryKey: ['agents', data.id] })
    },
  })
}

export const useCancelAgent = () => {
  const queryClient = useQueryClient()
  const updateAgent = useAgentStore((state) => state.updateAgent)

  return useMutation({
    mutationFn: agentsApi.cancel,
    onSuccess: (data) => {
      updateAgent(data.id, { status: data.status })
      queryClient.invalidateQueries({ queryKey: ['agents', data.id] })
    },
  })
}
