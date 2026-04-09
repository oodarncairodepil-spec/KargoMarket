import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'

export function SessionActions() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  if (!user) return null

  return (
    <button
      type="button"
      onClick={async () => {
        await logout()
        navigate('/login', { replace: true })
      }}
      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
    >
      Keluar
    </button>
  )
}
