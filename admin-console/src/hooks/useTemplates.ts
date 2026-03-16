import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { templatesApi } from '../api/templates'

export const useTemplates = (limit = 20, offset = 0) => {
  return useQuery({
    queryKey: ['templates', limit, offset],
    queryFn: () => templatesApi.list(limit, offset),
  })
}

export const useTemplate = (id: string) => {
  return useQuery({
    queryKey: ['templates', id],
    queryFn: () => templatesApi.get(id),
    enabled: !!id,
  })
}

export const useCreateTemplate = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: templatesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    },
  })
}
