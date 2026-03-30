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

export const useUpdateTemplateWorkflowYaml = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      workflow_yaml,
    }: {
      id: string
      workflow_yaml: string
    }) => templatesApi.updateWorkflowYaml(id, { workflow_yaml }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      queryClient.invalidateQueries({ queryKey: ['templates', vars.id] })
    },
  })
}
