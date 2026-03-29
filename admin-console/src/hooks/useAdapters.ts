import { useQuery } from '@tanstack/react-query'
import { adaptersApi } from '../api/adapters'

export const useAdapters = () => {
  return useQuery({
    queryKey: ['adapters'],
    queryFn: () => adaptersApi.list(),
  })
}

export const useAdapter = (adapterName: string) => {
  return useQuery({
    queryKey: ['adapters', adapterName],
    queryFn: () => adaptersApi.get(adapterName),
    enabled: !!adapterName,
  })
}
