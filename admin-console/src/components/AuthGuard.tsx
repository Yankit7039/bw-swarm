import { Navigate, useLocation } from 'react-router-dom'

interface AuthGuardProps {
  children: React.ReactNode
}

export const AuthGuard = ({ children }: AuthGuardProps) => {
  const location = useLocation()
  const isAuthenticated = localStorage.getItem('admin-console-auth') === 'true'

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
