import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { useOnClickOutside } from '../../hooks/useOnClickOutside'
import { ui } from '../../lib/uiTokens'
import { supabase } from '../../lib/supabase'
import { isDisplayableImageUrl, uploadUserFile } from '../../lib/storageUpload'
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
type VendorFilters = {
  businessTypes: (typeof businessTypes)[number][]
  originCities: string[]
  destinationCities: string[]
  serviceTypes: string[]
  specializations: string[]
  vehicleTypes: VehicleType[]
  operationalDays: string[]
  active: Array<'active' | 'inactive'>
}

/** Tanpa kolom base64 / JSON berat — muat daftar jauh lebih cepat. Detail penuh diambil saat edit. */
const VENDOR_LIST_COLUMNS =
  'id,name,business_type,established_year,origin_cities,destination_cities,pic_name,whatsapp_number,email,owner_name,owner_identity_proof_name,service_types,specializations,vehicle_types,max_capacity,operational_days,operational_hours,pricing_scheme,pricing_method,supports_bidding,legal_nib_name,npwp_name,office_photo_name,office_maps_link,office_latitude,office_longitude,sla_response,insurance_terms,packing_fee_terms,other_fees_terms,payment_terms,tax_terms,tnc_accepted,is_active,created_at'

const VENDOR_PAGE_SIZE = 10

function escapeForIlike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** Koma memecah klausa `.or()` PostgREST — diganti spasi. */
function sanitizeVendorSearchInput(s: string): string {
  return s.replace(/,/g, ' ').trim()
}

function formatThousandDots(rawDigits: string): string {
  const d = rawDigits.replace(/\D/g, '')
  if (!d) return ''
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function mapVendorRowToRegistration(row: Record<string, unknown>): VendorRegistration {
  const fleetRaw = row.fleet_photos
  return {
    id: String(row.id),
    companyName: (row.name as string) || '',
    businessType: (row.business_type as VendorRegistration['businessType']) || 'CV',
    establishedYear: (row.established_year as string) || undefined,
    originCities: (row.origin_cities as string[]) || [],
    destinationCities: (row.destination_cities as string[]) || [],
    picName: (row.pic_name as string) || '',
    whatsappNumber: (row.whatsapp_number as string) || '',
    email: (row.email as string) || '',
    ownerName: (row.owner_name as string) || '',
    ownerIdentityProofName: (row.owner_identity_proof_name as string) || undefined,
    ownerIdentityProofDataUrl: (row.owner_identity_proof_data_url as string) || undefined,
    serviceTypes: (row.service_types as string[]) || [],
    specializations: (row.specializations as string[]) || [],
    vehicleTypes: (row.vehicle_types as VehicleType[]) || [],
    maxCapacity: (row.max_capacity as string) || undefined,
    operationalDays: (row.operational_days as string[]) || [],
    operationalHours: (row.operational_hours as string) || '',
    pricingScheme: (row.pricing_scheme as VendorRegistration['pricingScheme']) || 'Harga Nett',
    pricingMethod: (row.pricing_method as VendorRegistration['pricingMethod']) || 'Per trip',
    supportsBidding: Boolean(row.supports_bidding),
    legalNibName: (row.legal_nib_name as string) || undefined,
    legalNibDataUrl: (row.legal_nib_data_url as string) || undefined,
    npwpName: (row.npwp_name as string) || undefined,
    npwpDataUrl: (row.npwp_data_url as string) || undefined,
    fleetPhotos: Array.isArray(fleetRaw)
      ? (fleetRaw as { name: string; dataUrl?: string; url?: string }[]).map((x) => ({
          name: x.name,
          dataUrl: x.dataUrl ?? x.url,
        }))
      : [],
    officePhotoName: (row.office_photo_name as string) || '',
    officePhotoDataUrl: (row.office_photo_data_url as string) || undefined,
    officeMapsLink: (row.office_maps_link as string) || '',
    officeLatitude: row.office_latitude != null ? Number(row.office_latitude) : undefined,
    officeLongitude: row.office_longitude != null ? Number(row.office_longitude) : undefined,
    slaResponse: (row.sla_response as string) || '',
    insuranceTerms: (row.insurance_terms as string) || '',
    packingFeeTerms: (row.packing_fee_terms as string) || '',
    otherFeesTerms: (row.other_fees_terms as string) || '',
    paymentTerms: (row.payment_terms as string) || '',
    taxTerms: (row.tax_terms as string) || '',
    tncAccepted: Boolean(row.tnc_accepted),
    isActive: row.is_active !== false,
    createdAt: (row.created_at as string) || new Date().toISOString(),
  }
}

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
  | 'pricingScheme'
  | 'pricingMethod'

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
  const detailsRef = useRef<HTMLDetailsElement>(null)
  useOnClickOutside(detailsRef, () => {
    const d = detailsRef.current
    if (d) d.open = false
  })

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
  const allSelected = filtered.length > 0 && filtered.every((option) => selected.includes(option))

  return (
    <details ref={detailsRef} className="group mt-1 relative" onToggle={onInteract}>
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
        <div className="mb-2 flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
          <span>Centang untuk memilih</span>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => {
                filtered.forEach((option) => {
                  const has = selected.includes(option)
                  if (allSelected ? has : !has) onToggle(option)
                })
                onInteract?.()
              }}
              className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
            />
            Pilih semua
          </label>
        </div>
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
        {filtered.length > 5 && (
          <p className="mt-2 text-center text-[11px] text-slate-400">Gulir ke bawah untuk opsi lainnya</p>
        )}
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
  const officeLocationContainerRef = useRef<HTMLDivElement>(null)

  const [view, setView] = useState<'list' | 'form'>('list')
  const [vendorRegistrations, setVendorRegistrations] = useState<VendorRegistration[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listLoadingMore, setListLoadingMore] = useState(false)
  const [vendorSearchInput, setVendorSearchInput] = useState('')
  const [vendorSearchDebounced, setVendorSearchDebounced] = useState('')
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [vendorFilters, setVendorFilters] = useState<VendorFilters>({
    businessTypes: [],
    originCities: [],
    destinationCities: [],
    serviceTypes: [],
    specializations: [],
    vehicleTypes: [],
    operationalDays: [],
    active: [],
  })
  const [vendorNextPage, setVendorNextPage] = useState(0)
  const [vendorHasMore, setVendorHasMore] = useState(true)
  const [vendorTotalCount, setVendorTotalCount] = useState<number | null>(null)
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null)
  const [detailLoading, setDetailLoading] = useState(false)
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
  const [pricingScheme, setPricingScheme] = useState<(typeof pricingSchemes)[number] | ''>('')
  const [pricingMethod, setPricingMethod] = useState<(typeof pricingMethods)[number] | ''>('')
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
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saveSubmitting, setSaveSubmitting] = useState(false)
  const [vendorFileBusy, setVendorFileBusy] = useState(false)

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
    const t = setTimeout(() => setVendorSearchDebounced(vendorSearchInput), 400)
    return () => clearTimeout(t)
  }, [vendorSearchInput])

  const fetchVendorsPage = useCallback(
    async (pageIndex: number, searchQ: string, filters: VendorFilters) => {
      const from = pageIndex * VENDOR_PAGE_SIZE
      const to = from + VENDOR_PAGE_SIZE - 1
      let qb = supabase
        .from('vendors')
        .select(VENDOR_LIST_COLUMNS, { count: 'exact' })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to)
      const raw = sanitizeVendorSearchInput(searchQ)
      if (raw.length > 0) {
        const esc = escapeForIlike(raw)
        const p = `%${esc}%`
        qb = qb.or(`name.ilike.${p},email.ilike.${p},whatsapp_number.ilike.${p},pic_name.ilike.${p}`)
      }
      if (filters.businessTypes.length > 0) qb = qb.in('business_type', filters.businessTypes)
      if (filters.originCities.length > 0) qb = qb.overlaps('origin_cities', filters.originCities)
      if (filters.destinationCities.length > 0) qb = qb.overlaps('destination_cities', filters.destinationCities)
      if (filters.serviceTypes.length > 0) qb = qb.overlaps('service_types', filters.serviceTypes)
      if (filters.specializations.length > 0) qb = qb.overlaps('specializations', filters.specializations)
      if (filters.vehicleTypes.length > 0) qb = qb.overlaps('vehicle_types', filters.vehicleTypes)
      if (filters.operationalDays.length > 0) qb = qb.overlaps('operational_days', filters.operationalDays)
      if (filters.active.includes('active') && !filters.active.includes('inactive')) qb = qb.eq('is_active', true)
      if (filters.active.includes('inactive') && !filters.active.includes('active')) qb = qb.eq('is_active', false)
      return qb
    },
    [],
  )

  const reloadVendorList = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setListLoading(true)
      setError('')
      setVendorHasMore(true)
      setVendorNextPage(0)
      try {
        const { data, error: loadError, count } = await fetchVendorsPage(0, vendorSearchDebounced, vendorFilters)
        if (loadError) {
          setError(loadError.message)
          setVendorRegistrations([])
          setVendorHasMore(false)
          setVendorTotalCount(null)
          return
        }
        const mapped = (data || []).map((row) => mapVendorRowToRegistration(row as Record<string, unknown>))
        setVendorRegistrations(mapped)
        setVendorTotalCount(typeof count === 'number' ? count : null)
        setVendorHasMore((data?.length ?? 0) === VENDOR_PAGE_SIZE)
        setVendorNextPage(1)
      } finally {
        if (!opts?.silent) setListLoading(false)
      }
    },
    [fetchVendorsPage, vendorSearchDebounced, vendorFilters],
  )

  useEffect(() => {
    void reloadVendorList()
  }, [reloadVendorList])

  const loadMoreVendors = useCallback(async () => {
    if (listLoadingMore || !vendorHasMore || listLoading) return
    setListLoadingMore(true)
    setError('')
    try {
      const { data, error: loadError } = await fetchVendorsPage(
        vendorNextPage,
        vendorSearchDebounced,
        vendorFilters,
      )
      if (loadError) {
        setError(loadError.message)
        return
      }
      const rows = data || []
      if (rows.length === 0) {
        setVendorHasMore(false)
        return
      }
      const mapped = rows.map((row) => mapVendorRowToRegistration(row as Record<string, unknown>))
      setVendorRegistrations((prev) => [...prev, ...mapped])
      setVendorHasMore(rows.length === VENDOR_PAGE_SIZE)
      setVendorNextPage((p) => p + 1)
    } finally {
      setListLoadingMore(false)
    }
  }, [
    fetchVendorsPage,
    vendorNextPage,
    vendorSearchDebounced,
    vendorFilters,
    vendorHasMore,
    listLoadingMore,
    listLoading,
  ])

  useEffect(() => {
    if (view !== 'list') return
    const el = loadMoreSentinelRef.current
    if (!el) return
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMoreVendors()
      },
      { root: null, rootMargin: '240px', threshold: 0 },
    )
    ob.observe(el)
    return () => ob.disconnect()
  }, [view, loadMoreVendors, vendorRegistrations.length, vendorHasMore])

  useOnClickOutside(
    officeLocationContainerRef,
    () => {
      setLocationSuggestions([])
      setLocationLoading(false)
    },
    locationLoading || locationSuggestions.length > 0,
  )

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
      pricingScheme: '[data-field="pricingScheme"]',
      pricingMethod: '[data-field="pricingMethod"]',
    }
    const node = formRef.current.querySelector<HTMLElement>(selectorMap[field])
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    node?.focus?.()
  }

  async function uploadVendorAsset(file: File, segment: string): Promise<string | undefined> {
    setError('')
    const res = await uploadUserFile(`vendors/${segment}`, file)
    if ('error' in res) {
      setError(res.error)
      return undefined
    }
    return res.url
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
    if (!pricingScheme) return { field: 'pricingScheme', message: 'Skema harga wajib dipilih.' }
    if (!pricingMethod) return { field: 'pricingMethod', message: 'Metode penentuan harga wajib dipilih.' }
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
    setPricingScheme('')
    setPricingMethod('')
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
    setIsActive(true)
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
    setMaxCapacity((v.maxCapacity || '').replace(/\D/g, ''))
    setOperationalDays(v.operationalDays || [])
    const [start, end] = (v.operationalHours || '').split(' - ')
    setOperationalStartTime(start || '')
    setOperationalEndTime(end || '')
    setPricingScheme(
      v.pricingScheme && pricingSchemes.includes(v.pricingScheme as (typeof pricingSchemes)[number])
        ? v.pricingScheme
        : '',
    )
    setPricingMethod(
      v.pricingMethod && pricingMethods.includes(v.pricingMethod as (typeof pricingMethods)[number])
        ? v.pricingMethod
        : '',
    )
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
    setIsActive(v.isActive !== false)
    setError('')
    setSuccess('')
    setInvalidField(null)
    setViewMode('form')
  }

  async function beginEditVendor(vendorId: string) {
    setDetailLoading(true)
    setError('')
    try {
      const { data, error: loadError } = await supabase.from('vendors').select('*').eq('id', vendorId).maybeSingle()
      if (loadError || !data) {
        setError(loadError?.message || 'Vendor tidak ditemukan.')
        return
      }
      loadFormForEdit(mapVendorRowToRegistration(data as Record<string, unknown>))
    } finally {
      setDetailLoading(false)
    }
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
    const emailLower = email.trim().toLowerCase()
    const whatsappTrimmed = whatsappNumber.trim()
    let qEmail = supabase.from('vendors').select('id').ilike('email', emailLower).limit(1)
    if (editingVendorId) qEmail = qEmail.neq('id', editingVendorId)
    let qWa = supabase.from('vendors').select('id').eq('whatsapp_number', whatsappTrimmed).limit(1)
    if (editingVendorId) qWa = qWa.neq('id', editingVendorId)
    const [emailRes, waRes] = await Promise.all([qEmail.maybeSingle(), qWa.maybeSingle()])
    if (emailRes.data?.id) {
      setError('Email ini sudah terdaftar pada vendor lain. Gunakan email yang berbeda.')
      setInvalidField('email')
      focusInvalidField('email')
      return
    }
    if (waRes.data?.id) {
      setError('Nomor WhatsApp ini sudah terdaftar pada vendor lain.')
      setInvalidField('whatsappNumber')
      focusInvalidField('whatsappNumber')
      return
    }
    setSaveSubmitting(true)
    try {
    const payload = {
      id: editingVendorId || `v_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
      name: companyName.trim(),
      business_type: businessType as (typeof businessTypes)[number],
      established_year: establishedYear.trim() || null,
      origin_cities: originCities,
      destination_cities: destinationCities,
      pic_name: picName.trim(),
      whatsapp_number: whatsappTrimmed,
      email: emailLower,
      owner_name: ownerName.trim(),
      owner_identity_proof_name: ownerIdentityProofName || null,
      owner_identity_proof_data_url: ownerIdentityProofDataUrl || null,
      service_types: serviceTypes,
      specializations,
      vehicle_types: vehicleTypes,
      max_capacity: maxCapacity.replace(/\D/g, '') || null,
      operational_days: operationalDays,
      operational_hours: `${operationalStartTime} - ${operationalEndTime}`,
      pricing_scheme: pricingScheme as (typeof pricingSchemes)[number],
      pricing_method: pricingMethod as (typeof pricingMethods)[number],
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
      is_active: isActive,
    }
      const { error: upsertError } = await supabase.from('vendors').upsert(payload)
      if (upsertError) {
        const raw = upsertError.message || ''
        const code = 'code' in upsertError ? String((upsertError as { code?: string }).code) : ''
        if (code === '23505' || /duplicate key|unique constraint/i.test(raw)) {
          setError(
            'Email atau nomor WhatsApp sudah dipakai vendor lain (validasi database). Sesuaikan kontak atau edit vendor yang ada.',
          )
          return
        }
        if (/401|unauthorized|invalid api key/i.test(raw)) {
          setError(
            'Supabase menolak request (401). Jalankan migration policy anon terbaru, lalu restart `npm run dev` agar env VITE terbaca ulang.',
          )
        } else {
          setError(raw)
        }
        return
      }
      setSuccess(`Data vendor "${payload.name}" disimpan.`)
      await reloadVendorList({ silent: true })
      resetForm()
      setViewMode('list')
    } finally {
      setSaveSubmitting(false)
    }
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
    const searchActive = vendorSearchDebounced.trim().length > 0
    const activeFilterCount = Object.values(vendorFilters).reduce(
      (n, v) => n + (Array.isArray(v) ? (v.length > 0 ? 1 : 0) : 0),
      0,
    )
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <label className="block text-xs font-medium text-slate-600">Cari vendor</label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                className="flex-1"
                value={vendorSearchInput}
                onChange={(e) => setVendorSearchInput(e.target.value)}
                placeholder="Nama, email, WhatsApp, atau PIC…"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setFilterModalOpen(true)}
                className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:text-accent"
                aria-label="Buka filter vendor"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
                  <path
                    d="M3 6h18M7 12h10M10 18h4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {activeFilterCount > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
            {!listLoading && (
              <p className="mt-2 text-sm font-medium text-slate-700">
                {vendorTotalCount != null
                  ? `Menampilkan ${vendorRegistrations.length} dari ${vendorTotalCount} vendor${searchActive ? ' (hasil pencarian)' : ''}`
                  : `Dimuat: ${vendorRegistrations.length} vendor`}
                {vendorHasMore ? ' · Gulir ke bawah untuk memuat lebih banyak' : ''}
              </p>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            disabled={detailLoading}
            onClick={() => {
              resetForm()
              setViewMode('form')
            }}
          >
            Tambah
          </Button>
        </div>
        {filterModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30 px-4 pb-4 sm:items-center">
            <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Filter vendor</p>
                <button
                  type="button"
                  onClick={() => setFilterModalOpen(false)}
                  className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                  aria-label="Tutup filter"
                >
                  ×
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-slate-600">Jenis usaha</p>
                  <CompactMultiSelect
                    options={businessTypes}
                    selected={vendorFilters.businessTypes}
                    onToggle={(v) => setVendorFilters((p) => ({ ...p, businessTypes: p.businessTypes.includes(v as (typeof businessTypes)[number]) ? p.businessTypes.filter((x) => x !== v) : [...p.businessTypes, v as (typeof businessTypes)[number]] }))}
                    placeholder="Semua"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600">Kota asal</p>
                  <CompactMultiSelect options={cityOptions} selected={vendorFilters.originCities} onToggle={(v) => setVendorFilters((p) => ({ ...p, originCities: p.originCities.includes(v) ? p.originCities.filter((x) => x !== v) : [...p.originCities, v] }))} placeholder="Semua" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600">Kota tujuan</p>
                  <CompactMultiSelect options={cityOptions} selected={vendorFilters.destinationCities} onToggle={(v) => setVendorFilters((p) => ({ ...p, destinationCities: p.destinationCities.includes(v) ? p.destinationCities.filter((x) => x !== v) : [...p.destinationCities, v] }))} placeholder="Semua" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600">Jenis layanan</p>
                  <CompactMultiSelect options={serviceTypeOptions} selected={vendorFilters.serviceTypes} onToggle={(v) => setVendorFilters((p) => ({ ...p, serviceTypes: p.serviceTypes.includes(v) ? p.serviceTypes.filter((x) => x !== v) : [...p.serviceTypes, v] }))} placeholder="Semua" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600">Spesialisasi</p>
                  <CompactMultiSelect options={specializationOptions} selected={vendorFilters.specializations} onToggle={(v) => setVendorFilters((p) => ({ ...p, specializations: p.specializations.includes(v) ? p.specializations.filter((x) => x !== v) : [...p.specializations, v] }))} placeholder="Semua" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600">Jenis kendaraan</p>
                  <CompactMultiSelect options={vehicleOptions} selected={vendorFilters.vehicleTypes} onToggle={(v) => setVendorFilters((p) => ({ ...p, vehicleTypes: p.vehicleTypes.includes(v as VehicleType) ? p.vehicleTypes.filter((x) => x !== v) : [...p.vehicleTypes, v as VehicleType] }))} placeholder="Semua" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600">Hari operasional</p>
                  <CompactMultiSelect options={dayOptions} selected={vendorFilters.operationalDays} onToggle={(v) => setVendorFilters((p) => ({ ...p, operationalDays: p.operationalDays.includes(v) ? p.operationalDays.filter((x) => x !== v) : [...p.operationalDays, v] }))} placeholder="Semua" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600">Status vendor</p>
                  <CompactMultiSelect options={['active', 'inactive']} selected={vendorFilters.active} onToggle={(v) => setVendorFilters((p) => ({ ...p, active: p.active.includes(v as 'active' | 'inactive') ? p.active.filter((x) => x !== v) : [...p.active, v as 'active' | 'inactive'] }))} placeholder="Semua" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => setVendorFilters({ businessTypes: [], originCities: [], destinationCities: [], serviceTypes: [], specializations: [], vehicleTypes: [], operationalDays: [], active: [] })}>
                  Reset
                </Button>
                <Button type="button" size="sm" className="flex-1" onClick={() => setFilterModalOpen(false)}>
                  Terapkan
                </Button>
              </div>
            </div>
          </div>
        )}
        {detailLoading && (
          <Card className="flex items-center gap-3 py-4">
            <Spinner className="h-6 w-6 shrink-0" />
            <p className="text-sm text-slate-700">Memuat data vendor untuk diedit…</p>
          </Card>
        )}
        <div className="flex flex-col gap-3">
          {listLoading ? (
            <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3 text-slate-600">
              <Spinner className="h-7 w-7" />
              <p className="text-sm">Memuat daftar vendor...</p>
            </div>
          ) : vendorRegistrations.length === 0 ? (
            <Card className="text-center">
              <p className="text-sm font-semibold text-slate-900">
                {searchActive ? 'Tidak ada vendor yang cocok' : 'Belum ada vendor'}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {searchActive
                  ? 'Ubah kata kunci pencarian atau kosongkan kolom cari.'
                  : 'Klik tombol `Tambah` untuk membuat vendor pertama.'}
              </p>
            </Card>
          ) : (
            <>
              {vendorRegistrations.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  disabled={detailLoading}
                  onClick={() => void beginEditVendor(v.id)}
                  className="text-left disabled:opacity-50"
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
              ))}
              <div ref={loadMoreSentinelRef} className="h-4 w-full shrink-0" aria-hidden />
              {listLoadingMore && (
                <div className="flex justify-center py-4 text-slate-600">
                  <Spinner className="h-6 w-6" />
                </div>
              )}
            </>
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
            <input
              ref={ownerProofRef}
              type="file"
              accept="image/*"
              disabled={vendorFileBusy}
              className="sr-only"
              onChange={(e) => {
                void (async () => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  setVendorFileBusy(true)
                  const url = await uploadVendorAsset(f, 'owner-id')
                  setVendorFileBusy(false)
                  if (url) {
                    setOwnerIdentityProofName(f.name)
                    setOwnerIdentityProofDataUrl(url)
                  }
                  e.target.value = ''
                })()
              }}
            />
            <div className="mt-1 flex flex-wrap items-center gap-3">
              {ownerIdentityProofDataUrl && isDisplayableImageUrl(ownerIdentityProofDataUrl) && (
                <img
                  src={ownerIdentityProofDataUrl}
                  alt="Pratinjau identitas owner"
                  className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 object-cover"
                />
              )}
              <Button
                type="button"
                disabled={vendorFileBusy}
                onClick={() => ownerProofRef.current?.click()}
                variant="secondary"
                size="sm"
                className={`${uploadButtonClass()} flex-1`}
              >
                {ownerIdentityProofName || 'Upload KTP / identitas lain'}
              </Button>
            </div>
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
            Kapasitas maksimal (opsional)
            <input
              className={inputClass}
              inputMode="numeric"
              value={formatThousandDots(maxCapacity)}
              onChange={(e) => setMaxCapacity(e.target.value.replace(/\D/g, ''))}
              placeholder="Contoh: 5000"
            />
            <span className="mt-1 block text-xs text-slate-500">Angka di atas berarti berat muatan maksimal dalam kilogram (kg).</span>
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
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Skema harga
            <select
              data-field="pricingScheme"
              className={fieldClass('pricingScheme')}
              value={pricingScheme}
              onChange={(e) => {
                setPricingScheme(e.target.value as (typeof pricingSchemes)[number] | '')
                clearInvalid('pricingScheme')
              }}
            >
              <option value="">Pilih skema harga</option>
              {pricingSchemes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Metode penentuan harga
            <select
              data-field="pricingMethod"
              className={fieldClass('pricingMethod')}
              value={pricingMethod}
              onChange={(e) => {
                setPricingMethod(e.target.value as (typeof pricingMethods)[number] | '')
                clearInvalid('pricingMethod')
              }}
            >
              <option value="">Pilih metode</option>
              {pricingMethods.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
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
          <div className="mt-3">
            <p className="text-sm font-medium text-slate-700">NIB / Legalitas (opsional)</p>
            <input
              ref={nibRef}
              type="file"
              accept="image/*,.pdf,application/pdf"
              disabled={vendorFileBusy}
              className="sr-only"
              onChange={(e) => {
                void (async () => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  setVendorFileBusy(true)
                  const url = await uploadVendorAsset(f, 'legal-nib')
                  setVendorFileBusy(false)
                  if (url) {
                    setLegalNibName(f.name)
                    setLegalNibDataUrl(url)
                  }
                  e.target.value = ''
                })()
              }}
            />
            <Button
              type="button"
              disabled={vendorFileBusy}
              onClick={() => nibRef.current?.click()}
              variant="secondary"
              size="sm"
              className={uploadButtonClass()}
            >
              {legalNibName || 'Upload file legalitas'}
            </Button>
          </div>
          <div className="mt-3">
            <p className="text-sm font-medium text-slate-700">NPWP (opsional)</p>
            <input
              ref={npwpRef}
              type="file"
              accept="image/*,.pdf,application/pdf"
              disabled={vendorFileBusy}
              className="sr-only"
              onChange={(e) => {
                void (async () => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  setVendorFileBusy(true)
                  const url = await uploadVendorAsset(f, 'npwp')
                  setVendorFileBusy(false)
                  if (url) {
                    setNpwpName(f.name)
                    setNpwpDataUrl(url)
                  }
                  e.target.value = ''
                })()
              }}
            />
            <Button
              type="button"
              disabled={vendorFileBusy}
              onClick={() => npwpRef.current?.click()}
              variant="secondary"
              size="sm"
              className={uploadButtonClass()}
            >
              {npwpName || 'Upload file NPWP'}
            </Button>
          </div>
          <div className="mt-3">
            <p className="text-sm font-medium text-slate-700">Foto Armada (opsional, multi)</p>
            <input
              ref={fleetRef}
              type="file"
              multiple
              accept="image/*"
              disabled={vendorFileBusy}
              className="sr-only"
              onChange={(e) => {
                void (async () => {
                  const files = Array.from(e.target.files || [])
                  if (files.length === 0) return
                  setVendorFileBusy(true)
                  const added: { name: string; dataUrl?: string }[] = []
                  for (const f of files) {
                    if (!f.type.startsWith('image/')) {
                      setError('Foto armada hanya gambar (jpg/png/webp).')
                      break
                    }
                    const url = await uploadVendorAsset(f, 'fleet')
                    if (!url) break
                    added.push({ name: f.name, dataUrl: url })
                  }
                  setVendorFileBusy(false)
                  if (added.length) setFleetPhotos((prev) => [...prev, ...added])
                  e.target.value = ''
                })()
              }}
            />
            <Button
              type="button"
              disabled={vendorFileBusy}
              onClick={() => fleetRef.current?.click()}
              variant="secondary"
              size="sm"
              className={uploadButtonClass()}
            >
              {fleetPhotos.length > 0 ? `${fleetPhotos.length} file dipilih` : 'Upload foto armada'}
            </Button>
          </div>
          <div className="mt-3" data-field="officePhoto" tabIndex={-1}>
            <p className="text-sm font-medium text-slate-700">Foto Kantor (wajib)</p>
            <input
              ref={officePhotoRef}
              type="file"
              accept="image/*"
              disabled={vendorFileBusy}
              className="sr-only"
              onChange={(e) => {
                void (async () => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  if (!f.type.startsWith('image/')) {
                    setError('Foto kantor hanya menerima file gambar (jpg/png/webp).')
                    setInvalidField('officePhoto')
                    e.target.value = ''
                    return
                  }
                  setVendorFileBusy(true)
                  const url = await uploadVendorAsset(f, 'office')
                  setVendorFileBusy(false)
                  if (url) {
                    setOfficePhotoName(f.name)
                    setOfficePhotoDataUrl(url)
                    clearInvalid('officePhoto')
                  }
                  e.target.value = ''
                })()
              }}
            />
            <Button
              type="button"
              disabled={vendorFileBusy}
              onClick={() => officePhotoRef.current?.click()}
              variant="secondary"
              size="sm"
              className={uploadButtonClass(invalidField === 'officePhoto')}
            >
              {officePhotoName || 'Upload foto kantor'}
            </Button>
          </div>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Lokasi Kantor (Maps)
            <div ref={officeLocationContainerRef} className="mt-1">
              <div className="relative">
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
            </div>
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

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-card)] text-left">
          <p className="text-sm font-semibold text-slate-900">Status Vendor</p>
          <div className="mt-2 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-1">
            <span className={`px-2 text-sm font-medium ${isActive ? 'text-emerald-700' : 'text-slate-500'}`}>
              {isActive ? 'Aktif' : 'Nonaktif'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive((v) => !v)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
        <Button type="submit" variant="neutralDark" size="lg" fullWidth disabled={saveSubmitting || vendorFileBusy}>
          {saveSubmitting ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Spinner className="h-5 w-5" />
              Menyimpan…
            </span>
          ) : editingVendorId ? (
            'Simpan Perubahan'
          ) : (
            'Simpan Vendor'
          )}
        </Button>
      </form>

      {saveSubmitting && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-white/85 backdrop-blur-[2px] px-6">
          <Spinner className="h-10 w-10 text-slate-700" />
          <p className="text-center text-sm font-medium text-slate-800">Menyimpan vendor…</p>
          <p className="text-center text-xs text-slate-500">Mohon tunggu, Anda akan diarahkan ke daftar vendor.</p>
        </div>
      )}
    </div>
  )
}
