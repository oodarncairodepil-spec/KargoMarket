import { Link } from 'react-router-dom'
import { Badge } from '../../components/Badge'
import { SectionCard } from '../../components/ui/SectionCard'
import { Button } from '../../components/ui/Button'
import { inquiryStatusBadgeVariant, inquiryStatusLabel } from '../../lib/inquiryStatus'
import { useAuthStore } from '../../store/useAuthStore'
import { useLogisticsStore } from '../../store/useLogisticsStore'

export function CustomerInquiryHistoryPage() {
  const user = useAuthStore((s) => s.user)
  const inquiries = useLogisticsStore((s) => s.inquiries)
  const myInquiries = inquiries.filter((inq) => !inq.createdByUserId || inq.createdByUserId === user?.id)

  return (
    <>
      <Link to="/customer/inquiry/new">
        <Button fullWidth>+ Tambah permintaan baru</Button>
      </Link>

      {myInquiries.length === 0 ? (
        <SectionCard className="text-center text-sm text-slate-600">Belum ada permintaan.</SectionCard>
      ) : (
        <div className="flex flex-col gap-3">
          {myInquiries.map((inq) => (
            <Link key={inq.id} to={`/customer/inquiry/${inq.id}`}>
              <SectionCard className="text-left">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">
                    {inq.pickup} → {inq.destination}
                  </p>
                  <Badge variant={inquiryStatusBadgeVariant(inq.status)}>{inquiryStatusLabel(inq.status)}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{inq.itemDescription}</p>
                <p className="mt-2 text-xs text-slate-500">{new Date(inq.createdAt).toLocaleString('id-ID')}</p>
              </SectionCard>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
