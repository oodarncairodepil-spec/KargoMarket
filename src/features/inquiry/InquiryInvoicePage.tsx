import { Link, useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { InquiryRequestSummary } from '../../components/InquiryRequestSummary'
import { PageShell } from '../../components/PageShell'
import { StickyCTA } from '../../components/StickyCTA'
import { useInquiryData } from '../../hooks/useInquiryData'
import { formatIDR } from '../../lib/format'
import { getVendorById } from '../../lib/matchVendors'
import { useLogisticsStore } from '../../store/useLogisticsStore'

export function InquiryInvoicePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { inquiry, quotes } = useInquiryData(id)
  const setAwaitingPayment = useLogisticsStore((s) => s.setAwaitingPayment)

  if (!id || !inquiry) {
    return (
      <PageShell title="Tidak ditemukan">
        <Link to="/" className="text-accent">
          Beranda
        </Link>
      </PageShell>
    )
  }

  const inquiryId = id

  const quote = quotes.find((q) => q.id === inquiry.selectedQuoteId)
  const vendor = quote ? getVendorById(quote.vendorId) : undefined

  if (!quote) {
    return (
      <PageShell title="Tagihan">
        <p className="text-slate-600">Belum ada vendor yang dipilih.</p>
        <Link
          to={`/customer/inquiry/${inquiry.id}/quotes`}
          className="mt-4 inline-block font-semibold text-accent"
        >
          Pilih penawaran
        </Link>
      </PageShell>
    )
  }

  function goPay() {
    setAwaitingPayment(inquiryId)
    navigate(`/customer/inquiry/${inquiryId}/payment`)
  }

  const paid = inquiry.status === 'paid' || inquiry.status === 'completed'

  return (
    <>
      <PageShell
        title="Tagihan (simulasi)"
        headerRight={
          <Link to={`/customer/inquiry/${inquiry.id}`} className="text-sm font-medium text-accent">
            Ringkasan
          </Link>
        }
      >
        <Card className="text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Vendor</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{vendor?.name ?? 'Vendor'}</p>
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">Total</p>
          <p className="mt-1 text-3xl font-bold text-accent">{formatIDR(quote.price)}</p>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <InquiryRequestSummary inquiry={inquiry} showImages={false} />
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
              <p>
                <span className="font-medium text-slate-800">ETA (dari vendor):</span> {quote.eta}
              </p>
              <p>
                <span className="font-medium text-slate-800">Tanggal jemput (dari vendor):</span> {quote.pickupDate}
              </p>
              {quote.vehicleType ? (
                <p>
                  <span className="font-medium text-slate-800">Kendaraan:</span> {quote.vehicleType}
                </p>
              ) : null}
              <p>
                <span className="font-medium text-slate-800">Asuransi:</span>{' '}
                {quote.insuranceIncluded && quote.insurancePremium != null && quote.insurancePremium > 0
                  ? `Disertakan (${formatIDR(quote.insurancePremium)})`
                  : 'Tidak disertakan'}
              </p>
            </div>
          </div>
        </Card>

        {paid && (
          <Card className="border-emerald-100 bg-emerald-50/50 text-sm text-emerald-900">
            Status pembayaran: Lunas (simulasi).
          </Card>
        )}
      </PageShell>

      {!paid && (
        <StickyCTA>
          <button
            type="button"
            onClick={goPay}
            className="w-full min-h-12 rounded-xl bg-accent text-base font-semibold text-white shadow-md"
          >
            Lanjut bayar
          </button>
        </StickyCTA>
      )}
    </>
  )
}
