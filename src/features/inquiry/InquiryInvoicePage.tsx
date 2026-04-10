import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { InquiryRequestSummary } from '../../components/InquiryRequestSummary'
import { PageShell } from '../../components/PageShell'
import { StickyCTA } from '../../components/StickyCTA'
import { apiClient } from '../../lib/apiClient'
import { formatIDR } from '../../lib/format'
import { getVendorById } from '../../lib/matchVendors'
import type { Inquiry, VendorQuote } from '../../types/models'

type InquiryDetailPayload = {
  inquiry?: Inquiry
  selectedQuote?: VendorQuote
}

export function InquiryInvoicePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [inquiry, setInquiry] = useState<Inquiry | null>(null)
  const [selectedQuote, setSelectedQuote] = useState<VendorQuote | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [beginError, setBeginError] = useState('')

  useEffect(() => {
    if (!id) {
      setInquiry(null)
      setSelectedQuote(undefined)
      setLoading(false)
      return
    }
    let mounted = true
    void (async () => {
      try {
        setLoading(true)
        const res = (await apiClient.get(`/customer/inquiries/${id}`)) as InquiryDetailPayload
        if (!mounted) return
        if (!res.inquiry) {
          setInquiry(null)
          setSelectedQuote(undefined)
          return
        }
        setInquiry(res.inquiry)
        setSelectedQuote(res.selectedQuote)
      } catch {
        if (mounted) {
          setInquiry(null)
          setSelectedQuote(undefined)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [id])

  if (!id) {
    return (
      <PageShell title="Tidak ditemukan">
        <Link to="/" className="text-accent">
          Beranda
        </Link>
      </PageShell>
    )
  }

  if (loading) {
    return (
      <PageShell title="Tagihan">
        <p className="text-left text-sm text-slate-600">Memuat tagihan...</p>
      </PageShell>
    )
  }

  if (!inquiry) {
    return (
      <PageShell title="Tidak ditemukan">
        <Link to="/" className="text-accent">
          Beranda
        </Link>
      </PageShell>
    )
  }

  const inquiryId = id
  const quote = selectedQuote

  const vendorName =
    quote?.vendor?.name ?? (quote ? getVendorById(quote.vendorId)?.name : undefined) ?? 'Vendor'

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

  async function goPay() {
    setBeginError('')
    try {
      await apiClient.post(`/customer/inquiries/${inquiryId}/begin-payment`, {})
      navigate(`/customer/inquiry/${inquiryId}/payment`)
    } catch {
      setBeginError('Tidak bisa melanjutkan ke pembayaran. Coba lagi atau refresh halaman.')
    }
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
        {beginError ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-100">{beginError}</p>
        ) : null}
        <Card className="text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Vendor</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{vendorName}</p>
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
        <StickyCTA aboveBottomNav>
          <button
            type="button"
            onClick={() => void goPay()}
            className="w-full min-h-12 rounded-xl bg-accent text-base font-semibold text-white shadow-md"
          >
            Lanjut bayar
          </button>
        </StickyCTA>
      )}
    </>
  )
}
