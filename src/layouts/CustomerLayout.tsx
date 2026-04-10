import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav, InquiryIcon, ProfileIcon } from '../components/ui/BottomNav'
import { TopBar } from '../components/ui/TopBar'
import { UserAvatarMenu } from '../components/UserAvatarMenu'

function titleFor(path: string): string {
  if (path.startsWith('/customer/inquiries')) return 'Riwayat Permintaan'
  if (path.startsWith('/customer/inquiry/new')) return 'Permintaan Pengiriman'
  if (path.includes('/quotes')) return 'Pilih Penawaran'
  if (path.includes('/invoice')) return 'Tagihan'
  if (path.includes('/payment')) return 'Pembayaran'
  if (path.startsWith('/customer/inquiry/')) return 'Detail Permintaan'
  if (path.startsWith('/customer/profile')) return 'Profil'
  return 'Customer'
}

export function CustomerLayout() {
  const location = useLocation()
  const path = location.pathname
  const inquiryIdMatch = path.match(/^\/customer\/inquiry\/([^/]+)/)
  const inquiryPath = inquiryIdMatch ? `/customer/inquiry/${inquiryIdMatch[1]}` : '/customer/inquiries'
  const backTo =
    path.startsWith('/customer/inquiry/new') ||
    path.startsWith('/customer/profile') ||
    /^\/customer\/inquiry\/[^/]+$/.test(path)
      ? '/customer/inquiries'
      : path.includes('/quotes') || path.includes('/invoice') || path.includes('/payment')
        ? inquiryPath
        : undefined

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-28">
      <TopBar title={titleFor(path)} backTo={backTo} backLabel="Kembali" rightSlot={<UserAvatarMenu />} />
      <main className="mt-4 flex flex-1 flex-col gap-4 pb-20">
        <Outlet />
      </main>
      <BottomNav
        items={[
          {
            to: '/customer/inquiries',
            label: 'Inquiries',
            icon: InquiryIcon,
            match: (p) => p.startsWith('/customer/inquiries'),
          },
          {
            to: '/customer/profile',
            label: 'Profil',
            icon: ProfileIcon,
            match: (p) => p.startsWith('/customer/profile'),
          },
        ]}
      />
    </div>
  )
}
