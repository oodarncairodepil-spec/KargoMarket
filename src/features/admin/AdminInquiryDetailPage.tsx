import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../../components/Badge'
import { InquiryRequestSummary } from '../../components/InquiryRequestSummary'
import { Button } from '../../components/ui/Button'
import { SectionCard } from '../../components/ui/SectionCard'
import { ui } from '../../lib/uiTokens'
import { formatIDR } from '../../lib/format'
import {
  formatIdrThousandsFromDigits,
  sanitizeIdrDigits,
} from '../../lib/inquiryFormHelpers'
import { inquiryStatusBadgeVariant, inquiryStatusLabel } from '../../lib/inquiryStatus'
import { VEHICLE_TYPES } from '../../lib/inquiryServiceOptions'
import { getVendorById } from '../../lib/matchVendors'
import { useInquiryData } from '../../hooks/useInquiryData'
import { getTokensForInquiry, useLogisticsStore } from '../../store/useLogisticsStore'
import type { VehicleType } from '../../types/models'

const inputClass = `mt-1 ${ui.form.input.compact}`

export function AdminInquiryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { inquiry, quotes } = useInquiryData(id)
  const tokenIndex = useLogisticsStore((s) => s.tokenIndex)
  const getVendorQuoteLink = useLogisticsStore((s) => s.getVendorQuoteLink)
  const adminAddManualQuote = useLogisticsStore((s) => s.adminAddManualQuote)
  const releaseQuotesToCustomer = useLogisticsStore((s) => s.releaseQuotesToCustomer)

  const [expandedVendor, setExpandedVendor] = useState<string | null>(null)
  const [manualPrice, setManualPrice] = useState('')
  const [manualEta, setManualEta] = useState('')
  const [manualDate, setManualDate] = useState('')
  const [manualVehicleType, setManualVehicleType] = useState<VehicleType | ''>('')
  const [manualInsuranceIncluded, setManualInsuranceIncluded] = useState(false)
  const [manualInsurancePremiumDigits, setManualInsurancePremiumDigits] = useState('')
  const [manualNotes, setManualNotes] = useState('')
  const [toast, setToast] = useState('')

  const tokensByVendor = useMemo(() => {
    if (!id) return new Map<string, string>()
    const map = new Map<string, string>()
    for (const { token, vendorId } of getTokensForInquiry(tokenIndex, id)) {
      map.set(vendorId, token)
    }
    return map
  }, [id, tokenIndex])

  if (!id || !inquiry) {
    return (
      <SectionCard>
        <Link to="/admin" className="text-accent">
          Kembali ke admin
        </Link>
      </SectionCard>
    )
  }

  const inquiryId = id

  function openManual(vendorId: string) {
    setExpandedVendor((v) => (v === vendorId ? null : vendorId))
    const existing = quotes.find((q) => q.vendorId === vendorId)
    if (existing) {
      setManualPrice(String(existing.price))
      setManualEta(existing.eta)
      setManualDate(existing.pickupDate === '—' ? '' : existing.pickupDate)
      setManualVehicleType((existing.vehicleType as VehicleType | '') || '')
      setManualInsuranceIncluded(Boolean(existing.insuranceIncluded))
      setManualInsurancePremiumDigits(
        existing.insurancePremium != null ? String(existing.insurancePremium) : '',
      )
      setManualNotes(existing.notes)
    } else {
      setManualPrice('')
      setManualEta('')
      setManualDate('')
      setManualVehicleType('')
      setManualInsuranceIncluded(false)
      setManualInsurancePremiumDigits('')
      setManualNotes('')
    }
  }

  function submitManual(vendorId: string) {
    const p = Number(manualPrice.replace(/\./g, '').replace(/,/g, '.'))
    if (!manualPrice.trim() || Number.isNaN(p) || p <= 0) {
      setToast('Harga tidak valid.')
      return
    }
    if (!manualVehicleType) {
      setToast('Jenis kendaraan wajib dipilih.')
      return
    }
    const prem = parseInt(manualInsurancePremiumDigits.replace(/\D/g, ''), 10)
    if (manualInsuranceIncluded && (Number.isNaN(prem) || prem < 1)) {
      setToast('Premi asuransi wajib jika asuransi disertakan.')
      return
    }
    const res = adminAddManualQuote(inquiryId, vendorId, {
      price: Math.round(p),
      eta: manualEta.trim() || '—',
      pickupDate: manualDate.trim() || '—',
      notes: manualNotes.trim(),
      vehicleType: manualVehicleType,
      insuranceIncluded: manualInsuranceIncluded,
      insurancePremium: manualInsuranceIncluded ? prem : 0,
    })
    if (!res.ok) {
      setToast('Gagal menyimpan (vendor tidak cocok).')
      return
    }
    setToast(res.updated ? 'Kutasi diperbarui.' : 'Kutasi disimpan.')
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <div className="flex flex-col gap-4">
      {toast && (
        <p className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white shadow-md">{toast}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={inquiryStatusBadgeVariant(inquiry.status)}>
          {inquiryStatusLabel(inquiry.status)}
        </Badge>
      </div>

      <SectionCard className="text-left">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pelanggan</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{inquiry.createdByName || 'Pelanggan'}</p>
        <div className="mt-3 border-t border-slate-100 pt-3">
        <InquiryRequestSummary inquiry={inquiry} />
        </div>
      </SectionCard>

      {quotes.length > 0 && inquiry.quotesReleasedToCustomer === false && (
        <SectionCard className="border-amber-200 bg-amber-50/70 text-left text-sm text-amber-950">
          <p className="font-semibold">Penawaran belum ditampilkan ke pelanggan.</p>
          <p className="mt-1 text-amber-900/90">
            Setelah Anda selesai meninjau respons vendor, tampilkan daftar penawaran agar pelanggan dapat memilih.
          </p>
          <Button
            type="button"
            onClick={() => {
              releaseQuotesToCustomer(inquiryId)
              setToast('Penawaran sekarang terlihat oleh pelanggan.')
              setTimeout(() => setToast(''), 3000)
            }}
            className="mt-4 w-full bg-amber-800 text-white"
          >
            Tampilkan penawaran ke pelanggan
          </Button>
        </SectionCard>
      )}

      {quotes.length > 0 && inquiry.quotesReleasedToCustomer === true && (
        <p className="text-left text-xs font-medium text-emerald-800">
          Penawaran sudah ditampilkan ke pelanggan — mereka dapat membuka halaman &quot;Lihat penawaran&quot;.
        </p>
      )}

      <h2 className="text-left text-sm font-semibold uppercase tracking-wide text-slate-500">
        Vendor & penawaran
      </h2>

      <div className="flex flex-col gap-3">
        {inquiry.matchedVendorIds.map((vid) => {
          const vendor = getVendorById(vid)
          const name = vendor?.name ?? vid
          const token = tokensByVendor.get(vid)
          const quote = quotes.find((q) => q.vendorId === vid)

          return (
            <SectionCard key={vid} className="text-left">
              <button
                type="button"
                onClick={() => openManual(vid)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Harga: {quote ? formatIDR(quote.price) : '—'} • ETA: {quote?.eta || '—'} • Jemput:{' '}
                    {quote?.pickupDate || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {expandedVendor === vid ? <span className="text-xs text-accent">Tutup</span> : null}
                </div>
              </button>

              {quote && (
                <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-bold text-accent">{formatIDR(quote.price)}</p>
                  <p className="mt-1">ETA: {quote.eta}</p>
                  <p>Jemput: {quote.pickupDate}</p>
                  {quote.vehicleType ? <p>Kendaraan: {quote.vehicleType}</p> : null}
                  <p>
                    Asuransi:{' '}
                    {quote.insuranceIncluded && quote.insurancePremium
                      ? `Disertakan (${formatIDR(quote.insurancePremium)})`
                      : 'Tidak disertakan'}
                  </p>
                  {quote.notes && <p className="mt-2 text-slate-600">{quote.notes}</p>}
                </div>
              )}

              {token && (
                <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 p-2">
                  <p className="truncate text-xs text-slate-500">{getVendorQuoteLink(token)}</p>
                  <button
                    type="button"
                    aria-label="Buka tautan vendor di tab baru"
                    className="rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-accent"
                    onClick={() => window.open(getVendorQuoteLink(token), '_blank', 'noopener,noreferrer')}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                      <path
                        d="M14 5h5v5M10 14 19 5M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              )}

              {expandedVendor === vid && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-500">Input manual (fallback WA)</p>
                  <div className="mt-2 flex flex-col gap-2">
                    <label className="text-xs font-medium text-slate-600">
                      Harga (IDR)
                      <input
                        className={inputClass}
                        value={manualPrice}
                        onChange={(e) => setManualPrice(e.target.value)}
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-600">
                      Estimasi tiba (ETA, opsional)
                      <input className={inputClass} value={manualEta} onChange={(e) => setManualEta(e.target.value)} />
                    </label>
                    <label className="text-xs font-medium text-slate-600">
                      Tanggal jemput
                      <input
                        className={inputClass}
                        type="date"
                        value={manualDate}
                        onChange={(e) => setManualDate(e.target.value)}
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-600">
                      Jenis kendaraan
                      <select
                        className={inputClass}
                        value={manualVehicleType}
                        onChange={(e) => setManualVehicleType(e.target.value as VehicleType | '')}
                      >
                        <option value="">Pilih</option>
                        {VEHICLE_TYPES.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-2">
                      <label className="flex cursor-pointer items-start gap-2 text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={manualInsuranceIncluded}
                          onChange={(e) => {
                            setManualInsuranceIncluded(e.target.checked)
                            if (!e.target.checked) setManualInsurancePremiumDigits('')
                          }}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-accent"
                        />
                        Asuransi disertakan
                      </label>
                      {manualInsuranceIncluded && (
                        <label className="mt-2 block text-xs font-medium text-slate-600">
                          Premi asuransi (IDR)
                          <input
                            className={inputClass}
                            inputMode="numeric"
                            value={formatIdrThousandsFromDigits(manualInsurancePremiumDigits)}
                            onChange={(e) => setManualInsurancePremiumDigits(sanitizeIdrDigits(e.target.value))}
                          />
                        </label>
                      )}
                    </div>
                    <label className="text-xs font-medium text-slate-600">
                      Catatan
                      <textarea
                        className={`${inputClass} min-h-16 resize-none`}
                        value={manualNotes}
                        onChange={(e) => setManualNotes(e.target.value)}
                      />
                    </label>
                    <Button
                      type="button"
                      onClick={() => submitManual(vid)}
                      fullWidth
                    >
                      Simpan penawaran manual
                    </Button>
                  </div>
                </div>
              )}
            </SectionCard>
          )
        })}
      </div>
    </div>
  )
}
