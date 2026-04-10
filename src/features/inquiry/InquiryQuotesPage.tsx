import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge } from '../../components/Badge'
import { StickyCTA } from '../../components/StickyCTA'
import { Button } from '../../components/ui/Button'
import { SectionCard } from '../../components/ui/SectionCard'
import { Select } from '../../components/ui/Select'
import { apiClient } from '../../lib/apiClient'
import { formatIDR, parseEtaDays } from '../../lib/format'
import { getVendorById } from '../../lib/matchVendors'
import { VEHICLE_TYPES } from '../../lib/inquiryServiceOptions'
import type { Inquiry, VehicleType, VendorQuote } from '../../types/models'

type SortKey = 'price' | 'eta' | 'rating'

export function InquiryQuotesPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [inquiry, setInquiry] = useState<Inquiry | null>(null)
  const [rawQuotes, setRawQuotes] = useState<VendorQuote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) {
      setInquiry(null)
      setRawQuotes([])
      setLoading(false)
      return
    }
    let mounted = true
    void (async () => {
      try {
        setLoading(true)
        const inqRes = (await apiClient.get(`/customer/inquiries/${id}`)) as { inquiry?: Inquiry }
        if (!mounted) return
        if (!inqRes.inquiry) {
          setInquiry(null)
          setRawQuotes([])
          return
        }
        setInquiry(inqRes.inquiry)
        const quotesReleased = inqRes.inquiry.quotesReleasedToCustomer !== false
        if (quotesReleased) {
          try {
            const qRes = (await apiClient.get(`/customer/inquiries/${id}/quotes`)) as { quotes?: VendorQuote[] }
            if (mounted && Array.isArray(qRes.quotes)) setRawQuotes(qRes.quotes)
          } catch {
            if (mounted) setRawQuotes([])
          }
        } else if (mounted) {
          setRawQuotes([])
        }
      } catch {
        if (mounted) {
          setInquiry(null)
          setRawQuotes([])
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [id])

  const [sort, setSort] = useState<SortKey>('price')
  const [insuranceOnly, setInsuranceOnly] = useState(false)
  const [vehicleFilter, setVehicleFilter] = useState<VehicleType | 'all'>('all')
  const [pickId, setPickId] = useState<string | null>(null)
  const [showConfirmPick, setShowConfirmPick] = useState(false)

  const releasedToCustomer = inquiry ? inquiry.quotesReleasedToCustomer !== false : false

  /** Pilihan eksplisit pengguna, atau penawaran yang sudah terpilih di penyimpanan. */
  const activePickId = pickId ?? inquiry?.selectedQuoteId ?? null

  const filtered = useMemo(() => {
    return rawQuotes.filter((q) => {
      if (insuranceOnly && !q.insuranceIncluded) return false
      if (vehicleFilter !== 'all' && (q.vehicleType || '') !== vehicleFilter) return false
      return true
    })
  }, [rawQuotes, insuranceOnly, vehicleFilter])

  const highlightSets = useMemo(() => {
    if (filtered.length === 0) {
      return {
        cheapest: new Set<string>(),
        fastest: new Set<string>(),
        topRated: new Set<string>(),
      }
    }
    const minP = Math.min(...filtered.map((q) => q.price))
    const cheapest = new Set(filtered.filter((q) => q.price === minP).map((q) => q.id))
    const minEta = Math.min(...filtered.map((q) => parseEtaDays(q.eta)))
    const fastest = new Set(filtered.filter((q) => parseEtaDays(q.eta) === minEta).map((q) => q.id))
    const maxR = Math.max(...filtered.map((q) => getVendorById(q.vendorId)?.customerRating ?? 0))
    const topRated =
      maxR > 0
        ? new Set(
            filtered
              .filter((q) => (getVendorById(q.vendorId)?.customerRating ?? 0) === maxR)
              .map((q) => q.id),
          )
        : new Set<string>()
    return { cheapest, fastest, topRated }
  }, [filtered])

  const sorted = useMemo(() => {
    const list = [...filtered]
    if (sort === 'price') {
      list.sort((a, b) => a.price - b.price)
    } else if (sort === 'eta') {
      list.sort((a, b) => parseEtaDays(a.eta) - parseEtaDays(b.eta))
    } else {
      list.sort(
        (a, b) =>
          (getVendorById(b.vendorId)?.customerRating ?? 0) -
          (getVendorById(a.vendorId)?.customerRating ?? 0),
      )
    }
    return list
  }, [filtered, sort])

  if (loading) {
    return <SectionCard className="text-sm text-slate-600">Memuat penawaran...</SectionCard>
  }

  if (!id || !inquiry) {
    return (
      <SectionCard>
        <Link to="/" className="text-accent">
          Beranda
        </Link>
      </SectionCard>
    )
  }

  const inquiryId = id

  if (rawQuotes.length > 0 && !releasedToCustomer) {
    return (
      <SectionCard className="text-left text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Penawaran belum tersedia</p>
          <p className="mt-2 text-slate-600">
            Admin masih meninjau respons vendor. Anda akan dapat membandingkan harga dan memilih penawaran setelah
            verifikasi selesai.
          </p>
      </SectionCard>
    )
  }

  const canPick = inquiry.status === 'quotes_ready' && releasedToCustomer

  async function onConfirmChoice() {
    if (!activePickId) return
    const q = rawQuotes.find((x) => x.id === activePickId)
    if (!q) return
    try {
      await apiClient.post(`/customer/inquiries/${inquiryId}/select-quote`, { quoteId: q.id })
      navigate(`/customer/inquiry/${inquiryId}/invoice`, { replace: false })
    } catch {
      /* handled by UI if needed */
    }
  }

  function insuranceLine(q: VendorQuote) {
    if (q.insuranceIncluded && q.insurancePremium != null && q.insurancePremium > 0) {
      return (
        <span>
          Disertakan — premi <span className="font-medium text-slate-800">{formatIDR(q.insurancePremium)}</span>
        </span>
      )
    }
    return <span>Tidak disertakan</span>
  }

  return (
    <>
      <Link to={`/customer/inquiry/${inquiry.id}`} className="text-sm font-medium text-accent">
        Detail
      </Link>
        <p className="text-left text-sm text-slate-600">
          {rawQuotes.length} penawaran untuk rute {inquiry.pickup} → {inquiry.destination}
        </p>

        <SectionCard title="Keterangan label pada kartu" className="text-left">
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">Termurah</Badge>
            <Badge variant="info">Tercepat</Badge>
            <Badge variant="neutral">Rating tertinggi</Badge>
          </div>
        </SectionCard>

        <div className="flex flex-col gap-3 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filter</p>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={insuranceOnly}
              onChange={(e) => setInsuranceOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
            />
            Hanya dengan asuransi
          </label>
          <label className="text-sm font-medium text-slate-700">
            Jenis kendaraan
            <Select
              className="mt-1"
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value as VehicleType | 'all')}
            >
              <option value="all">Semua</option>
              {VEHICLE_TYPES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Urutkan</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['price', 'Harga'],
                ['eta', 'Durasi (ETA)'],
                ['rating', 'Rating'],
              ] as const
            ).map(([key, label]) => (
              <Button key={key} type="button" size="sm" variant={sort === key ? 'primary' : 'ghost'} onClick={() => setSort(key)}>
                {label}
              </Button>
            ))}
          </div>
        </div>

        {rawQuotes.length === 0 && (
          <SectionCard className="text-center text-sm text-slate-600">Belum ada penawaran. Cek lagi nanti.</SectionCard>
        )}

        {rawQuotes.length > 0 && sorted.length === 0 && (
          <SectionCard className="text-center text-sm text-slate-600">
            Tidak ada penawaran yang cocok dengan filter. Ubah filter untuk melihat opsi lain.
          </SectionCard>
        )}

        <div className="flex flex-col gap-4">
          {(inquiry.selectedQuoteId
            ? sorted.filter((q) => q.id === inquiry.selectedQuoteId)
            : sorted
          ).map((q) => {
            const vendor = getVendorById(q.vendorId)
            const name = vendor?.name ?? 'Vendor'
            const rating = vendor?.customerRating ?? 0
            const selected = inquiry.selectedQuoteId === q.id
            const isCheapest = highlightSets.cheapest.has(q.id)
            const isFastest = highlightSets.fastest.has(q.id)
            const isTopRated = highlightSets.topRated.has(q.id)

            return (
              <SectionCard
                key={q.id}
                className={`text-left transition-shadow ${activePickId === q.id && canPick ? 'ring-2 ring-accent' : ''}`}
              >
                <div className="flex gap-3">
                  {canPick && (
                    <input
                      type="radio"
                      name="quote-pick"
                      checked={activePickId === q.id}
                      onChange={() => setPickId(q.id)}
                      className="mt-1 h-5 w-5 shrink-0 border-slate-300 text-accent focus:ring-accent"
                      aria-label={`Pilih ${name}`}
                    />
                  )}
                  <button
                    type="button"
                    disabled={!canPick}
                    onClick={() => canPick && setPickId(q.id)}
                    className="min-w-0 flex-1 text-left disabled:cursor-default"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-slate-500">1. Nama vendor</p>
                        <p className="font-semibold text-slate-900">{name}</p>
                        {q.source === 'admin_manual' && (
                          <Badge variant="info" className="mt-1">
                            Input admin
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {isCheapest && (
                          <Badge variant="success">Termurah</Badge>
                        )}
                        {isFastest && <Badge variant="info">Tercepat</Badge>}
                        {isTopRated && (
                          <Badge variant="neutral">Rating tertinggi</Badge>
                        )}
                        {selected && <Badge variant="success">Dipilih</Badge>}
                      </div>
                    </div>
                  </button>
                </div>

                <dl className="mt-3 space-y-2 text-sm text-slate-700">
                  <div className="flex justify-between gap-3 border-t border-slate-100 pt-3">
                    <dt className="text-slate-500">2. Harga</dt>
                    <dd className="text-right text-lg font-bold text-accent">{formatIDR(q.price)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">3. Durasi</dt>
                    <dd className="text-right font-medium text-slate-900">{q.eta || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">4. Tanggal jemput</dt>
                    <dd className="text-right font-medium text-slate-900">{q.pickupDate || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">5. Jenis kendaraan</dt>
                    <dd className="text-right font-medium text-slate-900">{q.vehicleType || '—'}</dd>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3">
                    <dt className="text-slate-500">6. Asuransi</dt>
                    <dd className="sm:text-right">{insuranceLine(q)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">7. Rating pelanggan</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {rating > 0 ? `${rating.toFixed(1)} / 5` : '—'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="text-xs font-medium text-slate-500">8. Tindakan</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {canPick
                      ? 'Pilih kartu ini dengan radio, lalu ketuk «Konfirmasi pilihan penawaran» di bawah.'
                      : 'Pemilihan ditutup untuk permintaan ini.'}
                  </p>
                </div>

                {q.notes.trim() && (
                  <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{q.notes}</p>
                )}
              </SectionCard>
            )
          })}
        </div>

        {!canPick && inquiry.status !== 'quotes_ready' && rawQuotes.length > 0 && (
          <p className="text-center text-sm text-slate-600">
            Anda sudah memilih penawaran atau permintaan sudah melanjutkan ke tahap berikutnya.
          </p>
        )}
      {canPick && sorted.length > 0 && (
        <StickyCTA aboveBottomNav>
          <Button
            type="button"
            disabled={!activePickId}
            onClick={() => setShowConfirmPick(true)}
            variant="neutralDark"
            size="lg"
            fullWidth
          >
            Konfirmasi pilihan penawaran
          </Button>
        </StickyCTA>
      )}
      {showConfirmPick && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 px-4">
          <SectionCard className="w-full max-w-md text-left">
            <p className="font-semibold text-slate-900">Konfirmasi pilihan vendor</p>
            <p className="mt-2 text-sm text-slate-600">
              Setelah dipilih, penawaran lain akan disembunyikan dari tampilan utama.
            </p>
            <div className="mt-4 flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowConfirmPick(false)}>
                Batal
              </Button>
              <Button type="button" className="flex-1" onClick={() => void onConfirmChoice()}>
                Ya, pilih
              </Button>
            </div>
          </SectionCard>
        </div>
      )}
    </>
  )
}
