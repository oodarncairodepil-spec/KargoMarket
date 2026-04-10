import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProgressSteps } from '../../components/ProgressSteps'
import { StickyCTA } from '../../components/StickyCTA'
import { apiClient } from '../../lib/apiClient'
import {
  formatDimensionsCm,
  formatIdrDigitsString,
  formatIdrThousandsFromDigits,
  MAX_ITEM_IMAGE_BYTES,
  MAX_ITEM_IMAGES,
  sanitizeDimensionCm,
  sanitizeIdrDigits,
  sanitizePostalCode,
  sanitizeWeightInput,
} from '../../lib/inquiryFormHelpers'
import { SPECIAL_TREATMENTS, TNC_SUMMARY_LINES, VEHICLE_TYPES } from '../../lib/inquiryServiceOptions'
import { useAuthStore } from '../../store/useAuthStore'
import type { SpecialTreatmentType, VehicleType } from '../../types/models'

const inputClass =
  'mt-1 w-full min-h-12 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none ring-accent placeholder:text-slate-400 focus:border-accent focus:ring-2'

const invalidRing = 'border-red-500 ring-2 ring-red-200 focus:border-red-500 focus:ring-red-200'

type Step = 0 | 1 | 2 | 3

type InvalidField =
  | 'pickupAddress'
  | 'pickupKelurahan'
  | 'pickupKecamatan'
  | 'pickupKota'
  | 'pickupPostalCode'
  | 'destinationAddress'
  | 'destinationKelurahan'
  | 'destinationKecamatan'
  | 'destinationKota'
  | 'destinationPostalCode'
  | 'itemDescription'
  | 'weight'
  | 'koliCount'
  | 'estimatedItemValue'
  | 'scheduledPickupDate'
  | 'insurance'
  | 'packing'
  | 'tnc'

export function InquiryNewPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const pickupAddressRef = useRef<HTMLTextAreaElement>(null)
  const pickupKelurahanRef = useRef<HTMLInputElement>(null)
  const pickupKecamatanRef = useRef<HTMLInputElement>(null)
  const pickupKotaRef = useRef<HTMLInputElement>(null)
  const pickupPostalCodeRef = useRef<HTMLInputElement>(null)
  const destinationAddressRef = useRef<HTMLTextAreaElement>(null)
  const destinationKelurahanRef = useRef<HTMLInputElement>(null)
  const destinationKecamatanRef = useRef<HTMLInputElement>(null)
  const destinationKotaRef = useRef<HTMLInputElement>(null)
  const destinationPostalCodeRef = useRef<HTMLInputElement>(null)
  const itemDescriptionRef = useRef<HTMLTextAreaElement>(null)
  const weightRef = useRef<HTMLInputElement>(null)
  const koliRef = useRef<HTMLInputElement>(null)
  const estimatedValueRef = useRef<HTMLInputElement>(null)
  const scheduledPickupDateRef = useRef<HTMLInputElement>(null)
  const vehicleTypeRef = useRef<HTMLSelectElement>(null)
  const specialTreatmentRef = useRef<HTMLSelectElement>(null)
  const insuranceRef = useRef<HTMLSelectElement>(null)
  const packingRef = useRef<HTMLSelectElement>(null)
  const budgetRef = useRef<HTMLInputElement>(null)
  const tncBoxRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>(0)
  const [pickupAddress, setPickupAddress] = useState('')
  const [pickupKelurahan, setPickupKelurahan] = useState('')
  const [pickupKecamatan, setPickupKecamatan] = useState('')
  const [pickupKota, setPickupKota] = useState('')
  const [pickupPostalCode, setPickupPostalCode] = useState('')
  const [destinationAddress, setDestinationAddress] = useState('')
  const [destinationKelurahan, setDestinationKelurahan] = useState('')
  const [destinationKecamatan, setDestinationKecamatan] = useState('')
  const [destinationKota, setDestinationKota] = useState('')
  const [destinationPostalCode, setDestinationPostalCode] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [weight, setWeight] = useState('')
  const [lengthCm, setLengthCm] = useState('')
  const [widthCm, setWidthCm] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [specialRequirements, setSpecialRequirements] = useState('')
  const [itemImageUrls, setItemImageUrls] = useState<string[]>([])
  const [koliCount, setKoliCount] = useState('')
  const [estimatedItemValue, setEstimatedItemValue] = useState('')
  const [scheduledPickupDate, setScheduledPickupDate] = useState('')
  const [vehicleType, setVehicleType] = useState<VehicleType | ''>('')
  const [specialTreatment, setSpecialTreatment] = useState<SpecialTreatmentType | ''>('')
  const [insuranceChoice, setInsuranceChoice] = useState<'yes' | 'no' | ''>('')
  const [packingChoice, setPackingChoice] = useState<'yes' | 'no' | ''>('')
  const [budgetEstimate, setBudgetEstimate] = useState('')
  const [tncAccepted, setTncAccepted] = useState(false)

  const [error, setError] = useState('')
  const [invalidField, setInvalidField] = useState<InvalidField | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function fieldClass(field: InvalidField | null, key: InvalidField): string {
    if (field === key) return `${inputClass} ${invalidRing}`
    return inputClass
  }

  function focusField(el: HTMLElement | null) {
    requestAnimationFrame(() => {
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (el && 'focus' in el && typeof (el as HTMLInputElement).focus === 'function') {
        ;(el as HTMLInputElement).focus({ preventScroll: true })
      }
    })
  }

  function scrollToTopBar() {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  function next() {
    setError('')
    setInvalidField(null)

    if (step === 0) {
      if (!pickupAddress.trim()) {
        setError('Alamat lengkap asal penjemputan wajib diisi.')
        setInvalidField('pickupAddress')
        focusField(pickupAddressRef.current)
        return
      }
      if (!pickupKelurahan.trim()) {
        setError('Kelurahan asal wajib diisi.')
        setInvalidField('pickupKelurahan')
        focusField(pickupKelurahanRef.current)
        return
      }
      if (!pickupKecamatan.trim()) {
        setError('Kecamatan asal wajib diisi.')
        setInvalidField('pickupKecamatan')
        focusField(pickupKecamatanRef.current)
        return
      }
      if (!pickupKota.trim()) {
        setError('Kota asal wajib diisi.')
        setInvalidField('pickupKota')
        focusField(pickupKotaRef.current)
        return
      }
      const pickupPc = pickupPostalCode.trim()
      if (!pickupPc) {
        setError('Kode pos asal wajib diisi (angka saja).')
        setInvalidField('pickupPostalCode')
        focusField(pickupPostalCodeRef.current)
        return
      }
      if (!/^\d{3,7}$/.test(pickupPc)) {
        setError('Kode pos asal tidak valid (gunakan angka, 3–7 digit).')
        setInvalidField('pickupPostalCode')
        focusField(pickupPostalCodeRef.current)
        return
      }

      if (!destinationAddress.trim()) {
        setError('Alamat lengkap tujuan wajib diisi.')
        setInvalidField('destinationAddress')
        focusField(destinationAddressRef.current)
        return
      }
      if (!destinationKelurahan.trim()) {
        setError('Kelurahan tujuan wajib diisi.')
        setInvalidField('destinationKelurahan')
        focusField(destinationKelurahanRef.current)
        return
      }
      if (!destinationKecamatan.trim()) {
        setError('Kecamatan tujuan wajib diisi.')
        setInvalidField('destinationKecamatan')
        focusField(destinationKecamatanRef.current)
        return
      }
      if (!destinationKota.trim()) {
        setError('Kota tujuan wajib diisi.')
        setInvalidField('destinationKota')
        focusField(destinationKotaRef.current)
        return
      }
      const destPc = destinationPostalCode.trim()
      if (!destPc) {
        setError('Kode pos tujuan wajib diisi (angka saja).')
        setInvalidField('destinationPostalCode')
        focusField(destinationPostalCodeRef.current)
        return
      }
      if (!/^\d{3,7}$/.test(destPc)) {
        setError('Kode pos tujuan tidak valid (gunakan angka, 3–7 digit).')
        setInvalidField('destinationPostalCode')
        focusField(destinationPostalCodeRef.current)
        return
      }
    }

    if (step === 1) {
      if (!itemDescription.trim()) {
        setError('Deskripsi barang wajib diisi.')
        setInvalidField('itemDescription')
        focusField(itemDescriptionRef.current)
        return
      }
      if (!weight.trim()) {
        setError('Berat wajib diisi.')
        setInvalidField('weight')
        focusField(weightRef.current)
        return
      }
      if (!/^\d+(\.\d+)?$/.test(weight.trim())) {
        setError('Berat harus berupa angka valid (contoh: 25 atau 12.5).')
        setInvalidField('weight')
        focusField(weightRef.current)
        return
      }
      const koli = koliCount.trim()
      if (!koli || !/^\d+$/.test(koli) || parseInt(koli, 10) < 1) {
        setError('Jumlah koli wajib diisi (minimal 1).')
        setInvalidField('koliCount')
        focusField(koliRef.current)
        return
      }
      const est = estimatedItemValue.replace(/\D/g, '')
      if (!est || parseInt(est, 10) < 1) {
        setError('Estimasi harga barang wajib diisi (nominal perkiraan).')
        setInvalidField('estimatedItemValue')
        focusField(estimatedValueRef.current)
        return
      }
    }

    if (step === 2) {
      if (!scheduledPickupDate.trim()) {
        setError('Tanggal penjemputan wajib dipilih.')
        setInvalidField('scheduledPickupDate')
        focusField(scheduledPickupDateRef.current)
        return
      }
      if (!insuranceChoice) {
        setError('Pilih opsi asuransi (Ya/Tidak).')
        setInvalidField('insurance')
        focusField(insuranceRef.current)
        return
      }
      if (!packingChoice) {
        setError('Pilih opsi packing tambahan (Ya/Tidak).')
        setInvalidField('packing')
        focusField(packingRef.current)
        return
      }
    }

    setStep((s) => (s < 3 ? ((s + 1) as Step) : s))
  }

  function back() {
    setError('')
    setInvalidField(null)
    setStep((s) => (s > 0 ? ((s - 1) as Step) : s))
  }

  function onPickImages(e: React.ChangeEvent<HTMLInputElement>) {
    setError('')
    const files = e.target.files
    if (!files?.length) return

    const remaining = MAX_ITEM_IMAGES - itemImageUrls.length
    if (remaining <= 0) {
      setError(`Maksimal ${MAX_ITEM_IMAGES} gambar.`)
      e.target.value = ''
      return
    }

    const toAdd = Array.from(files).slice(0, remaining)
    const invalid = toAdd.find((f) => !f.type.startsWith('image/'))
    if (invalid) {
      setError('Hanya file gambar yang diperbolehkan.')
      e.target.value = ''
      return
    }
    const tooBig = toAdd.find((f) => f.size > MAX_ITEM_IMAGE_BYTES)
    if (tooBig) {
      setError(`Tiap gambar maks. ~${Math.round(MAX_ITEM_IMAGE_BYTES / 1024)} KB (penyimpanan lokal).`)
      e.target.value = ''
      return
    }

    void Promise.all(
      toAdd.map(
        (file, idx) =>
          new Promise<{ idx: number; url: string }>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                resolve({ idx, url: reader.result })
              } else {
                reject(new Error('read'))
              }
            }
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(file)
          }),
      ),
    )
      .then((results) => {
        results.sort((a, b) => a.idx - b.idx)
        setItemImageUrls((prev) => [...prev, ...results.map((r) => r.url)])
      })
      .catch(() => setError('Gagal membaca salah satu gambar.'))
    e.target.value = ''
  }

  function removeImage(index: number) {
    setItemImageUrls((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (submitting) return
    setError('')
    setInvalidField(null)
    if (!tncAccepted) {
      setError('Anda harus menyetujui syarat dan ketentuan untuk melanjutkan.')
      setInvalidField('tnc')
      focusField(tncBoxRef.current)
      return
    }

    const w = weight.trim()
    const dims = formatDimensionsCm(lengthCm, widthCm, heightCm)
    const payload = {
      createdByUserId: user?.id,
      createdByName: user?.name,
      pickup: pickupKota.trim(),
      destination: destinationKota.trim(),
      pickupAddress: pickupAddress.trim(),
      pickupKelurahan: pickupKelurahan.trim(),
      pickupKecamatan: pickupKecamatan.trim(),
      pickupKota: pickupKota.trim(),
      pickupPostalCode: pickupPostalCode.trim(),
      destinationAddress: destinationAddress.trim(),
      destinationKelurahan: destinationKelurahan.trim(),
      destinationKecamatan: destinationKecamatan.trim(),
      destinationKota: destinationKota.trim(),
      destinationPostalCode: destinationPostalCode.trim(),
      itemDescription: itemDescription.trim(),
      weight: w,
      dimensions: dims,
      lengthCm: lengthCm.trim(),
      widthCm: widthCm.trim(),
      heightCm: heightCm.trim(),
      itemImageUrls: [...itemImageUrls],
      specialRequirements: specialRequirements.trim(),
      scheduledPickupDate: scheduledPickupDate.trim(),
      koliCount: koliCount.trim(),
      estimatedItemValue: estimatedItemValue.replace(/\D/g, ''),
      vehicleType: vehicleType || '',
      specialTreatment: specialTreatment || '',
      insurance: insuranceChoice === 'yes',
      additionalPacking: packingChoice === 'yes',
      budgetEstimate: budgetEstimate.replace(/\D/g, ''),
      tncAcceptedAt: new Date().toISOString(),
    }
    setSubmitting(true)
    try {
      const res = (await apiClient.post('/customer/inquiries', payload)) as { inquiryId?: string }
      const newId = res && typeof res === 'object' && typeof res.inquiryId === 'string' ? res.inquiryId : null
      navigate(newId ? `/customer/inquiry/${newId}` : '/customer/inquiries', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan permintaan')
      setSubmitting(false)
    }
  }

  const dimLine = formatDimensionsCm(lengthCm, widthCm, heightCm)

  const fileSummary =
    itemImageUrls.length === 0
      ? 'Belum ada gambar dipilih.'
      : `${itemImageUrls.length} gambar dipilih`

  const minDate = new Date().toISOString().slice(0, 10)

  const tncBlockClass =
    invalidField === 'tnc'
      ? 'rounded-2xl border-2 border-red-500 bg-red-50/40 p-4 ring-2 ring-red-100'
      : 'rounded-2xl border border-slate-200 bg-slate-50/80 p-4'

  useEffect(() => {
    if (step > 0) {
      scrollToTopBar()
    }
  }, [step])

  return (
    <>
      <div className="flex flex-col gap-4">
        <ProgressSteps step={step} />
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-100" role="alert">
            {error}
          </p>
        )}

        {step === 0 && (
          <div className="flex flex-col gap-6 text-left">
            <fieldset className="min-w-0 space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <legend className="px-1 text-base font-semibold text-slate-900">Asal penjemputan</legend>
              <label className="text-sm font-medium text-slate-700">
                Alamat lengkap
                <textarea
                  ref={pickupAddressRef}
                  className={`${fieldClass(invalidField, 'pickupAddress')} min-h-24 resize-none`}
                  value={pickupAddress}
                  onChange={(e) => {
                    setPickupAddress(e.target.value)
                    if (invalidField === 'pickupAddress') setInvalidField(null)
                  }}
                  placeholder="Jalan, nomor, RT/RW, gedung…"
                  autoComplete="street-address"
                />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Kelurahan / Desa
                  <input
                    ref={pickupKelurahanRef}
                    className={fieldClass(invalidField, 'pickupKelurahan')}
                    value={pickupKelurahan}
                    onChange={(e) => {
                      setPickupKelurahan(e.target.value)
                      if (invalidField === 'pickupKelurahan') setInvalidField(null)
                    }}
                    placeholder="Contoh: Menteng"
                    autoComplete="address-level4"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Kecamatan
                  <input
                    ref={pickupKecamatanRef}
                    className={fieldClass(invalidField, 'pickupKecamatan')}
                    value={pickupKecamatan}
                    onChange={(e) => {
                      setPickupKecamatan(e.target.value)
                      if (invalidField === 'pickupKecamatan') setInvalidField(null)
                    }}
                    placeholder="Contoh: Menteng"
                    autoComplete="address-level3"
                  />
                </label>
              </div>
              <label className="text-sm font-medium text-slate-700">
                Kota / Kabupaten
                <input
                  ref={pickupKotaRef}
                  className={fieldClass(invalidField, 'pickupKota')}
                  value={pickupKota}
                  onChange={(e) => {
                    setPickupKota(e.target.value)
                    if (invalidField === 'pickupKota') setInvalidField(null)
                  }}
                  placeholder="Contoh: Jakarta Pusat"
                  autoComplete="address-level2"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Kode pos (angka saja)
                <input
                  ref={pickupPostalCodeRef}
                  className={fieldClass(invalidField, 'pickupPostalCode')}
                  inputMode="numeric"
                  value={pickupPostalCode}
                  onChange={(e) => {
                    setPickupPostalCode(sanitizePostalCode(e.target.value))
                    if (invalidField === 'pickupPostalCode') setInvalidField(null)
                  }}
                  placeholder="10310"
                  maxLength={7}
                />
              </label>
            </fieldset>

            <fieldset className="min-w-0 space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <legend className="px-1 text-base font-semibold text-slate-900">Tujuan pengiriman</legend>
              <label className="text-sm font-medium text-slate-700">
                Alamat lengkap
                <textarea
                  ref={destinationAddressRef}
                  className={`${fieldClass(invalidField, 'destinationAddress')} min-h-24 resize-none`}
                  value={destinationAddress}
                  onChange={(e) => {
                    setDestinationAddress(e.target.value)
                    if (invalidField === 'destinationAddress') setInvalidField(null)
                  }}
                  placeholder="Jalan, nomor, RT/RW, gedung…"
                />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Kelurahan / Desa
                  <input
                    ref={destinationKelurahanRef}
                    className={fieldClass(invalidField, 'destinationKelurahan')}
                    value={destinationKelurahan}
                    onChange={(e) => {
                      setDestinationKelurahan(e.target.value)
                      if (invalidField === 'destinationKelurahan') setInvalidField(null)
                    }}
                    placeholder="Contoh: Gubeng"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Kecamatan
                  <input
                    ref={destinationKecamatanRef}
                    className={fieldClass(invalidField, 'destinationKecamatan')}
                    value={destinationKecamatan}
                    onChange={(e) => {
                      setDestinationKecamatan(e.target.value)
                      if (invalidField === 'destinationKecamatan') setInvalidField(null)
                    }}
                    placeholder="Contoh: Gubeng"
                  />
                </label>
              </div>
              <label className="text-sm font-medium text-slate-700">
                Kota / Kabupaten
                <input
                  ref={destinationKotaRef}
                  className={fieldClass(invalidField, 'destinationKota')}
                  value={destinationKota}
                  onChange={(e) => {
                    setDestinationKota(e.target.value)
                    if (invalidField === 'destinationKota') setInvalidField(null)
                  }}
                  placeholder="Contoh: Surabaya"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Kode pos (angka saja)
                <input
                  ref={destinationPostalCodeRef}
                  className={fieldClass(invalidField, 'destinationPostalCode')}
                  inputMode="numeric"
                  value={destinationPostalCode}
                  onChange={(e) => {
                    setDestinationPostalCode(sanitizePostalCode(e.target.value))
                    if (invalidField === 'destinationPostalCode') setInvalidField(null)
                  }}
                  placeholder="60286"
                  maxLength={7}
                />
              </label>
            </fieldset>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4 text-left">
            <label className="text-sm font-medium text-slate-700">
              Deskripsi barang
              <textarea
                ref={itemDescriptionRef}
                className={`${fieldClass(invalidField, 'itemDescription')} min-h-24 resize-none`}
                value={itemDescription}
                onChange={(e) => {
                  setItemDescription(e.target.value)
                  if (invalidField === 'itemDescription') setInvalidField(null)
                }}
                placeholder="Jenis, jumlah, kemasan…"
              />
            </label>

            <div>
              <span className="text-sm font-medium text-slate-700">Foto barang (opsional)</span>
              <p className="mt-0.5 text-xs text-slate-500">
                Unggah hingga {MAX_ITEM_IMAGES} gambar. Ukuran tiap file maksimal sekitar{' '}
                {Math.round(MAX_ITEM_IMAGE_BYTES / 1024)} KB (disimpan di perangkat Anda).
              </p>
              <div className="mt-2 flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <p className="min-w-0 flex-1 text-sm text-slate-600">{fileSummary}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 rounded-lg bg-accent-soft px-4 py-2.5 text-sm font-semibold text-accent"
                >
                  Pilih gambar
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={onPickImages}
                className="sr-only"
                aria-label="Pilih file gambar barang"
              />
              {itemImageUrls.length > 0 && (
                <ul className="mt-3 grid grid-cols-3 gap-2">
                  {itemImageUrls.map((url, i) => (
                    <li
                      key={`${i}-${url.slice(0, 24)}`}
                      className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-sm font-bold text-white"
                        aria-label="Hapus gambar"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <label className="text-sm font-medium text-slate-700">
              Berat (kg, angka saja)
              <input
                ref={weightRef}
                className={fieldClass(invalidField, 'weight')}
                inputMode="decimal"
                value={weight}
                onChange={(e) => {
                  setWeight(sanitizeWeightInput(e.target.value))
                  if (invalidField === 'weight') setInvalidField(null)
                }}
                placeholder="25"
              />
            </label>

            <fieldset className="min-w-0">
              <legend className="text-sm font-medium text-slate-700">Dimensi (cm, opsional)</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="text-xs font-medium text-slate-600">
                  Panjang
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={lengthCm}
                    onChange={(e) => setLengthCm(sanitizeDimensionCm(e.target.value))}
                    placeholder="0"
                  />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Lebar
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={widthCm}
                    onChange={(e) => setWidthCm(sanitizeDimensionCm(e.target.value))}
                    placeholder="0"
                  />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Tinggi
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={heightCm}
                    onChange={(e) => setHeightCm(sanitizeDimensionCm(e.target.value))}
                    placeholder="0"
                  />
                </label>
              </div>
            </fieldset>

            <label className="text-sm font-medium text-slate-700">
              Jumlah koli
              <input
                ref={koliRef}
                className={fieldClass(invalidField, 'koliCount')}
                inputMode="numeric"
                value={koliCount}
                onChange={(e) => {
                  setKoliCount(sanitizeDimensionCm(e.target.value))
                  if (invalidField === 'koliCount') setInvalidField(null)
                }}
                placeholder="1"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Estimasi harga barang (IDR)
              <input
                ref={estimatedValueRef}
                className={fieldClass(invalidField, 'estimatedItemValue')}
                inputMode="numeric"
                value={formatIdrThousandsFromDigits(estimatedItemValue)}
                onChange={(e) => {
                  setEstimatedItemValue(sanitizeIdrDigits(e.target.value))
                  if (invalidField === 'estimatedItemValue') setInvalidField(null)
                }}
                placeholder="5.000.000"
              />
              <span className="mt-1 block text-xs text-slate-500">Perkiraan nilai muatan (untuk asuransi / referensi).</span>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Informasi tambahan — catatan (opsional)
              <textarea
                className={`${inputClass} min-h-20 resize-none`}
                value={specialRequirements}
                onChange={(e) => setSpecialRequirements(e.target.value)}
                placeholder="Catatan bebas jika ada (opsional)…"
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4 text-left">
            <label className="text-sm font-medium text-slate-700">
              Tanggal penjemputan
              <input
                ref={scheduledPickupDateRef}
                type="date"
                min={minDate}
                className={fieldClass(invalidField, 'scheduledPickupDate')}
                value={scheduledPickupDate}
                onChange={(e) => {
                  setScheduledPickupDate(e.target.value)
                  if (invalidField === 'scheduledPickupDate') setInvalidField(null)
                }}
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Jenis kendaraan (opsional)
              <select
                ref={vehicleTypeRef}
                className={inputClass}
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as VehicleType | '')}
              >
                <option value="">Belum ditentukan</option>
                {VEHICLE_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Penanganan khusus (opsional)
              <select
                ref={specialTreatmentRef}
                className={inputClass}
                value={specialTreatment}
                onChange={(e) => setSpecialTreatment(e.target.value as SpecialTreatmentType | '')}
              >
                <option value="">Tidak ada / belum ditentukan</option>
                {SPECIAL_TREATMENTS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Asuransi
              <select
                ref={insuranceRef}
                className={fieldClass(invalidField, 'insurance')}
                value={insuranceChoice}
                onChange={(e) => {
                  setInsuranceChoice(e.target.value as 'yes' | 'no' | '')
                  if (invalidField === 'insurance') setInvalidField(null)
                }}
              >
                <option value="">Pilih</option>
                <option value="yes">Ya</option>
                <option value="no">Tidak</option>
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Packing tambahan
              <select
                ref={packingRef}
                className={fieldClass(invalidField, 'packing')}
                value={packingChoice}
                onChange={(e) => {
                  setPackingChoice(e.target.value as 'yes' | 'no' | '')
                  if (invalidField === 'packing') setInvalidField(null)
                }}
              >
                <option value="">Pilih</option>
                <option value="yes">Ya</option>
                <option value="no">Tidak</option>
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Estimasi budget (IDR, opsional)
              <input
                ref={budgetRef}
                className={inputClass}
                inputMode="numeric"
                value={formatIdrThousandsFromDigits(budgetEstimate)}
                onChange={(e) => setBudgetEstimate(sanitizeIdrDigits(e.target.value))}
                placeholder="2.000.000"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Kosongkan jika ingin menunggu penawaran vendor tanpa kisaran budget.
              </span>
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4 text-left">
            <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-700 shadow-sm">
              <p>
                <span className="font-semibold text-slate-900">Rute (kota):</span> {pickupKota} → {destinationKota}
              </p>
              <div className="space-y-2 rounded-xl border border-slate-50 bg-slate-50/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Asal penjemputan</p>
                <p className="text-slate-800">{pickupAddress || '—'}</p>
                <p className="text-xs text-slate-600">
                  {[pickupKelurahan, pickupKecamatan, pickupKota].filter((x) => x.trim()).join(', ')}
                  {pickupPostalCode.trim() ? ` · Kode pos ${pickupPostalCode.trim()}` : ''}
                </p>
              </div>
              <div className="space-y-2 rounded-xl border border-slate-50 bg-slate-50/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tujuan pengiriman</p>
                <p className="text-slate-800">{destinationAddress || '—'}</p>
                <p className="text-xs text-slate-600">
                  {[destinationKelurahan, destinationKecamatan, destinationKota].filter((x) => x.trim()).join(', ')}
                  {destinationPostalCode.trim() ? ` · Kode pos ${destinationPostalCode.trim()}` : ''}
                </p>
              </div>
              <p>
                <span className="font-semibold text-slate-900">Tanggal penjemputan:</span>{' '}
                {scheduledPickupDate
                  ? new Date(scheduledPickupDate + 'T12:00:00').toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : '—'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Barang:</span> {itemDescription}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Koli:</span> {koliCount || '—'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Estimasi nilai barang:</span>{' '}
                {formatIdrDigitsString(estimatedItemValue)}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Berat:</span> {weight ? `${weight} kg` : '—'}
              </p>
              {dimLine && (
                <p>
                  <span className="font-semibold text-slate-900">Dimensi:</span> {dimLine}
                </p>
              )}
              <p>
                <span className="font-semibold text-slate-900">Kendaraan:</span> {vehicleType || '—'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Penanganan:</span> {specialTreatment || '—'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Asuransi:</span>{' '}
                {insuranceChoice === 'yes' ? 'Ya' : insuranceChoice === 'no' ? 'Tidak' : '—'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Packing tambahan:</span>{' '}
                {packingChoice === 'yes' ? 'Ya' : packingChoice === 'no' ? 'Tidak' : '—'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Estimasi budget:</span>{' '}
                {budgetEstimate.replace(/\D/g, '') ? formatIdrDigitsString(budgetEstimate) : '—'}
              </p>
              {specialRequirements.trim() && (
                <p>
                  <span className="font-semibold text-slate-900">Catatan:</span> {specialRequirements}
                </p>
              )}
              {itemImageUrls.length > 0 && (
                <div>
                  <span className="font-semibold text-slate-900">Foto:</span>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {itemImageUrls.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="aspect-square rounded-lg border border-slate-200 object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div ref={tncBoxRef} className={tncBlockClass} tabIndex={-1}>
              <h3 className="text-sm font-semibold text-slate-900">Syarat & ketentuan</h3>
              <ul className="mt-2 list-inside list-disc space-y-1.5 text-xs text-slate-600">
                {TNC_SUMMARY_LINES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={tncAccepted}
                  onChange={(e) => {
                    setTncAccepted(e.target.checked)
                    if (e.target.checked && invalidField === 'tnc') setInvalidField(null)
                  }}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-accent focus:ring-accent"
                />
                <span>
                  Saya telah membaca dan menyetujui syarat & ketentuan di atas, serta memahami bahwa harga akhir dapat
                  berbeda dan biaya tambahan dapat berlaku sesuai kondisi pengiriman.
                </span>
              </label>
            </div>
          </div>
        )}

        {(step > 0 || step === 3) && (
          <div className="mt-2 flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={back}
                className="min-h-12 flex-1 rounded-xl border border-slate-200 bg-white text-base font-semibold text-slate-800 shadow-sm"
              >
                Kembali
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  void handleSubmit()
                }}
                className="min-h-12 flex-[2] rounded-xl bg-accent text-base font-semibold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Mengirim…' : 'Kirim permintaan'}
              </button>
            )}
          </div>
        )}
      </div>

      <StickyCTA aboveBottomNav>
        <div className="flex gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={back}
              className="min-h-12 flex-1 rounded-xl border border-slate-200 bg-white text-base font-semibold text-slate-800 shadow-sm"
            >
              Kembali
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={next}
              className="min-h-12 flex-[2] rounded-xl bg-accent text-base font-semibold text-white shadow-md"
            >
              Lanjut
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                void handleSubmit()
              }}
              className="min-h-12 flex-[2] rounded-xl bg-accent text-base font-semibold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Mengirim…' : 'Kirim permintaan'}
            </button>
          )}
        </div>
      </StickyCTA>
    </>
  )
}
