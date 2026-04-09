import { Navigate, useLocation } from 'react-router-dom'
import type { AuthRole } from '../store/useAuthStore'
import { useAuthStore } from '../store/useAuthStore'

export function RequireAuth({
  allowRoles,
  children,
}: {
  allowRoles: AuthRole[]
  children: React.ReactNode
}) {
  const location = useLocation()
  const hydrated = useAuthStore((s) => s.hydrated)
  const user = useAuthStore((s) => s.user)

  if (!hydrated) return <p className="p-6 text-center text-sm text-slate-500">Memuat sesi...</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!allowRoles.includes(user.role)) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/customer/inquiries'} replace />
  }
  return <>{children}</>
}
