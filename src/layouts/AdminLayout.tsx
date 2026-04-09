import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav, HomeIcon, InquiryIcon, VendorIcon } from '../components/ui/BottomNav'
import { TopBar } from '../components/ui/TopBar'
import { UserAvatarMenu } from '../components/UserAvatarMenu'

function titleFor(path: string): string {
  if (path === '/admin') return 'Admin Dashboard'
  if (path.startsWith('/admin/vendors')) return 'Manajemen Vendor'
  if (path.startsWith('/admin/inquiries')) return 'Semua Permintaan'
  if (path.startsWith('/admin/inquiry/')) return 'Detail Permintaan'
  if (path.startsWith('/admin/profile')) return 'Profil'
  return 'Admin'
}

export function AdminLayout() {
  const location = useLocation()
  const path = location.pathname
  const search = location.search
  const isVendorForm = path.startsWith('/admin/vendors') && new URLSearchParams(search).get('mode') === 'form'
  const backTo = path.startsWith('/admin/inquiry/')
    ? '/admin/inquiries'
    : isVendorForm
      ? '/admin/vendors'
      : undefined
  const backLabel = path.startsWith('/admin/inquiry/') ? 'Daftar permintaan' : 'Kembali ke daftar vendor'

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-28">
      <TopBar title={titleFor(path)} backTo={backTo} backLabel={backLabel} rightSlot={<UserAvatarMenu />} />
      <main className="mt-4 flex flex-1 flex-col gap-4 pb-20">
        <Outlet />
      </main>
      <BottomNav
        items={[
          { to: '/admin', label: 'Home', icon: HomeIcon, match: (p) => p === '/admin' },
          { to: '/admin/vendors', label: 'Vendors', icon: VendorIcon, match: (p) => p.startsWith('/admin/vendors') },
          {
            to: '/admin/inquiries',
            label: 'Inquiries',
            icon: InquiryIcon,
            match: (p) => p.startsWith('/admin/inquiries') || p.startsWith('/admin/inquiry/'),
          },
        ]}
      />
    </div>
  )
}
