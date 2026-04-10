import { Card } from '../../components/Card'
import { useAuthStore } from '../../store/useAuthStore'

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)

  return (
    <>
      <Card className="text-left">
        <p className="text-sm text-slate-500">Nama</p>
        <p className="mt-1 font-semibold text-slate-900">{user?.name || '—'}</p>
        <p className="mt-4 text-sm text-slate-500">Email</p>
        <p className="mt-1 font-medium text-slate-900">{user?.email || '—'}</p>
        <p className="mt-4 text-sm text-slate-500">Role</p>
        <p className="mt-1 font-medium text-slate-900">{user?.role || '—'}</p>
      </Card>
    </>
  )
}
