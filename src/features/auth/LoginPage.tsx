import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Card } from '../../components/Card'
import { PageShell } from '../../components/PageShell'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useAuthStore } from '../../store/useAuthStore'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)
  const currentUser = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const storeError = useAuthStore((s) => s.error)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState('')

  const redirectTarget =
    typeof location.state === 'object' &&
    location.state &&
    'from' in location.state &&
    typeof (location.state as { from?: unknown }).from === 'string'
      ? (location.state as { from: string }).from
      : null

  useEffect(() => {
    if (!currentUser) return
    navigate(currentUser.role === 'admin' ? '/admin' : '/customer/inquiries', { replace: true })
  }, [currentUser, navigate])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError('')
    try {
      const user = await login({ email, password })
      if (redirectTarget) {
        navigate(redirectTarget, { replace: true })
      } else {
        navigate(user.role === 'admin' ? '/admin' : '/customer/inquiries', { replace: true })
      }
    } catch {
      setLocalError('Login gagal. Periksa email/password atau pastikan server API aktif.')
    }
  }

  return (
    <PageShell showHomeLink={false} title="Masuk">
      <Card className="text-left">
        <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="text-sm font-medium text-slate-700">
            Email
            <Input
              className="mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@perusahaan.com"
              autoComplete="email"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Password
            <Input
              type="password"
              className="mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password"
              autoComplete="current-password"
            />
          </label>
          {(localError || storeError) && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{localError || storeError}</p>
          )}
          <Button
            type="submit"
            disabled={loading}
            variant="neutralDark"
            size="lg"
            fullWidth
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </Button>
        </form>
      </Card>

      <Link to="/home" className="text-center text-sm font-medium text-accent">
        Kembali ke beranda
      </Link>
    </PageShell>
  )
}
