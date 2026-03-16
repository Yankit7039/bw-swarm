import { useEffect } from 'react'

export const useSSE = () => {
  useEffect(() => {
    console.log('[SSE] disabled: legacy /api/events/stream removed')
  }, [])
}
