import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../../components/Badge'
import { InquiryRequestSummary } from '../../components/InquiryRequestSummary'
import { Button } from '../../components/ui/Button'
import { SectionCard } from '../../components/ui/SectionCard'
import { apiClient } from '../../lib/apiClient'
import { inquiryStatusBadgeVariant, inquiryStatusLabel } from '../../lib/inquiryStatus'
import type { Inquiry, VendorQuote } from '../../types/models'

export function InquiryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [inquiry, setInquiry] = useState<Inquiry | null>(null)
  const [quotes, setQuotes] = useState<VendorQuote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) {
      setInquiry(null)
      setLoading(false)
      return
    }
    let mounted = true
    void (async () => {
      try {
        setLoading(true)
        const inqRes = (await apiClient.get(`/customer/inquiries/${id}`)) as {
          inquiry?: Inquiry
        }
        if (!mounted) return
        if (!inqRes.inquiry) {
          setInquiry(null)
          setQuotes([])
          return
        }
        setInquiry(inqRes.inquiry)
        const quotesReleased = inqRes.inquiry.quotesReleasedToCustomer !== false
        if (quotesReleased) {
          try {
            const qRes = (await apiClient.get(`/customer/inquiries/${id}/quotes`)) as { quotes?: VendorQuote[] }
            if (mounted && Array.isArray(qRes.quotes)) setQuotes(qRes.quotes)
          } catch {
            if (mounted) setQuotes([])
          }
        } else if (mounted) {
          setQuotes([])
        }
      } catch {
        if (mounted) {
          setInquiry(null)
          setQuotes([])
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [id])

  if (loading) {
    return (
      <SectionCard className="text-left text-sm text-slate-600">Memuat detail permintaan...</SectionCard>
    )
  }

  if (!id || !inquiry) {
    return (
      <SectionCard className="text-left">
        <p className="text-slate-600">Permintaan tidak ada atau ID salah.</p>
        <Link to="/customer/inquiry/new" className="font-semibold text-accent">
          Buat permintaan baru
        </Link>
      </SectionCard>
    )
  }

  const hasQuotes = quotes.length > 0
  /** Data lama tanpa flag dianggap sudah dirilis; permintaan baru pakai `false` sampai admin melepas. */
  const quotesReleasedToCustomer = inquiry.quotesReleasedToCustomer !== false
  const canViewQuotes =
    hasQuotes &&
    quotesReleasedToCustomer &&
    (inquiry.status === 'awaiting_quotes' ||
      inquiry.status === 'quotes_ready' ||
      inquiry.status === 'vendor_selected' ||
      inquiry.status === 'awaiting_payment' ||
      inquiry.status === 'paid' ||
      inquiry.status === 'completed')

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={inquiryStatusBadgeVariant(inquiry.status)}>
          {inquiryStatusLabel(inquiry.status)}
        </Badge>
        <span className="text-xs text-slate-400">
          {new Date(inquiry.createdAt).toLocaleString('id-ID')}
        </span>
      </div>

      <SectionCard className="text-left">
        <InquiryRequestSummary inquiry={inquiry} />
      </SectionCard>

      {inquiry.status === 'awaiting_quotes' && !hasQuotes && (
        <SectionCard className="border-amber-100 bg-amber-50/50 text-left text-sm text-amber-950">
          Vendor sedang menerima tautan penawaran. Refresh halaman ini setelah mereka mengirim harga.
        </SectionCard>
      )}

      {hasQuotes && inquiry.quotesReleasedToCustomer === false && (
        <SectionCard className="border-slate-200 bg-slate-50 text-left text-sm text-slate-800">
          <p className="font-semibold text-slate-900">Penawaran sedang ditinjau</p>
          <p className="mt-1 text-slate-600">
            Admin sedang memverifikasi daftar penawaran vendor. Setelah selesai, Anda akan dapat melihat dan memilih
            penawaran di halaman ini.
          </p>
        </SectionCard>
      )}

      {canViewQuotes && (
        <Link
          to={`/customer/inquiry/${inquiry.id}/quotes`}
          className="block"
        >
          <Button fullWidth>Lihat penawaran</Button>
        </Link>
      )}

      {(inquiry.status === 'vendor_selected' ||
        inquiry.status === 'awaiting_payment' ||
        inquiry.status === 'paid') && (
        <Link
          to={`/customer/inquiry/${inquiry.id}/invoice`}
          className="block"
        >
          <Button variant="secondary" fullWidth>
            Lihat tagihan
          </Button>
        </Link>
      )}

      {(inquiry.status === 'awaiting_payment' || inquiry.status === 'vendor_selected') && (
        <Link
          to={`/customer/inquiry/${inquiry.id}/payment`}
          className="block"
        >
          <Button variant="secondary" fullWidth>
            Unggah bukti bayar
          </Button>
        </Link>
      )}

      {inquiry.status === 'paid' && inquiry.payment?.vendorNotified && (
        <SectionCard className="border-emerald-100 bg-emerald-50/60 text-left text-sm text-emerald-900">
          <p className="font-semibold">Vendor telah diberi tahu (simulasi).</p>
          <p className="mt-1 text-emerald-800">Pembayaran tercatat. Terima kasih.</p>
        </SectionCard>
      )}
    </>
  )
}
