import { Link, useLocation } from 'react-router-dom'

function navClass(active: boolean): string {
  return active
    ? 'flex-1 rounded-xl bg-accent px-3 py-2 text-center text-xs font-semibold text-white'
    : 'flex-1 rounded-xl bg-slate-100 px-3 py-2 text-center text-xs font-semibold text-slate-700'
}

export function AdminBottomNav() {
  const location = useLocation()
  const path = location.pathname
  const isHome = path === '/admin'
  const isVendors = path.startsWith('/admin/vendors')
  const isInquiries = path.startsWith('/admin/inquiries') || path.startsWith('/admin/inquiry/')

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-lg gap-2">
        <Link to="/admin" className={navClass(isHome)}>
          Home
        </Link>
        <Link to="/admin/vendors" className={navClass(isVendors)}>
          Vendors
        </Link>
        <Link to="/admin/inquiries" className={navClass(isInquiries)}>
          Inquiries
        </Link>
      </div>
    </nav>
  )
}
