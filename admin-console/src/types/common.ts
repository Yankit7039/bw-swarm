export interface ApiError {
  error: string
  message: string
  details?: Array<{ field: string; message: string }>
}
