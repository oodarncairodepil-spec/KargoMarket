import { SectionCard } from '../../components/ui/SectionCard'
import { useLogisticsStore } from '../../store/useLogisticsStore'
import { inquiryStatusLabel } from '../../lib/inquiryStatus'

export function AdminDashboardPage() {
  const inquiries = useLogisticsStore((s) => s.inquiries)
  const quotes = useLogisticsStore((s) => s.quotes)
  const vendors = useLogisticsStore((s) => s.vendorRegistrations)

  const total = inquiries.length
  const quotesReady = inquiries.filter((i) => i.status === 'quotes_ready').length
  const awaitingQuotes = inquiries.filter((i) => i.status === 'awaiting_quotes').length
  const paid = inquiries.filter((i) => i.status === 'paid').length

  const statusData = [
    { key: 'awaiting_quotes', count: inquiries.filter((i) => i.status === 'awaiting_quotes').length },
    { key: 'quotes_ready', count: inquiries.filter((i) => i.status === 'quotes_ready').length },
    { key: 'vendor_selected', count: inquiries.filter((i) => i.status === 'vendor_selected').length },
    { key: 'awaiting_payment', count: inquiries.filter((i) => i.status === 'awaiting_payment').length },
    { key: 'paid', count: inquiries.filter((i) => i.status === 'paid').length },
  ] as const
  const maxStatus = Math.max(1, ...statusData.map((s) => s.count))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <SectionCard className="text-left">
            <p className="text-xs text-slate-500">Total Inquiry</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{total}</p>
          </SectionCard>
          <SectionCard className="text-left">
            <p className="text-xs text-slate-500">Vendor Terdaftar</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{vendors.length}</p>
          </SectionCard>
          <SectionCard className="text-left">
            <p className="text-xs text-slate-500">Quotes Ready</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{quotesReady}</p>
          </SectionCard>
          <SectionCard className="text-left">
            <p className="text-xs text-slate-500">Pembayaran Lunas</p>
            <p className="mt-1 text-2xl font-bold text-blue-700">{paid}</p>
          </SectionCard>
      </div>

        <SectionCard className="text-left" title="Status Inquiry (Grafik)">
          <p className="text-sm font-semibold text-slate-900">Status Inquiry (Grafik)</p>
          <div className="mt-3 space-y-2">
            {statusData.map((s) => (
              <div key={s.key}>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                  <span>{inquiryStatusLabel(s.key)}</span>
                  <span>{s.count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{ width: `${Math.max(4, (s.count / maxStatus) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard className="text-left" title="Ringkasan Aktivitas">
          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <p>Menunggu penawaran: {awaitingQuotes}</p>
            <p>Total penawaran masuk: {quotes.length}</p>
            <p>Rasio inquiry dengan penawaran: {total ? Math.round((quotesReady / total) * 100) : 0}%</p>
          </div>
        </SectionCard>
    </div>
  )
}
