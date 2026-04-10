import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { InquiryRequestSummary } from '../../components/InquiryRequestSummary'
import { PageShell } from '../../components/PageShell'
import { StickyCTA } from '../../components/StickyCTA'
import { Spinner } from '../../components/ui/Spinner'
import { apiClient } from '../../lib/apiClient'
import {
  formatIdrThousandsFromDigits,
  sanitizeIdrDigits,
} from '../../lib/inquiryFormHelpers'
import { VEHICLE_TYPES } from '../../lib/inquiryServiceOptions'
import type { Inquiry, VehicleType } from '../../types/models'

const inputClass =
  'mt-1 w-full min-h-12 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none ring-accent placeholder:text-slate-400 focus:border-accent focus:ring-2'

type VendorQuoteContext = {
  vendor: { id: string; name: string; customer_rating?: number } | null
  inquiry: Inquiry
}

export function VendorQuotePage() {
  const { token } = useParams<{ token: string }>()

  const [ctx, setCtx] = useState<VendorQuoteContext | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'invalid' | 'error' | 'ready'>('loading')

  const [price, setPrice] = useState('')
  const [eta, setEta] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [vehicleType, setVehicleType] = useState<VehicleType | ''>('')
  const [insuranceIncluded, setInsuranceIncluded] = useState(false)
  const [insurancePremiumDigits, setInsurancePremiumDigits] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoadState('invalid')
      return
    }
    let mounted = true
    void (async () => {
      try {
        setLoadState('loading')
        const res = (await apiClient.get(`/vendor/quote/${token}`)) as VendorQuoteContext
        if (!mounted) return
        if (!res.inquiry) {
          setLoadState('invalid')
          setCtx(null)
          return
        }
        setCtx({ vendor: res.vendor ?? null, inquiry: res.inquiry })
        setLoadState('ready')
      } catch (e) {
        if (!mounted) return
        const msg = e instanceof Error ? e.message : ''
        if (msg === 'invalid_token' || msg === 'not_found') {
          setLoadState('invalid')
        } else {
          setLoadState('error')
        }
        setCtx(null)
      }
    })()
    return () => {
      mounted = false
    }
  }, [token])

  if (!token) {
    return (
      <PageShell title="Tautan tidak valid" showHomeLink={false}>
        <p className="text-slate-600">Token tidak ada.</p>
      </PageShell>
    )
  }

  if (loadState === 'loading') {
    return (
      <PageShell title="Penawaran vendor" showHomeLink={false}>
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-600">
          <Spinner className="h-7 w-7" />
          <p className="text-sm">Memuat permintaan...</p>
        </div>
      </PageShell>
    )
  }

  if (loadState === 'error') {
    return (
      <PageShell title="Penawaran vendor" showHomeLink={false}>
        <Card className="text-center text-slate-700">
          <p className="font-medium text-slate-900">Tidak dapat memuat halaman</p>
          <p className="mt-2 text-sm text-slate-600">Periksa koneksi dan pastikan API berjalan, lalu coba lagi.</p>
        </Card>
      </PageShell>
    )
  }

  if (loadState === 'invalid' || !ctx) {
    return (
      <PageShell title="Penawaran vendor" showHomeLink={false}>
        <Card className="text-center text-slate-700">
          <p className="font-medium text-slate-900">Tautan tidak valid atau tidak ditemukan</p>
          <p className="mt-2 text-sm text-slate-600">
            Token tidak ada di server (misalnya salah salin, inquiry dihapus, atau lingkungan beda database).
            Hubungi admin untuk tautan baru.
          </p>
        </Card>
      </PageShell>
    )
  }

  const { inquiry, vendor } = ctx
  const vendorName = vendor?.name

  async function submit() {
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

    setSubmitting(true)
    try {
      await apiClient.post(`/vendor/quote/${token}`, {
        price: Math.round(p),
        eta: eta.trim() || '—',
        pickupDate: pickupDate.trim(),
        notes: notes.trim(),
        vehicleType: vehicleType || '',
        insuranceIncluded,
        insurancePremium: insuranceIncluded ? prem : 0,
      })
      setSuccessMsg('Penawaran berhasil dikirim. Terima kasih.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'invalid_token') {
        setError('Tautan tidak valid.')
      } else if (msg === 'invalid_payload') {
        setError('Data tidak valid. Periksa kolom wajib.')
      } else if (msg === 'invalid_origin') {
        setError('Akses ditolak origin. Hubungi admin.')
      } else {
        setError('Gagal mengirim penawaran. Coba lagi.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageShell title="Kirim penawaran" showHomeLink={false}>
        <p className="text-left text-sm text-slate-600">
          Halo{vendorName ? `, ${vendorName}` : ''}. Isi cepat di bawah ini (kurang dari satu menit).
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
          disabled={submitting}
          onClick={() => void submit()}
          className="w-full min-h-12 rounded-xl bg-slate-900 text-base font-semibold text-white shadow-md disabled:opacity-50"
        >
          {submitting ? 'Mengirim…' : 'Kirim penawaran'}
        </button>
      </StickyCTA>
    </>
  )
}
