import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { PageShell } from '../../components/PageShell'

export function HomePage() {
  return (
    <PageShell showHomeLink={false} title="KargoMarket">
      <p className="text-left text-slate-600">
        Platform pengiriman 3 pihak: Customer, Vendor, dan Admin. Customer dan Admin wajib login, sedangkan vendor
        mengisi penawaran via tautan token unik.
      </p>

      <Card className="mt-3 text-left">
        <h2 className="text-lg font-semibold text-slate-900">Masuk sebagai Customer / Admin</h2>
        <p className="mt-1 text-sm text-slate-600">Akses dashboard sesuai peran setelah login.</p>
        <Link
          to="/login"
          className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-accent px-4 text-center text-base font-semibold text-white shadow-sm active:scale-[0.99]"
        >
          Buka halaman login
        </Link>
      </Card>

      <p className="text-center text-xs text-slate-400">Vendor tetap melalui tautan /vendor/quote/:token dari admin.</p>
    </PageShell>
  )
}
