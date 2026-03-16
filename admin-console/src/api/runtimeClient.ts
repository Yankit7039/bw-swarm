import axios from 'axios'

const RUNTIME_API_BASE_URL =
  (import.meta as any).env?.VITE_RUNTIME_API_URL || 'http://localhost:30080'

export const runtimeApi = axios.create({
  baseURL: RUNTIME_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

runtimeApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || 'Unknown error'
    console.error('Runtime API Error:', message)
    return Promise.reject(error)
  }
)

