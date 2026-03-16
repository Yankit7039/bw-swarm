import axios from 'axios'

const ADMIN_API_BASE_URL =
  (import.meta as any).env?.VITE_ADMIN_API_URL || 'http://localhost:30081'

export const adminApi = axios.create({
  baseURL: ADMIN_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || 'Unknown error'
    console.error('Admin API Error:', message)
    return Promise.reject(error)
  }
)

