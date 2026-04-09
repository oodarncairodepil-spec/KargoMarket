import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { ui } from '../../lib/uiTokens'
import { supabase } from '../../lib/supabase'
import type { VehicleType, VendorRegistration } from '../../types/models'

const inputClass = `mt-1 ${ui.form.input.compact}`
const businessTypes = ['CV', 'PT', 'Perorangan'] as const
const serviceTypeOptions = ['Trucking', 'Cold Chain', 'Project Cargo', 'Last Mile', 'Intercity'] as const
const specializationOptions = ['Alat Berat', 'FMCG', 'Frozen Food', 'Fragile', 'Retail', 'Project Cargo', 'Remote Area'] as const
const vehicleOptions: VehicleType[] = ['Pickup', 'CDD', 'Fuso', 'Trailer']
const dayOptions = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const
const cityOptions = ['Jakarta', 'Bandung', 'Surabaya', 'Semarang', 'Yogyakarta', 'Denpasar', 'Makassar', 'Medan', 'Balikpapan'] as const
const pricingSchemes = ['Harga Nett', 'Fee (Komisi)'] as const
const pricingMethods = ['Per kg', 'Per trip', 'Per Koli', 'Custom'] as const

type InvalidField =
  | 'companyName'
  | 'businessType'
  | 'originCities'
  | 'destinationCities'
  | 'picName'
  | 'whatsappNumber'
  | 'email'
  | 'ownerName'
  | 'serviceTypes'
  | 'specializations'
  | 'vehicleTypes'
  | 'operationalDays'
  | 'operationalStartTime'
  | 'operationalEndTime'
  | 'supportsBidding'
  | 'officePhoto'
  | 'officeMapsLink'
  | 'slaResponse'
  | 'insuranceTerms'
  | 'packingFeeTerms'
  | 'otherFeesTerms'
  | 'paymentTerms'
  | 'taxTerms'
  | 'tncAccepted'

interface MapSuggestion {
  display_name: string
  lat: string
  lon: string
}

function CompactMultiSelect({
  options,
  selected,
  onToggle,
  placeholder,
  hasError = false,
  onInteract,
}: {
  options: readonly string[]
  selected: string[]
  onToggle: (value: string) => void
  placeholder: string
  hasError?: boolean
  onInteract?: () => void
}) {
  const [search, setSearch] = useState('')
  const summary = useMemo(() => {
    if (selected.length === 0) return placeholder
    if (selected.length <= 2) return selected.join(', ')
    return `${selected.slice(0, 2).join(', ')} +${selected.length - 2} lainnya`
  }, [placeholder, selected])
  const filtered = useMemo(
    () => options.filter((option) => option.toLowerCase().includes(search.toLowerCase().trim())),
    [options, search],
  )

  return (
    <details className="group mt-1 relative" onToggle={onInteract}>
      <summary
        className={`flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg bg-white px-3 py-2 text-sm text-slate-800 ${
          hasError ? 'border-2 border-red-500 ring-2 ring-red-100' : 'border border-slate-200'
        }`}
      >
        <span className="truncate">{summary}</span>
        <span className="text-xs text-slate-500 group-open:rotate-180">▼</span>
      </summary>
      <div className="absolute z-20 mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari opsi..."
          className="mb-2 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <div className="max-h-44 space-y-1 overflow-auto pr-1">
          {filtered.length === 0 && <p className="px-2 py-2 text-xs text-slate-500">Tidak ada hasil.</p>}
          {filtered.map((option) => (
            <label
              key={option}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => {
                  onToggle(option)
                  onInteract?.()
                }}
                className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </div>
    </details>
  )
}

export function AdminVendorManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const officePhotoRef = useRef<HTMLInputElement>(null)
  const ownerProofRef = useRef<HTMLInputElement>(null)
  const nibRef = useRef<HTMLInputElement>(null)
  const npwpRef = useRef<HTMLInputElement>(null)
  const fleetRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const [view, setView] = useState<'list' | 'form'>('list')
  const [vendorRegistrations, setVendorRegistrations] = useState<VendorRegistration[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [businessType, setBusinessType] = useState<(typeof businessTypes)[number] | ''>('')
  const [establishedYear, setEstablishedYear] = useState('')
  const [originCities, setOriginCities] = useState<string[]>([])
  const [destinationCities, setDestinationCities] = useState<string[]>([])
  const [picName, setPicName] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [email, setEmail] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerIdentityProofName, setOwnerIdentityProofName] = useState('')
  const [ownerIdentityProofDataUrl, setOwnerIdentityProofDataUrl] = useState<string | undefined>(undefined)
  const [serviceTypes, setServiceTypes] = useState<string[]>([])
  const [specializations, setSpecializations] = useState<string[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [maxCapacity, setMaxCapacity] = useState('')
  const [operationalDays, setOperationalDays] = useState<string[]>([])
  const [operationalStartTime, setOperationalStartTime] = useState('')
  const [operationalEndTime, setOperationalEndTime] = useState('')
  const [pricingScheme, setPricingScheme] = useState<(typeof pricingSchemes)[number]>('Harga Nett')
  const [pricingMethod, setPricingMethod] = useState<(typeof pricingMethods)[number]>('Per trip')
  const [supportsBidding, setSupportsBidding] = useState<boolean | null>(null)
  const [legalNibName, setLegalNibName] = useState('')
  const [legalNibDataUrl, setLegalNibDataUrl] = useState<string | undefined>(undefined)
  const [npwpName, setNpwpName] = useState('')
  const [npwpDataUrl, setNpwpDataUrl] = useState<string | undefined>(undefined)
  const [fleetPhotos, setFleetPhotos] = useState<{ name: string; dataUrl?: string }[]>([])
  const [officePhotoName, setOfficePhotoName] = useState('')
  const [officePhotoDataUrl, setOfficePhotoDataUrl] = useState<string | undefined>(undefined)
  const [officeMapsLink, setOfficeMapsLink] = useState('')
  const [officeLocationSearch, setOfficeLocationSearch] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<MapSuggestion[]>([])
  const [locationLoading, setLocationLoading] = useState(false)
  const [officeLatitude, setOfficeLatitude] = useState('')
  const [officeLongitude, setOfficeLongitude] = useState('')
  const [locating, setLocating] = useState(false)
  const [slaResponse, setSlaResponse] = useState('')
  const [insuranceTerms, setInsuranceTerms] = useState('')
  const [packingFeeTerms, setPackingFeeTerms] = useState('')
  const [otherFeesTerms, setOtherFeesTerms] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [taxTerms, setTaxTerms] = useState('')
  const [tncAccepted, setTncAccepted] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const mode = searchParams.get('mode')
    if (mode === 'form') {
      setView('form')
    } else {
      setView('list')
    }
  }, [searchParams])

  function setViewMode(next: 'list' | 'form') {
    setView(next)
    const params = new URLSearchParams(searchParams)
    if (next === 'form') {
      params.set('mode', 'form')
    } else {
      params.delete('mode')
    }
    setSearchParams(params, { replace: true })
  }
  const [invalidField, setInvalidField] = useState<InvalidField | null>(null)

  useEffect(() => {
    async function loadVendors() {
      setListLoading(true)
      const { data, error: loadError } = await supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false })
      if (loadError) {
        setError(loadError.message)
        setListLoading(false)
        return
      }
      const mapped: VendorRegistration[] = (data || []).map((row) => ({
        id: row.id,
        companyName: row.name || '',
        businessType: (row.business_type as VendorRegistration['businessType']) || 'CV',
        establishedYear: row.established_year || undefined,
        originCities: row.origin_cities || [],
        destinationCities: row.destination_cities || [],
        picName: row.pic_name || '',
        whatsappNumber: row.whatsapp_number || '',
        email: row.email || '',
        ownerName: row.owner_name || '',
        ownerIdentityProofName: row.owner_identity_proof_name || undefined,
        ownerIdentityProofDataUrl: row.owner_identity_proof_data_url || undefined,
        serviceTypes: row.service_types || [],
        specializations: row.specializations || [],
        vehicleTypes: (row.vehicle_types as VehicleType[]) || [],
        maxCapacity: row.max_capacity || undefined,
        operationalDays: row.operational_days || [],
        operationalHours: row.operational_hours || '',
        pricingScheme: (row.pricing_scheme as VendorRegistration['pricingScheme']) || 'Harga Nett',
        pricingMethod: (row.pricing_method as VendorRegistration['pricingMethod']) || 'Per trip',
        supportsBidding: Boolean(row.supports_bidding),
        legalNibName: row.legal_nib_name || undefined,
        legalNibDataUrl: row.legal_nib_data_url || undefined,
        npwpName: row.npwp_name || undefined,
        npwpDataUrl: row.npwp_data_url || undefined,
        fleetPhotos: Array.isArray(row.fleet_photos) ? row.fleet_photos : [],
        officePhotoName: row.office_photo_name || '',
        officePhotoDataUrl: row.office_photo_data_url || undefined,
        officeMapsLink: row.office_maps_link || '',
        officeLatitude: row.office_latitude ?? undefined,
        officeLongitude: row.office_longitude ?? undefined,
        slaResponse: row.sla_response || '',
        insuranceTerms: row.insurance_terms || '',
        packingFeeTerms: row.packing_fee_terms || '',
        otherFeesTerms: row.other_fees_terms || '',
        paymentTerms: row.payment_terms || '',
        taxTerms: row.tax_terms || '',
        tncAccepted: Boolean(row.tnc_accepted),
        createdAt: row.created_at || new Date().toISOString(),
      }))
      setVendorRegistrations(mapped)
      setListLoading(false)
    }
    void loadVendors()
  }, [])

  function fieldClass(key: InvalidField): string {
    return invalidField === key
      ? `${inputClass} border-red-500 ring-2 ring-red-100 focus:border-red-500 focus:ring-red-100`
      : inputClass
  }

  function clearInvalid(key: InvalidField) {
    if (invalidField === key) setInvalidField(null)
  }

  function uploadButtonClass(isError = false): string {
    return `mt-1 w-full justify-start overflow-hidden text-ellipsis whitespace-nowrap ${
      isError ? 'border-red-500 ring-2 ring-red-100' : ''
    }`
  }

  function focusInvalidField(field: InvalidField) {
    if (!formRef.current) return
    const selectorMap: Record<InvalidField, string> = {
      companyName: '[data-field="companyName"]',
      businessType: '[data-field="businessType"]',
      originCities: '[data-field="originCities"]',
      destinationCities: '[data-field="destinationCities"]',
      picName: '[data-field="picName"]',
      whatsappNumber: '[data-field="whatsappNumber"]',
      email: '[data-field="email"]',
      ownerName: '[data-field="ownerName"]',
      serviceTypes: '[data-field="serviceTypes"]',
      specializations: '[data-field="specializations"]',
      vehicleTypes: '[data-field="vehicleTypes"]',
      operationalDays: '[data-field="operationalDays"]',
      operationalStartTime: '[data-field="operationalStartTime"]',
      operationalEndTime: '[data-field="operationalEndTime"]',
      supportsBidding: '[data-field="supportsBidding"]',
      officePhoto: '[data-field="officePhoto"]',
      officeMapsLink: '[data-field="officeMapsLink"]',
      slaResponse: '[data-field="slaResponse"]',
      insuranceTerms: '[data-field="insuranceTerms"]',
      packingFeeTerms: '[data-field="packingFeeTerms"]',
      otherFeesTerms: '[data-field="otherFeesTerms"]',
      paymentTerms: '[data-field="paymentTerms"]',
      taxTerms: '[data-field="taxTerms"]',
      tncAccepted: '[data-field="tncAccepted"]',
    }
    const node = formRef.current.querySelector<HTMLElement>(selectorMap[field])
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    node?.focus?.()
  }

  async function fileToDataUrl(file: File): Promise<string | undefined> {
    if (!file) return undefined
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined)
      reader.onerror = () => resolve(undefined)
      reader.readAsDataURL(file)
    })
  }

  function toggle(setter: React.Dispatch<React.SetStateAction<string[]>>, item: string) {
    setter((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]))
  }

  async function pickCurrentLocation() {
    if (!navigator.geolocation) {
      setError('Browser tidak mendukung geolocation.')
      return
    }
    setLocating(true)
    setError('Meminta izin lokasi perangkat...')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setOfficeLatitude(lat.toFixed(6))
        setOfficeLongitude(lng.toFixed(6))
        setOfficeMapsLink(`https://maps.google.com/?q=${lat},${lng}`)
        setOfficeLocationSearch(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
        setLocationSuggestions([])
        setError('')
        setLocating(false)
      },
      () => {
        setError('Gagal mendapatkan lokasi. Pastikan izin lokasi (GPS) diizinkan pada browser.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  function validate(): { field: InvalidField; message: string } | null {
    if (!companyName.trim()) return { field: 'companyName', message: 'Nama perusahaan wajib diisi.' }
    if (!businessType) return { field: 'businessType', message: 'Jenis usaha wajib dipilih.' }
    if (originCities.length === 0) return { field: 'originCities', message: 'Kota asal minimal 1.' }
    if (destinationCities.length === 0) return { field: 'destinationCities', message: 'Kota tujuan minimal 1.' }
    if (!picName.trim()) return { field: 'picName', message: 'Nama PIC wajib diisi.' }
    if (!whatsappNumber.trim()) return { field: 'whatsappNumber', message: 'Nomor WhatsApp wajib diisi.' }
    if (!/^\d+$/.test(whatsappNumber.trim())) return { field: 'whatsappNumber', message: 'Nomor WhatsApp harus angka.' }
    if (!email.trim()) return { field: 'email', message: 'Email wajib diisi.' }
    if (!ownerName.trim()) return { field: 'ownerName', message: 'Nama owner wajib diisi.' }
    if (serviceTypes.length === 0) return { field: 'serviceTypes', message: 'Jenis layanan minimal 1.' }
    if (specializations.length === 0) return { field: 'specializations', message: 'Spesialisasi minimal 1.' }
    if (vehicleTypes.length === 0) return { field: 'vehicleTypes', message: 'Jenis kendaraan minimal 1.' }
    if (operationalDays.length === 0) return { field: 'operationalDays', message: 'Hari operasional minimal 1.' }
    if (!operationalStartTime) return { field: 'operationalStartTime', message: 'Jam mulai operasional wajib diisi.' }
    if (!operationalEndTime) return { field: 'operationalEndTime', message: 'Jam selesai operasional wajib diisi.' }
    if (supportsBidding === null) return { field: 'supportsBidding', message: 'Bersedia sistem bidding wajib dipilih.' }
    if (!officePhotoName.trim()) return { field: 'officePhoto', message: 'Foto kantor wajib diunggah.' }
    if (!officeMapsLink.trim()) return { field: 'officeMapsLink', message: 'Lokasi kantor (Maps) wajib diisi.' }
    if (!slaResponse.trim()) return { field: 'slaResponse', message: 'SLA respon wajib diisi.' }
    if (!insuranceTerms.trim()) return { field: 'insuranceTerms', message: 'Ketentuan asuransi/kerusakan wajib diisi.' }
    if (!packingFeeTerms.trim()) return { field: 'packingFeeTerms', message: 'Ketentuan biaya packing wajib diisi.' }
    if (!otherFeesTerms.trim()) return { field: 'otherFeesTerms', message: 'Biaya lain-lain wajib diisi.' }
    if (!paymentTerms.trim()) return { field: 'paymentTerms', message: 'Ketentuan pembayaran wajib diisi.' }
    if (!taxTerms.trim()) return { field: 'taxTerms', message: 'Ketentuan perpajakan wajib diisi.' }
    if (!tncAccepted) return { field: 'tncAccepted', message: 'Setuju syarat & ketentuan wajib dicentang.' }
    return null
  }

  function resetForm() {
    setCompanyName('')
    setBusinessType('')
    setEstablishedYear('')
    setOriginCities([])
    setDestinationCities([])
    setPicName('')
    setWhatsappNumber('')
    setEmail('')
    setOwnerName('')
    setOwnerIdentityProofName('')
    setOwnerIdentityProofDataUrl(undefined)
    setServiceTypes([])
    setSpecializations([])
    setVehicleTypes([])
    setMaxCapacity('')
    setOperationalDays([])
    setOperationalStartTime('')
    setOperationalEndTime('')
    setPricingScheme('Harga Nett')
    setPricingMethod('Per trip')
    setSupportsBidding(null)
    setLegalNibName('')
    setLegalNibDataUrl(undefined)
    setNpwpName('')
    setNpwpDataUrl(undefined)
    setFleetPhotos([])
    setOfficePhotoName('')
    setOfficePhotoDataUrl(undefined)
    setOfficeMapsLink('')
    setOfficeLocationSearch('')
    setLocationSuggestions([])
    setOfficeLatitude('')
    setOfficeLongitude('')
    setSlaResponse('')
    setInsuranceTerms('')
    setPackingFeeTerms('')
    setOtherFeesTerms('')
    setPaymentTerms('')
    setTaxTerms('')
    setTncAccepted(false)
    setInvalidField(null)
    setEditingVendorId(null)
  }

  function loadFormForEdit(v: (typeof vendorRegistrations)[number]) {
    setEditingVendorId(v.id)
    setCompanyName(v.companyName || '')
    setBusinessType(v.businessType || '')
    setEstablishedYear(v.establishedYear || '')
    setOriginCities(v.originCities || [])
    setDestinationCities(v.destinationCities || [])
    setPicName(v.picName || '')
    setWhatsappNumber(v.whatsappNumber || '')
    setEmail(v.email || '')
    setOwnerName(v.ownerName || '')
    setOwnerIdentityProofName(v.ownerIdentityProofName || '')
    setOwnerIdentityProofDataUrl(v.ownerIdentityProofDataUrl)
    setServiceTypes(v.serviceTypes || [])
    setSpecializations(v.specializations || [])
    setVehicleTypes(v.vehicleTypes || [])
    setMaxCapacity(v.maxCapacity || '')
    setOperationalDays(v.operationalDays || [])
    const [start, end] = (v.operationalHours || '').split(' - ')
    setOperationalStartTime(start || '')
    setOperationalEndTime(end || '')
    setPricingScheme(v.pricingScheme || 'Harga Nett')
    setPricingMethod(v.pricingMethod || 'Per trip')
    setSupportsBidding(typeof v.supportsBidding === 'boolean' ? v.supportsBidding : null)
    setLegalNibName(v.legalNibName || '')
    setLegalNibDataUrl(v.legalNibDataUrl)
    setNpwpName(v.npwpName || '')
    setNpwpDataUrl(v.npwpDataUrl)
    setFleetPhotos(v.fleetPhotos || [])
    setOfficePhotoName(v.officePhotoName || '')
    setOfficePhotoDataUrl(v.officePhotoDataUrl)
    setOfficeMapsLink(v.officeMapsLink || '')
    setOfficeLocationSearch(v.officeMapsLink || '')
    setOfficeLatitude(v.officeLatitude != null ? String(v.officeLatitude) : '')
    setOfficeLongitude(v.officeLongitude != null ? String(v.officeLongitude) : '')
    setSlaResponse(v.slaResponse || '')
    setInsuranceTerms(v.insuranceTerms || '')
    setPackingFeeTerms(v.packingFeeTerms || '')
    setOtherFeesTerms(v.otherFeesTerms || '')
    setPaymentTerms(v.paymentTerms || '')
    setTaxTerms(v.taxTerms || '')
    setTncAccepted(Boolean(v.tncAccepted))
    setError('')
    setSuccess('')
    setInvalidField(null)
    setViewMode('form')
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    const invalid = validate()
    if (invalid) {
      setError(invalid.message)
      setInvalidField(invalid.field)
      focusInvalidField(invalid.field)
      return
    }
    const payload = {
      id: editingVendorId || `v_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
      name: companyName.trim(),
      business_type: businessType as (typeof businessTypes)[number],
      established_year: establishedYear.trim() || null,
      origin_cities: originCities,
      destination_cities: destinationCities,
      pic_name: picName.trim(),
      whatsapp_number: whatsappNumber.trim(),
      email: email.trim(),
      owner_name: ownerName.trim(),
      owner_identity_proof_name: ownerIdentityProofName || null,
      owner_identity_proof_data_url: ownerIdentityProofDataUrl || null,
      service_types: serviceTypes,
      specializations,
      vehicle_types: vehicleTypes,
      max_capacity: maxCapacity.trim() || null,
      operational_days: operationalDays,
      operational_hours: `${operationalStartTime} - ${operationalEndTime}`,
      pricing_scheme: pricingScheme,
      pricing_method: pricingMethod,
      supports_bidding: Boolean(supportsBidding),
      legal_nib_name: legalNibName || null,
      legal_nib_data_url: legalNibDataUrl || null,
      npwp_name: npwpName || null,
      npwp_data_url: npwpDataUrl || null,
      fleet_photos: fleetPhotos,
      office_photo_name: officePhotoName,
      office_photo_data_url: officePhotoDataUrl || null,
      office_maps_link: officeMapsLink.trim(),
      office_latitude: officeLatitude ? Number(officeLatitude) : null,
      office_longitude: officeLongitude ? Number(officeLongitude) : null,
      sla_response: slaResponse.trim(),
      insurance_terms: insuranceTerms.trim(),
      packing_fee_terms: packingFeeTerms.trim(),
      other_fees_terms: otherFeesTerms.trim(),
      payment_terms: paymentTerms.trim(),
      tax_terms: taxTerms.trim(),
      tnc_accepted: tncAccepted,
    }
    const { error: upsertError } = await supabase.from('vendors').upsert(payload)
    if (upsertError) {
      const raw = upsertError.message || ''
      if (/401|unauthorized|invalid api key/i.test(raw)) {
        setError(
          'Supabase menolak request (401). Jalankan migration policy anon terbaru, lalu restart `npm run dev` agar env VITE terbaca ulang.',
        )
      } else {
        setError(raw)
      }
      return
    }
    const createdAt = new Date().toISOString()
    const mappedItem: VendorRegistration = {
      id: payload.id,
      companyName: payload.name,
      businessType: payload.business_type,
      establishedYear: payload.established_year || undefined,
      originCities: payload.origin_cities,
      destinationCities: payload.destination_cities,
      picName: payload.pic_name,
      whatsappNumber: payload.whatsapp_number,
      email: payload.email,
      ownerName: payload.owner_name,
      ownerIdentityProofName: payload.owner_identity_proof_name || undefined,
      ownerIdentityProofDataUrl: payload.owner_identity_proof_data_url || undefined,
      serviceTypes: payload.service_types,
      specializations: payload.specializations,
      vehicleTypes: payload.vehicle_types as VehicleType[],
      maxCapacity: payload.max_capacity || undefined,
      operationalDays: payload.operational_days,
      operationalHours: payload.operational_hours,
      pricingScheme: payload.pricing_scheme,
      pricingMethod: payload.pricing_method,
      supportsBidding: payload.supports_bidding,
      legalNibName: payload.legal_nib_name || undefined,
      legalNibDataUrl: payload.legal_nib_data_url || undefined,
      npwpName: payload.npwp_name || undefined,
      npwpDataUrl: payload.npwp_data_url || undefined,
      fleetPhotos: payload.fleet_photos as { name: string; dataUrl?: string }[],
      officePhotoName: payload.office_photo_name,
      officePhotoDataUrl: payload.office_photo_data_url || undefined,
      officeMapsLink: payload.office_maps_link,
      officeLatitude: payload.office_latitude ?? undefined,
      officeLongitude: payload.office_longitude ?? undefined,
      slaResponse: payload.sla_response,
      insuranceTerms: payload.insurance_terms,
      packingFeeTerms: payload.packing_fee_terms,
      otherFeesTerms: payload.other_fees_terms,
      paymentTerms: payload.payment_terms,
      taxTerms: payload.tax_terms,
      tncAccepted: payload.tnc_accepted,
      createdAt,
    }
    setVendorRegistrations((prev) => {
      const exists = prev.some((v) => v.id === mappedItem.id)
      if (exists) return prev.map((v) => (v.id === mappedItem.id ? { ...v, ...mappedItem } : v))
      return [mappedItem, ...prev]
    })
    resetForm()
    setViewMode('list')
  }

  useEffect(() => {
    const q = officeLocationSearch.trim()
    if (q.length < 3) {
      setLocationSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        setLocationLoading(true)
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`,
        )
        const data = (await res.json()) as MapSuggestion[]
        setLocationSuggestions(Array.isArray(data) ? data : [])
      } catch {
        setLocationSuggestions([])
      } finally {
        setLocationLoading(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [officeLocationSearch])

  if (view === 'list') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={() => setViewMode('form')}>
            Tambah
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {listLoading ? (
            <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3 text-slate-600">
              <Spinner className="h-7 w-7" />
              <p className="text-sm">Memuat daftar vendor...</p>
            </div>
          ) : vendorRegistrations.length === 0 ? (
            <Card className="text-center">
              <p className="text-sm font-semibold text-slate-900">Belum ada vendor</p>
              <p className="mt-1 text-sm text-slate-600">Klik tombol `Tambah` untuk membuat vendor pertama.</p>
            </Card>
          ) : (
            vendorRegistrations.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => loadFormForEdit(v)}
                className="text-left"
              >
                <Card className="text-left transition-transform active:scale-[0.99]">
                <p className="font-semibold text-slate-900">{v.companyName}</p>
                <p className="text-xs text-slate-600">
                  {v.businessType} · PIC {v.picName} · WA {v.whatsappNumber}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Origin: {v.originCities.join(', ')} | Destination: {v.destinationCities.join(', ')}
                </p>
                </Card>
              </button>
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="text-left">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {editingVendorId ? 'Edit Vendor' : 'Form Pendaftaran Vendor'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">Isi data vendor untuk onboarding internal admin.</p>
          </div>
        </div>
      </Card>

      <form ref={formRef} className="flex flex-col gap-4" onSubmit={onSubmit}>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {success && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}

        <Card className="text-left">
          <p className="text-sm font-semibold text-slate-900">Informasi Perusahaan</p>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Nama Perusahaan
            <input data-field="companyName" className={fieldClass('companyName')} value={companyName} onChange={(e) => { setCompanyName(e.target.value); clearInvalid('companyName') }} />
          </label>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Jenis Usaha
            <select data-field="businessType" className={fieldClass('businessType')} value={businessType} onChange={(e) => { setBusinessType(e.target.value as (typeof businessTypes)[number] | ''); clearInvalid('businessType') }}>
              <option value="">Pilih jenis usaha</option>
              {businessTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Tahun Berdiri (opsional)
            <input className={inputClass} inputMode="numeric" value={establishedYear} onChange={(e) => setEstablishedYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          </label>
          <div className="mt-3" data-field="originCities" tabIndex={-1}>
            <p className="text-sm font-medium text-slate-700">Kota Asal (Origin)</p>
            <CompactMultiSelect options={cityOptions} selected={originCities} onToggle={(city) => { toggle(setOriginCities, city); clearInvalid('originCities') }} placeholder="Pilih kota asal" hasError={invalidField === 'originCities'} onInteract={() => clearInvalid('originCities')} />
          </div>
          <div className="mt-3" data-field="destinationCities" tabIndex={-1}>
            <p className="text-sm font-medium text-slate-700">Kota Tujuan (Destination)</p>
            <CompactMultiSelect options={cityOptions} selected={destinationCities} onToggle={(city) => { toggle(setDestinationCities, city); clearInvalid('destinationCities') }} placeholder="Pilih kota tujuan" hasError={invalidField === 'destinationCities'} onInteract={() => clearInvalid('destinationCities')} />
          </div>
        </Card>

        <Card className="text-left">
          <p className="text-sm font-semibold text-slate-900">Kontak PIC & Owner</p>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Nama PIC
            <input data-field="picName" className={fieldClass('picName')} value={picName} onChange={(e) => { setPicName(e.target.value); clearInvalid('picName') }} />
          </label>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Nomor WhatsApp
            <input data-field="whatsappNumber" className={fieldClass('whatsappNumber')} inputMode="numeric" value={whatsappNumber} onChange={(e) => { setWhatsappNumber(e.target.value.replace(/\D/g, '')); clearInvalid('whatsappNumber') }} />
          </label>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Email
            <input data-field="email" className={fieldClass('email')} type="email" value={email} onChange={(e) => { setEmail(e.target.value); clearInvalid('email') }} />
          </label>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Nama Owner
            <input data-field="ownerName" className={fieldClass('ownerName')} value={ownerName} onChange={(e) => { setOwnerName(e.target.value); clearInvalid('ownerName') }} />
          </label>
          <div className="mt-3">
            <p className="text-sm font-medium text-slate-700">Bukti Identitas Owner (opsional)</p>
            <input ref={ownerProofRef} type="file" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setOwnerIdentityProofName(f.name); setOwnerIdentityProofDataUrl(await fileToDataUrl(f)) }} />
            <Button type="button" onClick={() => ownerProofRef.current?.click()} variant="secondary" size="sm" className={uploadButtonClass()}>
              {ownerIdentityProofName || 'Upload KTP / identitas lain'}
            </Button>
          </div>
        </Card>

        <Card className="text-left">
          <p className="text-sm font-semibold text-slate-900">Layanan & Spesialisasi</p>
          <div className="mt-3" data-field="serviceTypes" tabIndex={-1}>
            <p className="text-sm font-medium text-slate-700">Jenis Layanan</p>
            <CompactMultiSelect options={serviceTypeOptions} selected={serviceTypes} onToggle={(o) => { toggle(setServiceTypes, o); clearInvalid('serviceTypes') }} placeholder="Pilih jenis layanan" hasError={invalidField === 'serviceTypes'} onInteract={() => clearInvalid('serviceTypes')} />
          </div>
          <div className="mt-3" data-field="specializations" tabIndex={-1}>
            <p className="text-sm font-medium text-slate-700">Spesialisasi</p>
            <CompactMultiSelect options={specializationOptions} selected={specializations} onToggle={(o) => { toggle(setSpecializations, o); clearInvalid('specializations') }} placeholder="Pilih spesialisasi" hasError={invalidField === 'specializations'} onInteract={() => clearInvalid('specializations')} />
          </div>
          <div className="mt-3" data-field="vehicleTypes" tabIndex={-1}>
            <p className="text-sm font-medium text-slate-700">Jenis Kendaraan</p>
            <CompactMultiSelect options={vehicleOptions} selected={vehicleTypes} onToggle={(o) => { setVehicleTypes((prev) => prev.includes(o as VehicleType) ? prev.filter((x) => x !== o) : [...prev, o as VehicleType]); clearInvalid('vehicleTypes') }} placeholder="Pilih kendaraan" hasError={invalidField === 'vehicleTypes'} onInteract={() => clearInvalid('vehicleTypes')} />
          </div>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Kapasitas Maksimal (opsional)
            <input className={inputClass} value={maxCapacity} onChange={(e) => setMaxCapacity(e.target.value)} placeholder="Contoh: 10 ton" />
          </label>
        </Card>

        <Card className="text-left">
          <p className="text-sm font-semibold text-slate-900">Operasional</p>
          <div className="mt-3" data-field="operationalDays" tabIndex={-1}>
            <p className="text-sm font-medium text-slate-700">Hari Operasional</p>
            <CompactMultiSelect options={dayOptions} selected={operationalDays} onToggle={(d) => { toggle(setOperationalDays, d); clearInvalid('operationalDays') }} placeholder="Pilih hari operasional" hasError={invalidField === 'operationalDays'} onInteract={() => clearInvalid('operationalDays')} />
          </div>
          <div className="mt-3">
            <p className="text-sm font-medium text-slate-700">Jam Operasional</p>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-600">Mulai<input data-field="operationalStartTime" type="time" className={fieldClass('operationalStartTime')} value={operationalStartTime} onChange={(e) => { setOperationalStartTime(e.target.value); clearInvalid('operationalStartTime') }} /></label>
              <label className="text-xs text-slate-600">Selesai<input data-field="operationalEndTime" type="time" className={fieldClass('operationalEndTime')} value={operationalEndTime} onChange={(e) => { setOperationalEndTime(e.target.value); clearInvalid('operationalEndTime') }} /></label>
            </div>
          </div>
        </Card>

        <Card className="text-left">
          <p className="text-sm font-semibold text-slate-900">Harga & Skema</p>
          <label className="mt-3 block text-sm font-medium text-slate-700">Skema Harga<select className={inputClass} value={pricingScheme} onChange={(e) => setPricingScheme(e.target.value as (typeof pricingSchemes)[number])}>{pricingSchemes.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <label className="mt-3 block text-sm font-medium text-slate-700">Metode Penentuan Harga<select className={inputClass} value={pricingMethod} onChange={(e) => setPricingMethod(e.target.value as (typeof pricingMethods)[number])}>{pricingMethods.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <div className={`mt-3 rounded-lg p-1 ${invalidField === 'supportsBidding' ? 'border border-red-500 bg-red-50/30' : ''}`} data-field="supportsBidding" tabIndex={-1}>
            <p className="text-sm font-medium text-slate-700">Bersedia Sistem Bidding</p>
            <div className="mt-1 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-1">
              <span className={`px-2 text-sm font-medium ${supportsBidding === null ? 'text-slate-500' : 'text-slate-700'}`}>
                {supportsBidding === null ? 'Belum dipilih' : supportsBidding ? 'Ya' : 'Tidak'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={supportsBidding === true}
                onClick={() => {
                  const next = supportsBidding === null ? true : !supportsBidding
                  setSupportsBidding(next)
                  clearInvalid('supportsBidding')
                }}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${supportsBidding === true ? 'bg-accent' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${supportsBidding === true ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </Card>

        <Card className="text-left">
          <p className="text-sm font-semibold text-slate-900">Dokumen & Verifikasi</p>
          <div className="mt-3"><p className="text-sm font-medium text-slate-700">NIB / Legalitas (opsional)</p><input ref={nibRef} type="file" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setLegalNibName(f.name); setLegalNibDataUrl(await fileToDataUrl(f)) }} /><Button type="button" onClick={() => nibRef.current?.click()} variant="secondary" size="sm" className={uploadButtonClass()}>{legalNibName || 'Upload file legalitas'}</Button></div>
          <div className="mt-3"><p className="text-sm font-medium text-slate-700">NPWP (opsional)</p><input ref={npwpRef} type="file" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setNpwpName(f.name); setNpwpDataUrl(await fileToDataUrl(f)) }} /><Button type="button" onClick={() => npwpRef.current?.click()} variant="secondary" size="sm" className={uploadButtonClass()}>{npwpName || 'Upload file NPWP'}</Button></div>
          <div className="mt-3"><p className="text-sm font-medium text-slate-700">Foto Armada (opsional, multi)</p><input ref={fleetRef} type="file" multiple className="sr-only" onChange={async (e) => { const files = Array.from(e.target.files || []); if (files.length === 0) return; const mapped = await Promise.all(files.map(async (f) => ({ name: f.name, dataUrl: await fileToDataUrl(f) }))); setFleetPhotos(mapped) }} /><Button type="button" onClick={() => fleetRef.current?.click()} variant="secondary" size="sm" className={uploadButtonClass()}>{fleetPhotos.length > 0 ? `${fleetPhotos.length} file dipilih` : 'Upload foto armada'}</Button></div>
          <div className="mt-3" data-field="officePhoto" tabIndex={-1}><p className="text-sm font-medium text-slate-700">Foto Kantor (wajib)</p><input ref={officePhotoRef} type="file" accept="image/*" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; if (!f.type.startsWith('image/')) { setError('Foto kantor hanya menerima file gambar (jpg/png/webp).'); setInvalidField('officePhoto'); return } setOfficePhotoName(f.name); setOfficePhotoDataUrl(await fileToDataUrl(f)); clearInvalid('officePhoto') }} /><Button type="button" onClick={() => officePhotoRef.current?.click()} variant="secondary" size="sm" className={uploadButtonClass(invalidField === 'officePhoto')}>{officePhotoName || 'Upload foto kantor'}</Button></div>
          <label className="mt-3 block text-sm font-medium text-slate-700">Lokasi Kantor (Maps)
            <div className="relative mt-1">
              <input data-field="officeMapsLink" className={fieldClass('officeMapsLink')} value={officeLocationSearch} onChange={(e) => { const val = e.target.value; setOfficeLocationSearch(val); setOfficeMapsLink(val); clearInvalid('officeMapsLink') }} placeholder="Cari alamat/lokasi kantor..." />
              <button type="button" onClick={pickCurrentLocation} disabled={locating} aria-label="Deteksi lokasi saat ini" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-accent disabled:opacity-50">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                  <path d="M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7Z" stroke="currentColor" strokeWidth="2" />
                  <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>
            </div>
            {(locationLoading || locationSuggestions.length > 0) && (
              <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {locationLoading && <p className="px-3 py-2 text-xs text-slate-500">Mencari lokasi...</p>}
                {!locationLoading && locationSuggestions.length > 0 && (
                  <ul className="max-h-44 overflow-auto">
                    {locationSuggestions.map((s, idx) => (
                      <li key={`${s.lat}-${s.lon}-${idx}`}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            setOfficeLocationSearch(s.display_name)
                            setOfficeLatitude(Number(s.lat).toFixed(6))
                            setOfficeLongitude(Number(s.lon).toFixed(6))
                            setOfficeMapsLink(`https://maps.google.com/?q=${s.lat},${s.lon}`)
                            setLocationSuggestions([])
                            clearInvalid('officeMapsLink')
                          }}
                        >
                          {s.display_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-slate-600">Latitude<input className={inputClass} value={officeLatitude} onChange={(e) => setOfficeLatitude(e.target.value)} placeholder="-6.200000" /></label>
            <label className="text-xs font-medium text-slate-600">Longitude<input className={inputClass} value={officeLongitude} onChange={(e) => setOfficeLongitude(e.target.value)} placeholder="106.816666" /></label>
          </div>
          {(officeMapsLink || (officeLatitude && officeLongitude)) && (
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
              <iframe title="Pratinjau peta lokasi kantor" src={`https://maps.google.com/maps?q=${encodeURIComponent(officeLatitude && officeLongitude ? `${officeLatitude},${officeLongitude}` : officeMapsLink)}&z=14&output=embed`} className="h-44 w-full" loading="lazy" />
            </div>
          )}
        </Card>

        <Card className="text-left">
          <p className="text-sm font-semibold text-slate-900">Ketentuan & Komitmen</p>
          <label className="mt-3 block text-sm font-medium text-slate-700">SLA Respon<textarea data-field="slaResponse" className={`${fieldClass('slaResponse')} min-h-16 resize-none`} value={slaResponse} onChange={(e) => { setSlaResponse(e.target.value); clearInvalid('slaResponse') }} /></label>
          <label className="mt-3 block text-sm font-medium text-slate-700">Ketentuan Asuransi / Kerusakan<textarea data-field="insuranceTerms" className={`${fieldClass('insuranceTerms')} min-h-16 resize-none`} value={insuranceTerms} onChange={(e) => { setInsuranceTerms(e.target.value); clearInvalid('insuranceTerms') }} /></label>
          <label className="mt-3 block text-sm font-medium text-slate-700">Ketentuan Biaya Packing<textarea data-field="packingFeeTerms" className={`${fieldClass('packingFeeTerms')} min-h-16 resize-none`} value={packingFeeTerms} onChange={(e) => { setPackingFeeTerms(e.target.value); clearInvalid('packingFeeTerms') }} /></label>
          <label className="mt-3 block text-sm font-medium text-slate-700">Biaya Lain-lain<textarea data-field="otherFeesTerms" className={`${fieldClass('otherFeesTerms')} min-h-16 resize-none`} value={otherFeesTerms} onChange={(e) => { setOtherFeesTerms(e.target.value); clearInvalid('otherFeesTerms') }} /></label>
          <label className="mt-3 block text-sm font-medium text-slate-700">Ketentuan Pembayaran<textarea data-field="paymentTerms" className={`${fieldClass('paymentTerms')} min-h-16 resize-none`} value={paymentTerms} onChange={(e) => { setPaymentTerms(e.target.value); clearInvalid('paymentTerms') }} /></label>
          <label className="mt-3 block text-sm font-medium text-slate-700">Ketentuan Perpajakan<textarea data-field="taxTerms" className={`${fieldClass('taxTerms')} min-h-16 resize-none`} value={taxTerms} onChange={(e) => { setTaxTerms(e.target.value); clearInvalid('taxTerms') }} /></label>
          <label className={`mt-3 inline-flex items-start gap-2 text-sm ${invalidField === 'tncAccepted' ? 'rounded-md border border-red-500 bg-red-50/30 p-2 text-red-700' : 'text-slate-700'}`} data-field="tncAccepted" tabIndex={-1}>
            <input type="checkbox" checked={tncAccepted} onChange={(e) => { setTncAccepted(e.target.checked); clearInvalid('tncAccepted') }} className="mt-1" />
            Setuju Syarat & Ketentuan
          </label>
        </Card>

        <Button type="submit" variant="neutralDark" size="lg" fullWidth>
          {editingVendorId ? 'Simpan Perubahan' : 'Simpan Vendor'}
        </Button>
      </form>
    </div>
  )
}
