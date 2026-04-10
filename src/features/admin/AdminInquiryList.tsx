import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../components/Badge'
import { SectionCard } from '../../components/ui/SectionCard'
import { Spinner } from '../../components/ui/Spinner'
import { apiClient } from '../../lib/apiClient'
import { inquiryStatusBadgeVariant, inquiryStatusLabel } from '../../lib/inquiryStatus'
import type { Inquiry } from '../../types/models'

type AdminInquiryListItem = Inquiry & { customerName: string; quoteCount: number }

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
  const [inquiries, setInquiries] = useState<AdminInquiryListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        setLoading(true)
        setError('')
        const res = (await apiClient.get('/admin/inquiries')) as { inquiries?: AdminInquiryListItem[] }
        if (!mounted) return
        setInquiries(Array.isArray(res.inquiries) ? res.inquiries : [])
      } catch {
        if (mounted) {
          setError('Gagal memuat permintaan. Periksa login admin dan koneksi ke server.')
          setInquiries([])
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3 text-slate-600">
        <Spinner className="h-7 w-7" />
        <p className="text-sm">Memuat permintaan...</p>
      </div>
    )
  }

  if (error) {
    return <SectionCard className="text-center text-sm text-red-800">{error}</SectionCard>
  }

  return (
    <>
      {inquiries.length === 0 && (
        <SectionCard className="text-center text-sm text-slate-600">Belum ada permintaan.</SectionCard>
      )}

      <div className="flex flex-col gap-3">
        {inquiries.map((inq) => {
          const quoteCount = inq.quoteCount
          const pendingCustomer = quoteCount > 0 && inq.quotesReleasedToCustomer === false
          const customerLabel = inq.customerName?.trim() || 'Pelanggan'
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
                <p className="mt-2 text-xs font-medium text-slate-700">Pelanggan: {customerLabel}</p>
                <p className="mt-2 text-xs text-slate-600">Vendor yang merespon: {quoteCount}</p>
                <p className="mt-2 text-xs text-slate-500">{formatInquiryCreatedAt(inq.createdAt)}</p>
              </SectionCard>
            </Link>
          )
        })}
      </div>
    </>
  )
}
