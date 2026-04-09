import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || 'U'
}

export function UserAvatarMenu() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  if (!user) return null

  const profilePath = user.role === 'admin' ? '/admin/profile' : '/customer/profile'

  return (
    <details className="relative">
      <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
        {initials(user.name)}
      </summary>
      <div className="absolute right-0 top-12 z-20 w-40 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
        <Link
          to={profilePath}
          className="block rounded-lg px-2 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
        >
          Profil
        </Link>
        <button
          type="button"
          onClick={async () => {
            await logout()
            navigate('/login', { replace: true })
          }}
          className="mt-1 block w-full rounded-lg px-2 py-2 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
        >
          Keluar
        </button>
      </div>
    </details>
  )
}
