import { Link } from 'react-router-dom'
import { PageShell } from '../components/PageShell'

export function NotFoundPage() {
  return (
    <PageShell title="Halaman tidak ada">
      <p className="text-slate-600">URL ini tidak cocok dengan rute aplikasi.</p>
      <Link to="/" className="font-semibold text-accent">
        Ke beranda
      </Link>
    </PageShell>
  )
}
