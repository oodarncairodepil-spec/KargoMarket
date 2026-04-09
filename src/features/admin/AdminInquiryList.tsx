import { Link } from 'react-router-dom'
import { Badge } from '../../components/Badge'
import { SectionCard } from '../../components/ui/SectionCard'
import { inquiryStatusBadgeVariant, inquiryStatusLabel } from '../../lib/inquiryStatus'
import { useLogisticsStore } from '../../store/useLogisticsStore'

function formatInquiryCreatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function AdminInquiryList() {
  const inquiries = useLogisticsStore((s) => s.inquiries)
  const quotes = useLogisticsStore((s) => s.quotes)

  return (
    <>
      {inquiries.length === 0 && (
        <SectionCard className="text-center text-sm text-slate-600">Belum ada permintaan.</SectionCard>
      )}

      <div className="flex flex-col gap-3">
        {inquiries.map((inq) => {
          const quoteCount = quotes.filter((q) => q.inquiryId === inq.id).length
          const totalVendors = inq.matchedVendorIds.length
          const pendingCustomer = quoteCount > 0 && inq.quotesReleasedToCustomer === false
          const customerLabel =
            inq.createdByName ||
            (inq.createdByUserId ? `User ${inq.createdByUserId.slice(0, 8)}` : 'Pelanggan')
          return (
          <Link key={inq.id} to={`/admin/inquiry/${inq.id}`}>
            <SectionCard className="text-left transition-transform active:scale-[0.99]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">
                  {inq.pickup} → {inq.destination}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {pendingCustomer && (
                    <Badge variant="neutral" className="text-[10px]">
                      Belum ke pelanggan
                    </Badge>
                  )}
                  <Badge variant={inquiryStatusBadgeVariant(inq.status)}>
                    {inquiryStatusLabel(inq.status)}
                  </Badge>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{inq.itemDescription}</p>
              <p className="mt-2 text-xs text-slate-600">
                Respons vendor: {quoteCount}/{totalVendors}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-700">Pelanggan: {customerLabel}</p>
              <p className="mt-2 text-xs text-slate-500">{formatInquiryCreatedAt(inq.createdAt)}</p>
            </SectionCard>
          </Link>
          )
        })}
      </div>
    </>
  )
}
