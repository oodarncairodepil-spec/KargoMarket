import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../components/Badge'
import { SectionCard } from '../../components/ui/SectionCard'
import { Spinner } from '../../components/ui/Spinner'
import { apiClient } from '../../lib/apiClient'
import { inquiryStatusLabel } from '../../lib/inquiryStatus'
import type { InquiryStatus } from '../../types/models'

/** Payload ringkas dari GET /admin/inquiries (tanpa alamat/gambar berat). */
type AdminInquiryListItem = {
  id: string
  displayNo?: string
  pickup: string
  destination: string
  itemDescription: string
  itemImageUrls?: string[]
  status: InquiryStatus
  quotesReleasedToCustomer: boolean
  createdAt: string
  customerName: string
  quoteCount: number
  matchedVendorCount?: number
}

type InquiriesPageResponse = {
  inquiries?: AdminInquiryListItem[]
  hasMore?: boolean
  nextOffset?: number
}

const PAGE_SIZE = 10
const QUOTE_DEADLINE_HOURS = 24

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

function quoteDeadlineLabel(createdAtIso: string): string {
  const created = new Date(createdAtIso)
  if (Number.isNaN(created.getTime())) return 'Batas penawaran tidak diketahui'
  const deadlineMs = created.getTime() + QUOTE_DEADLINE_HOURS * 60 * 60 * 1000
  const diffMs = deadlineMs - Date.now()
  if (diffMs <= 0) return 'Batas penawaran berakhir'
  const hoursLeft = Math.ceil(diffMs / (60 * 60 * 1000))
  return `Sisa waktu penawaran: ${hoursLeft} jam`
}

export function AdminInquiryList() {
  const [inquiries, setInquiries] = useState<AdminInquiryListItem[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState(0)
  const [error, setError] = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)

  const loadPage = useCallback(async (offset: number, append: boolean) => {
    if (append) {
      if (loadingMoreRef.current) return
      loadingMoreRef.current = true
      setLoadingMore(true)
    } else {
      setLoading(true)
      setError('')
    }
    try {
      const res = (await apiClient.get(
        `/admin/inquiries?limit=${PAGE_SIZE}&offset=${offset}&q=${encodeURIComponent(searchQuery)}`,
      )) as InquiriesPageResponse
      const list = Array.isArray(res.inquiries) ? res.inquiries : []
      if (append) {
        setInquiries((p) => [...p, ...list])
      } else {
        setInquiries(list)
      }
      setHasMore(Boolean(res.hasMore))
      setNextOffset(typeof res.nextOffset === 'number' ? res.nextOffset : offset + list.length)
    } catch {
      if (!append) {
        setError('Gagal memuat permintaan. Periksa login admin dan koneksi ke server.')
        setInquiries([])
      }
      setHasMore(false)
    } finally {
      setLoading(false)
      setLoadingMore(false)
      loadingMoreRef.current = false
    }
  }, [searchQuery])

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    void loadPage(0, false)
  }, [loadPage])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const ob = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          hasMore &&
          !loading &&
          !loadingMoreRef.current &&
          nextOffset > 0
        ) {
          void loadPage(nextOffset, true)
        }
      },
      { root: null, rootMargin: '240px', threshold: 0 },
    )
    ob.observe(el)
    return () => ob.disconnect()
  }, [hasMore, loading, nextOffset, loadPage])

  if (loading && inquiries.length === 0) {
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
      {!loading && inquiries.length > 0 && (
        <p className="mb-3 text-sm font-medium text-slate-700">
          Menampilkan {inquiries.length} permintaan
          {hasMore ? ' · Gulir ke bawah untuk memuat lebih banyak' : ''}
        </p>
      )}
      <div className="mb-3">
        <label className="block text-xs font-medium text-slate-600">Cari inquiry</label>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Cari berdasarkan ID atau nama pelanggan…"
          className="mt-1 w-full min-h-12 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent"
          autoComplete="off"
        />
      </div>

      {inquiries.length === 0 && (
        <SectionCard className="text-center text-sm text-slate-600">Belum ada permintaan.</SectionCard>
      )}

      <div className="flex flex-col gap-3">
        {inquiries.map((inq) => {
          const quoteCount = inq.quoteCount
          const customerLabel = inq.customerName?.trim() || 'Pelanggan'
          const thumb = inq.itemImageUrls?.find(
            (u) =>
              typeof u === 'string' &&
              (u.startsWith('data:image/') || /^https?:\/\//i.test(u)),
          )
          return (
            <Link key={inq.id} to={`/admin/inquiry/${inq.id}`}>
              <SectionCard className="text-left transition-transform active:scale-[0.99]">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  No. permintaan:{' '}
                  <span className="font-mono normal-case text-slate-700">{inq.displayNo || inq.id}</span>
                </p>
                <div className="mt-2 flex gap-3">
                  {thumb ? (
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">
                        {inq.pickup} → {inq.destination}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={quoteCount > 0 ? 'success' : 'pending'}>
                          {quoteCount > 0 ? `Respon vendor: ${quoteCount}` : inquiryStatusLabel(inq.status)}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{inq.itemDescription}</p>
                    <p className="mt-2 text-xs font-medium text-slate-700">Pelanggan: {customerLabel}</p>
                    <p className="mt-1 text-xs text-slate-600">{quoteDeadlineLabel(inq.createdAt)}</p>
                    <p className="mt-2 text-xs text-slate-500">{formatInquiryCreatedAt(inq.createdAt)}</p>
                  </div>
                </div>
              </SectionCard>
            </Link>
          )
        })}
      </div>

      <div ref={sentinelRef} className="h-4 w-full shrink-0" aria-hidden />
      {loadingMore && (
        <div className="flex justify-center py-4 text-slate-600">
          <Spinner className="h-6 w-6" />
        </div>
      )}
    </>
  )
}
