import { adminApi } from './adminClient'
import type { Adapter } from '../types/adapter'

export const adaptersApi = {
  list: async (): Promise<Adapter[]> => {
    const response = await adminApi.get('/adapters/')
    const raw = response.data
    return Array.isArray(raw) ? raw : []
  },

  get: async (adapterName: string): Promise<Adapter> => {
    const response = await adminApi.get(`/adapters/${encodeURIComponent(adapterName)}`)
    return response.data
  },
}
