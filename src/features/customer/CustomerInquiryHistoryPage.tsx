import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../components/Badge'
import { SectionCard } from '../../components/ui/SectionCard'
import { Button } from '../../components/ui/Button'
import { apiClient } from '../../lib/apiClient'
import { inquiryStatusBadgeVariant, inquiryStatusLabel } from '../../lib/inquiryStatus'
import type { Inquiry } from '../../types/models'

export function CustomerInquiryHistoryPage() {
  const [items, setItems] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        setLoading(true)
        const res = await apiClient.get('/customer/inquiries')
        const inquiries =
          res &&
          typeof res === 'object' &&
          'inquiries' in res &&
          Array.isArray((res as { inquiries?: Inquiry[] }).inquiries)
            ? (res as { inquiries: Inquiry[] }).inquiries
            : []
        if (mounted) setItems(inquiries)
      } catch {
        if (mounted) setItems([])
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <>
      <Link to="/customer/inquiry/new">
        <Button fullWidth>+ Tambah permintaan baru</Button>
      </Link>

      {loading ? (
        <SectionCard className="text-center text-sm text-slate-600">Memuat permintaan...</SectionCard>
      ) : items.length === 0 ? (
        <SectionCard className="text-center text-sm text-slate-600">Belum ada permintaan.</SectionCard>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((inq) => (
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
