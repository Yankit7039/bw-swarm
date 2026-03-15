import { useQuery } from '@tanstack/react-query'
import { eventsApi } from '../api/events'

export const useLogs = (params?: {
  agent_id?: string
  step_id?: string
  event_type?: string
  level?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}) => {
  return useQuery({
    queryKey: ['logs', params],
    queryFn: () => eventsApi.getLogs(params),
  })
}

export const useMetrics = (refetchInterval = 30000) => {
  return useQuery({
    queryKey: ['metrics'],
    queryFn: eventsApi.getMetrics,
    refetchInterval,
  })
}
