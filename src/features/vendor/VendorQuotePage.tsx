import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { InquiryRequestSummary } from '../../components/InquiryRequestSummary'
import { PageShell } from '../../components/PageShell'
import { StickyCTA } from '../../components/StickyCTA'
import {
  formatIdrThousandsFromDigits,
  sanitizeIdrDigits,
} from '../../lib/inquiryFormHelpers'
import { VEHICLE_TYPES } from '../../lib/inquiryServiceOptions'
import { getVendorById } from '../../lib/matchVendors'
import { useLogisticsStore } from '../../store/useLogisticsStore'
import type { VehicleType } from '../../types/models'

const inputClass =
  'mt-1 w-full min-h-12 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none ring-accent placeholder:text-slate-400 focus:border-accent focus:ring-2'

export function VendorQuotePage() {
  const { token } = useParams<{ token: string }>()
  const tokenIndex = useLogisticsStore((s) => s.tokenIndex)
  const inquiries = useLogisticsStore((s) => s.inquiries)
  const submitVendorQuote = useLogisticsStore((s) => s.submitVendorQuote)

  const [price, setPrice] = useState('')
  const [eta, setEta] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [vehicleType, setVehicleType] = useState<VehicleType | ''>('')
  const [insuranceIncluded, setInsuranceIncluded] = useState(false)
  const [insurancePremiumDigits, setInsurancePremiumDigits] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const entry = useMemo(
    () => (token ? tokenIndex[token] : undefined),
    [token, tokenIndex],
  )

  const inquiry = useMemo(
    () => (entry ? inquiries.find((i) => i.id === entry.inquiryId) : undefined),
    [entry, inquiries],
  )

  const vendor = useMemo(() => (entry ? getVendorById(entry.vendorId) : undefined), [entry])

  if (!token) {
    return (
      <PageShell title="Tautan tidak valid" showHomeLink={false}>
        <p className="text-slate-600">Token tidak ada.</p>
      </PageShell>
    )
  }

  const quoteToken = token

  if (!entry || !inquiry) {
    return (
      <PageShell title="Penawaran vendor" showHomeLink={false}>
        <Card className="text-center text-slate-700">
          <p className="font-medium text-slate-900">Tautan tidak valid atau kedaluwarsa</p>
          <p className="mt-2 text-sm text-slate-600">Hubungi admin jika Anda membutuhkan tautan baru.</p>
        </Card>
      </PageShell>
    )
  }

  function submit() {
    setError('')
    setSuccessMsg('')
    const p = Number(price.replace(/\./g, '').replace(/,/g, '.'))
    if (!price.trim() || Number.isNaN(p) || p <= 0) {
      setError('Harga wajib diisi (angka).')
      return
    }
    if (!pickupDate.trim()) {
      setError('Tanggal jemput wajib diisi.')
      return
    }
    if (!vehicleType) {
      setError('Jenis kendaraan wajib dipilih.')
      return
    }

    const prem = parseInt(insurancePremiumDigits.replace(/\D/g, ''), 10)
    if (insuranceIncluded && (Number.isNaN(prem) || prem < 1)) {
      setError('Jika asuransi disertakan, isi premi asuransi (IDR) dengan nominal valid.')
      return
    }

    const result = submitVendorQuote(quoteToken, {
      price: Math.round(p),
      eta: eta.trim() || '—',
      pickupDate: pickupDate.trim(),
      notes: notes.trim(),
      vehicleType: vehicleType || '',
      insuranceIncluded,
      insurancePremium: insuranceIncluded ? prem : 0,
    })

    if (!result.ok) {
      setError('Tautan tidak valid.')
      return
    }

    setSuccessMsg(
      result.updated
        ? 'Anda sudah mengirim penawaran sebelumnya — data telah diperbarui.'
        : 'Penawaran berhasil dikirim. Terima kasih.',
    )
  }

  return (
    <>
      <PageShell title="Kirim penawaran" showHomeLink={false}>
        <p className="text-left text-sm text-slate-600">
          Halo{vendor ? `, ${vendor.name}` : ''}. Isi cepat di bawah ini (kurang dari satu menit).
        </p>

        <Card className="text-left">
          <InquiryRequestSummary inquiry={inquiry} />
        </Card>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-100">{error}</p>
        )}
        {successMsg && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-100">
            {successMsg}
          </p>
        )}

        <div className="flex flex-col gap-4 text-left">
          <label className="text-sm font-medium text-slate-700">
            Harga (IDR)
            <input
              className={inputClass}
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="1500000"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Estimasi tiba (ETA, opsional)
            <input
              className={inputClass}
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              placeholder="Contoh: 2 hari (opsional)"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Tanggal jemput
            <input
              className={inputClass}
              type="date"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Jenis kendaraan
            <select
              className={inputClass}
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value as VehicleType | '')}
            >
              <option value="">Pilih (wajib untuk tampilan pelanggan)</option>
              {VEHICLE_TYPES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <label className="flex cursor-pointer items-start gap-3 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                checked={insuranceIncluded}
                onChange={(e) => {
                  setInsuranceIncluded(e.target.checked)
                  if (!e.target.checked) setInsurancePremiumDigits('')
                }}
                className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-accent focus:ring-accent"
              />
              <span>Asuransi disertakan dalam penawaran</span>
            </label>
            {insuranceIncluded && (
              <label className="mt-3 block text-sm font-medium text-slate-700">
                Premi asuransi (IDR)
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={formatIdrThousandsFromDigits(insurancePremiumDigits)}
                  onChange={(e) => setInsurancePremiumDigits(sanitizeIdrDigits(e.target.value))}
                  placeholder="50.000"
                />
              </label>
            )}
          </div>
          <label className="text-sm font-medium text-slate-700">
            Catatan
            <textarea
              className={`${inputClass} min-h-20 resize-none`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opsional"
            />
          </label>
        </div>
      </PageShell>

      <StickyCTA>
        <button
          type="button"
          onClick={submit}
          className="w-full min-h-12 rounded-xl bg-slate-900 text-base font-semibold text-white shadow-md"
        >
          Kirim penawaran
        </button>
      </StickyCTA>
    </>
  )
}
