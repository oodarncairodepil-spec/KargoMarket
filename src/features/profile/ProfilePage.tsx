import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { PageShell } from '../../components/PageShell'
import { UserAvatarMenu } from '../../components/UserAvatarMenu'
import { useAuthStore } from '../../store/useAuthStore'

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const backPath = user?.role === 'admin' ? '/admin' : '/customer/inquiries'

  return (
    <PageShell
      title="Profil"
      showHomeLink={false}
      headerRight={
        <div className="flex items-center gap-2">
          <Link to={backPath} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
            Kembali
          </Link>
          <UserAvatarMenu />
        </div>
      }
    >
      <Card className="text-left">
        <p className="text-sm text-slate-500">Nama</p>
        <p className="mt-1 font-semibold text-slate-900">{user?.name || '—'}</p>
        <p className="mt-4 text-sm text-slate-500">Email</p>
        <p className="mt-1 font-medium text-slate-900">{user?.email || '—'}</p>
        <p className="mt-4 text-sm text-slate-500">Role</p>
        <p className="mt-1 font-medium text-slate-900">{user?.role || '—'}</p>
      </Card>
    </PageShell>
  )
}
