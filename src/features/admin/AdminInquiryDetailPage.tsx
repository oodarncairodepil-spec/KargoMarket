import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../../components/Badge'
import { InquiryRequestSummary } from '../../components/InquiryRequestSummary'
import { Button } from '../../components/ui/Button'
import { SectionCard } from '../../components/ui/SectionCard'
import { ui } from '../../lib/uiTokens'
import { apiClient } from '../../lib/apiClient'
import { formatIDR } from '../../lib/format'
import {
  formatIdrThousandsFromDigits,
  sanitizeIdrDigits,
} from '../../lib/inquiryFormHelpers'
import { inquiryStatusBadgeVariant, inquiryStatusLabel } from '../../lib/inquiryStatus'
import { VEHICLE_TYPES } from '../../lib/inquiryServiceOptions'
import { getVendorById } from '../../lib/matchVendors'
import { uploadUserFile } from '../../lib/storageUpload'
import { supabase } from '../../lib/supabase'
import type { Inquiry, QuoteSubmitPayload, VehicleType, VendorQuote } from '../../types/models'

const inputClass = `mt-1 ${ui.form.input.compact}`

type AdminInquiryDetail = Inquiry & { customerName?: string }

type VendorTokenInfo = {
  token: string
  vendorId: string
  lastBroadcastSentAt?: string | null
  vendorName?: string | null
  originCities?: string[]
  destinationCities?: string[]
  serviceAreas?: string[]
}

type RouteVendorProfile = {
  id: string
  name: string
  originCities: string[]
  destinationCities: string[]
  serviceAreas: string[]
}

type AdminDetailResponse = {
  inquiry?: AdminInquiryDetail
  quotes?: VendorQuote[]
  tokens?: VendorTokenInfo[]
}

function vendorQuoteUrl(token: string) {
  if (typeof window === 'undefined') return `/vendor/quote/${token}`
  return `${window.location.origin}/vendor/quote/${token}`
}

function formatBroadcastDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const VENDOR_QUOTE_FILTER_ALL = 'all' as const
const VENDOR_QUOTE_FILTER_RESPONDED = 'responded' as const
const VENDOR_QUOTE_FILTER_PENDING = 'pending' as const

type VendorQuoteFilter =
  | typeof VENDOR_QUOTE_FILTER_ALL
  | typeof VENDOR_QUOTE_FILTER_RESPONDED
  | typeof VENDOR_QUOTE_FILTER_PENDING

const INQUIRY_STATUSES: Inquiry['status'][] = [
  'awaiting_quotes',
  'quotes_ready',
  'vendor_selected',
  'awaiting_payment',
  'paid',
  'payment_confirmed',
  'in_transit',
  'cancelled',
  'completed',
]

function normalizeArea(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

/** Samakan label BPS/geo ("Kota Adm. Jakarta Timur") dengan label ringkas ("Kota Jakarta Timur"). */
function normalizeCityLabelForMatch(s: string): string {
  let t = normalizeArea(s)
  // "Kota Adm. X" / "Kab. Adm." → "kota x" agar cocok dengan data inquiry tanpa "Adm."
  t = t.replace(/\b(kota|kab\.?|kabupaten)\s+adm\.?\s+/gi, '$1 ')
  t = t.replace(/\s+/g, ' ').trim()
  return t
}

function stripKotaKabPrefix(s: string): string {
  return s.replace(/^(kota|kabupaten|kab\.)\s+/i, '').trim()
}

/** Apakah satu baris kota vendor (boleh "Kota, Provinsi") cocok dengan fragmen inquiry. */
function vendorCityLineMatchesInquiryFragment(vendorLine: string, inquiryFragment: string): boolean {
  const vFull = normalizeCityLabelForMatch(vendorLine)
  const iFrag = normalizeCityLabelForMatch(inquiryFragment)
  if (!vFull || !iFrag) return false

  const vCityOnly = vFull.split(',')[0].trim()

  if (vFull.includes(iFrag) || iFrag.includes(vFull)) return true
  if (vCityOnly.includes(iFrag) || iFrag.includes(vCityOnly)) return true

  const vCore = stripKotaKabPrefix(vCityOnly)
  const iCore = stripKotaKabPrefix(iFrag)
  if (vCore && iCore && (vCore === iCore || vCore.includes(iCore) || iCore.includes(vCore))) return true

  return false
}

function routeAreaCandidates(inquiry: AdminInquiryDetail, kind: 'origin' | 'destination'): string[] {
  const values =
    kind === 'origin'
      ? [inquiry.pickup, inquiry.pickupKota, inquiry.pickupProvince]
      : [inquiry.destination, inquiry.destinationKota, inquiry.destinationProvince]
  return values.map(normalizeArea).filter(Boolean)
}

function listMatchesRoute(list: string[], candidates: string[]): boolean {
  if (list.length === 0) return false
  if (candidates.length === 0) return true
  return list.some((vendorLine) =>
    candidates.some((inquiryPart) => vendorCityLineMatchesInquiryFragment(vendorLine, inquiryPart)),
  )
}

function supportsNationalCoverage(list: string[]): boolean {
  const normalized = list.map(normalizeArea)
  return normalized.some(
    (entry) => entry.includes('indonesia') || entry.includes('nasional') || entry.includes('lintas pulau'),
  )
}

type VendorRouteCoverage = {
  originCities?: string[]
  destinationCities?: string[]
  serviceAreas?: string[]
}

function vendorSupportsRoute(vendorId: string, inquiry: AdminInquiryDetail, profile?: VendorRouteCoverage): boolean {
  const originCandidates = routeAreaCandidates(inquiry, 'origin')
  const destinationCandidates = routeAreaCandidates(inquiry, 'destination')

  const originCities = Array.isArray(profile?.originCities) ? profile.originCities : []
  const destinationCities = Array.isArray(profile?.destinationCities) ? profile.destinationCities : []
  const hasStructuredCoverage = originCities.length > 0 || destinationCities.length > 0

  if (hasStructuredCoverage) {
    const originOk = originCities.length === 0 ? true : listMatchesRoute(originCities, originCandidates)
    const destinationOk =
      destinationCities.length === 0 ? true : listMatchesRoute(destinationCities, destinationCandidates)
    return originOk && destinationOk
  }

  const fallbackAreas = Array.isArray(profile?.serviceAreas) ? profile.serviceAreas : []
  const fallbackVendor = getVendorById(vendorId)
  const areas =
    fallbackAreas.length > 0 ? fallbackAreas : fallbackVendor?.serviceAreas ? [...fallbackVendor.serviceAreas] : []
  if (areas.length === 0) return false
  if (supportsNationalCoverage(areas)) return true
  return listMatchesRoute(areas, originCandidates) && listMatchesRoute(areas, destinationCandidates)
}

export function AdminInquiryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [inquiry, setInquiry] = useState<AdminInquiryDetail | null>(null)
  const [quotes, setQuotes] = useState<VendorQuote[]>([])
  const [tokens, setTokens] = useState<VendorTokenInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [expandedVendor, setExpandedVendor] = useState<string | null>(null)
  const [manualPrice, setManualPrice] = useState('')
  const [manualEta, setManualEta] = useState('')
  const [manualDate, setManualDate] = useState('')
  const [manualVehicleType, setManualVehicleType] = useState<VehicleType | ''>('')
  const [manualInsuranceIncluded, setManualInsuranceIncluded] = useState(false)
  const [manualInsurancePremiumDigits, setManualInsurancePremiumDigits] = useState('')
  const [manualNotes, setManualNotes] = useState('')
  const [toast, setToast] = useState('')
  const [copiedQuoteToken, setCopiedQuoteToken] = useState<string | null>(null)
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [vendorSectionRefreshing, setVendorSectionRefreshing] = useState(false)
  const [vendorQuoteFilter, setVendorQuoteFilter] = useState<VendorQuoteFilter>(VENDOR_QUOTE_FILTER_ALL)
  const [vendorNameQuery, setVendorNameQuery] = useState('')
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [paymentConfirmUploading, setPaymentConfirmUploading] = useState(false)
  const [routeVendors, setRouteVendors] = useState<RouteVendorProfile[]>([])
  const [broadcastVendorIds, setBroadcastVendorIds] = useState<string[]>([])
  const [broadcastSubmitting, setBroadcastSubmitting] = useState(false)
  const [broadcastProgressPct, setBroadcastProgressPct] = useState(0)
  const broadcastProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadDetail = useCallback(async () => {
    if (!id) return
    setLoadError('')
    const res = (await apiClient.get(`/admin/inquiries/${id}`)) as AdminDetailResponse
    if (!res.inquiry) {
      setInquiry(null)
      setQuotes([])
      setTokens([])
      return
    }
    setInquiry(res.inquiry)
    setQuotes(Array.isArray(res.quotes) ? res.quotes : [])
    setTokens(Array.isArray(res.tokens) ? res.tokens : [])
  }, [id])

  useEffect(() => {
    if (!id) {
      setInquiry(null)
      setQuotes([])
      setTokens([])
      setLoading(false)
      return
    }
    let mounted = true
    void (async () => {
      try {
        setLoading(true)
        await loadDetail()
      } catch (e) {
        if (!mounted) return
        if (e instanceof Error && e.message === 'not_found') {
          setLoadError('')
          setInquiry(null)
          setQuotes([])
          setTokens([])
        } else {
          setLoadError('Gagal memuat detail permintaan.')
          setInquiry(null)
          setQuotes([])
          setTokens([])
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [id, loadDetail])

  const tokensByVendor = useMemo(() => {
    const map = new Map<string, string>()
    for (const { token, vendorId } of tokens) {
      map.set(vendorId, token)
    }
    return map
  }, [tokens])
  const tokenNameByVendor = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of tokens) {
      const n = t.vendorName?.trim()
      if (n) map.set(t.vendorId, n)
    }
    return map
  }, [tokens])
  const tokenProfileByVendor = useMemo(() => {
    const map = new Map<string, VendorTokenInfo>()
    for (const t of tokens) {
      map.set(t.vendorId, t)
    }
    return map
  }, [tokens])
  const routeVendorProfileById = useMemo(() => {
    const map = new Map<string, RouteVendorProfile>()
    for (const v of routeVendors) map.set(v.id, v)
    return map
  }, [routeVendors])
  const routeVendorNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const v of routeVendors) {
      const n = v.name.trim()
      if (n) map.set(v.id, n)
    }
    return map
  }, [routeVendors])

  const routeSupportedVendorIds = useMemo(() => {
    if (!inquiry) return []
    const candidateIds =
      routeVendors.length > 0
        ? routeVendors.map((v) => v.id)
        : inquiry.matchedVendorIds
    return candidateIds.filter((vendorId) =>
      vendorSupportsRoute(
        vendorId,
        inquiry,
        tokenProfileByVendor.get(vendorId) ?? routeVendorProfileById.get(vendorId),
      ),
    )
  }, [inquiry, routeVendorProfileById, routeVendors, tokenProfileByVendor])

  const filteredMatchedVendorIds = useMemo(() => {
    if (!inquiry) return []
    let ids = [...routeSupportedVendorIds]
    if (vendorQuoteFilter === VENDOR_QUOTE_FILTER_RESPONDED) {
      ids = ids.filter((vid) => quotes.some((q) => q.vendorId === vid))
    } else if (vendorQuoteFilter === VENDOR_QUOTE_FILTER_PENDING) {
      ids = ids.filter((vid) => !quotes.some((q) => q.vendorId === vid))
    }
    const q = vendorNameQuery.trim().toLowerCase()
    if (q) {
      ids = ids.filter((vid) => {
        const resolvedName =
          tokenNameByVendor.get(vid) || routeVendorNameById.get(vid) || getVendorById(vid)?.name || vid
        return resolvedName.toLowerCase().includes(q)
      })
    }
    return ids
  }, [
    inquiry,
    quotes,
    routeSupportedVendorIds,
    routeVendorNameById,
    tokenNameByVendor,
    vendorQuoteFilter,
    vendorNameQuery,
  ])

  useEffect(() => {
    if (!inquiry) {
      setRouteVendors([])
      return
    }
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id,name,origin_cities,destination_cities,service_areas,is_active')
        .eq('is_active', true)
      if (cancelled || error) return
      const mapped = (Array.isArray(data) ? data : [])
        .filter((row) => row && typeof row.id === 'string')
        .map((row) => ({
          id: row.id as string,
          name: typeof row.name === 'string' ? row.name : row.id,
          originCities: Array.isArray(row.origin_cities) ? (row.origin_cities as string[]) : [],
          destinationCities: Array.isArray(row.destination_cities) ? (row.destination_cities as string[]) : [],
          serviceAreas: Array.isArray(row.service_areas) ? (row.service_areas as string[]) : [],
        }))
      if (!cancelled) setRouteVendors(mapped)
    })()
    return () => {
      cancelled = true
    }
  }, [inquiry])

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current)
      if (broadcastProgressTimerRef.current) clearInterval(broadcastProgressTimerRef.current)
    }
  }, [])

  if (!id) {
    return (
      <SectionCard>
        <Link to="/admin/inquiries" className="text-accent">
          Kembali ke daftar permintaan
        </Link>
      </SectionCard>
    )
  }

  if (loading) {
    return (
      <SectionCard className="text-left text-sm text-slate-600">Memuat detail permintaan...</SectionCard>
    )
  }

  if (loadError) {
    return (
      <SectionCard className="text-left">
        <p className="text-sm text-red-800">{loadError}</p>
        <Link to="/admin/inquiries" className="mt-3 inline-block font-semibold text-accent">
          Kembali ke daftar
        </Link>
      </SectionCard>
    )
  }

  if (!inquiry) {
    return (
      <SectionCard>
        <p className="text-sm text-slate-600">Permintaan tidak ditemukan.</p>
        <Link to="/admin/inquiries" className="mt-3 inline-block font-semibold text-accent">
          Kembali ke daftar permintaan
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

  async function submitManual(vendorId: string) {
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
    const payload: QuoteSubmitPayload = {
      price: Math.round(p),
      eta: manualEta.trim() || '—',
      pickupDate: manualDate.trim() || '—',
      notes: manualNotes.trim(),
      vehicleType: manualVehicleType,
      insuranceIncluded: manualInsuranceIncluded,
      insurancePremium: manualInsuranceIncluded ? prem : 0,
    }
    try {
      await apiClient.post(`/admin/inquiries/${inquiryId}/manual-quote`, { vendorId, payload })
      await loadDetail()
      setToast('Penawaran manual disimpan.')
      setTimeout(() => setToast(''), 3000)
    } catch {
      setToast('Gagal menyimpan penawaran.')
      setTimeout(() => setToast(''), 3000)
    }
  }

  async function copyVendorQuoteLink(token: string) {
    const url = vendorQuoteUrl(token)
    try {
      await navigator.clipboard.writeText(url)
      if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current)
      setCopiedQuoteToken(token)
      copyResetTimerRef.current = setTimeout(() => {
        setCopiedQuoteToken(null)
        copyResetTimerRef.current = null
      }, 2200)
    } catch {
      setToast('Gagal menyalin tautan.')
      setTimeout(() => setToast(''), 2500)
    }
  }

  async function refreshVendorQuotes() {
    if (!id) return
    setVendorSectionRefreshing(true)
    try {
      await loadDetail()
    } catch {
      setToast('Gagal memuat ulang penawaran.')
      setTimeout(() => setToast(''), 2800)
    } finally {
      setVendorSectionRefreshing(false)
    }
  }

  function toggleBroadcastVendor(vid: string) {
    setBroadcastVendorIds((prev) => (prev.includes(vid) ? prev.filter((x) => x !== vid) : [...prev, vid]))
  }

  function stopBroadcastProgressTicker() {
    if (broadcastProgressTimerRef.current) {
      clearInterval(broadcastProgressTimerRef.current)
      broadcastProgressTimerRef.current = null
    }
  }

  function startBroadcastProgressTicker() {
    stopBroadcastProgressTicker()
    setBroadcastProgressPct(8)
    broadcastProgressTimerRef.current = setInterval(() => {
      setBroadcastProgressPct((prev) => {
        if (prev >= 92) return prev
        const step = prev < 45 ? 9 : prev < 75 ? 5 : 2
        return Math.min(92, prev + step)
      })
    }, 420)
  }

  function selectAllFilteredForBroadcast() {
    setBroadcastVendorIds([...filteredMatchedVendorIds])
  }

  function selectAllRouteSupportedForBroadcast() {
    setBroadcastVendorIds([...routeSupportedVendorIds])
  }

  function clearBroadcastSelection() {
    setBroadcastVendorIds([])
  }

  async function sendVendorEmailBroadcast() {
    if (!inquiryId || broadcastVendorIds.length === 0 || broadcastSubmitting) return
    setBroadcastSubmitting(true)
    startBroadcastProgressTicker()
    setToast('')
    try {
      const res = (await apiClient.post(`/admin/inquiries/${inquiryId}/broadcast`, {
        vendorIds: broadcastVendorIds,
      })) as { success?: number; failed?: number; errors?: { message?: string; vendorId?: string }[] }
      const ok = typeof res.success === 'number' ? res.success : 0
      const fail = typeof res.failed === 'number' ? res.failed : 0
      const extra =
        fail > 0 && Array.isArray(res.errors) && res.errors[0]?.message
          ? ` (${res.errors[0].message.slice(0, 80)})`
          : ''
      setToast(`Broadcast email: ${ok} terkirim${fail ? `, ${fail} gagal` : ''}.${extra}`)
      setBroadcastVendorIds([])
      await loadDetail()
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Gagal mengirim email ke vendor.')
    } finally {
      stopBroadcastProgressTicker()
      setBroadcastProgressPct(100)
      await new Promise((resolve) => setTimeout(resolve, 350))
      setBroadcastSubmitting(false)
      setBroadcastProgressPct(0)
      setTimeout(() => setToast(''), 6000)
    }
  }

  async function releaseToCustomer() {
    try {
      await apiClient.post(`/admin/inquiries/${inquiryId}/release-quotes`, {})
      await loadDetail()
      setToast('Penawaran sekarang terlihat oleh pelanggan.')
      setTimeout(() => setToast(''), 3000)
    } catch {
      setToast('Gagal melepas penawaran ke pelanggan.')
      setTimeout(() => setToast(''), 3000)
    }
  }

  async function updateInquiryStatus(status: Inquiry['status']) {
    setStatusUpdating(true)
    try {
      await apiClient.post(`/admin/inquiries/${inquiryId}/update-status`, { status })
      await loadDetail()
      setToast('Status diperbarui.')
      setTimeout(() => setToast(''), 2500)
    } catch {
      setToast('Gagal memperbarui status.')
      setTimeout(() => setToast(''), 2500)
    } finally {
      setStatusUpdating(false)
    }
  }

  async function onUploadPaymentConfirmation(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]
    if (!file) return
    setPaymentConfirmUploading(true)
    const uploaded = await uploadUserFile('admin/payment-confirmation', file, { extraPath: inquiryId })
    if ('error' in uploaded) {
      setToast(uploaded.error)
      setTimeout(() => setToast(''), 2800)
      setPaymentConfirmUploading(false)
      ev.target.value = ''
      return
    }
    try {
      await apiClient.post(`/admin/inquiries/${inquiryId}/confirm-payment`, {
        confirmationImageUrl: uploaded.url,
      })
      await loadDetail()
      setToast('Bukti konfirmasi pembayaran tersimpan.')
      setTimeout(() => setToast(''), 2800)
    } catch {
      setToast('Gagal menyimpan konfirmasi pembayaran.')
      setTimeout(() => setToast(''), 2800)
    } finally {
      setPaymentConfirmUploading(false)
      ev.target.value = ''
    }
  }

  const customerLabel = inquiry.customerName?.trim() || 'Pelanggan'

  return (
    <div className="flex flex-col gap-4">
      {toast && (
        <p className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white shadow-md">{toast}</p>
      )}
      {broadcastSubmitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 text-left shadow-2xl">
            <p className="text-sm font-semibold text-slate-900">Mengirim email broadcast…</p>
            <p className="mt-1 text-xs text-slate-600">
              Mohon tunggu. Proses pengiriman sedang berjalan ke {broadcastVendorIds.length} vendor terpilih.
            </p>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${broadcastProgressPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-medium text-slate-600">{broadcastProgressPct}%</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={inquiryStatusBadgeVariant(inquiry.status)}>
          {inquiryStatusLabel(inquiry.status)}
        </Badge>
      </div>

      <SectionCard className="text-left">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pelanggan</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{customerLabel}</p>
        <div className="mt-3 border-t border-slate-100 pt-3">
          <InquiryRequestSummary inquiry={inquiry} />
        </div>
      </SectionCard>
      <SectionCard className="text-left">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status proses</p>
        <p className="mt-1 text-sm text-slate-700">{inquiryStatusLabel(inquiry.status)}</p>
        <label className="mt-3 block">
          <span className="text-xs font-medium text-slate-600">Ubah status</span>
          <select
            className={inputClass}
            disabled={statusUpdating}
            value={inquiry.status}
            onChange={(e) => void updateInquiryStatus(e.target.value as Inquiry['status'])}
          >
            {INQUIRY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {inquiryStatusLabel(s)}
              </option>
            ))}
          </select>
        </label>
      </SectionCard>

      {inquiry.payment?.proofDataUrl && (
        <SectionCard className="text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Bukti bayar customer</p>
          <a href={inquiry.payment.proofDataUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-semibold text-accent">
            Buka bukti transfer
          </a>
          {/^https?:.*\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(inquiry.payment.proofDataUrl) && (
            <img src={inquiry.payment.proofDataUrl} alt="Bukti bayar" className="mt-3 max-h-56 w-full rounded-xl border border-slate-200 object-contain" />
          )}
          <div className="mt-3">
            <p className="text-sm font-medium text-slate-700">Upload konfirmasi pembayaran admin</p>
            <input type="file" accept="image/*,.pdf" disabled={paymentConfirmUploading} onChange={(e) => void onUploadPaymentConfirmation(e)} className="mt-2 block w-full min-h-12 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-4 file:py-2 file:text-sm file:font-semibold file:text-accent disabled:opacity-50" />
            {inquiry.paymentConfirmationImageUrl && (
              <a href={inquiry.paymentConfirmationImageUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-accent">
                Lihat bukti konfirmasi admin
              </a>
            )}
          </div>
        </SectionCard>
      )}

      {quotes.length > 0 && inquiry.quotesReleasedToCustomer === false && (
        <SectionCard className="border-amber-200 bg-amber-50/70 text-left text-sm text-amber-950">
          <p className="font-semibold">Penawaran belum ditampilkan ke pelanggan.</p>
          <p className="mt-1 text-amber-900/90">
            Setelah Anda selesai meninjau respons vendor, tampilkan daftar penawaran agar pelanggan dapat memilih.
          </p>
          <Button type="button" onClick={() => void releaseToCustomer()} className="mt-4 w-full bg-amber-800 text-white">
            Tampilkan penawaran ke pelanggan
          </Button>
        </SectionCard>
      )}

      {quotes.length > 0 && inquiry.quotesReleasedToCustomer === true && (
        <p className="text-left text-xs font-medium text-emerald-800">
          Penawaran sudah ditampilkan ke pelanggan — mereka dapat membuka halaman &quot;Lihat penawaran&quot;.
        </p>
      )}

      <div className="flex items-start justify-between gap-3">
        <h2 className="text-left text-sm font-semibold uppercase tracking-wide text-slate-500">
          Vendor & penawaran
        </h2>
        <span className="text-xs text-slate-500">
          {filteredMatchedVendorIds.length} vendor mendukung rute {inquiry.pickup} → {inquiry.destination}
        </span>
        <button
          type="button"
          aria-label="Muat ulang daftar vendor dan penawaran"
          disabled={vendorSectionRefreshing}
          onClick={() => void refreshVendorQuotes()}
          className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-5 w-5 ${vendorSectionRefreshing ? 'animate-spin' : ''}`}
            fill="none"
            aria-hidden
          >
            <path
              d="M21 12a9 9 0 1 1-2.64-6.36"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-left text-xs font-medium text-slate-600">Status penawaran</span>
          <select
            className={inputClass}
            value={vendorQuoteFilter}
            onChange={(e) => setVendorQuoteFilter(e.target.value as VendorQuoteFilter)}
          >
            <option value={VENDOR_QUOTE_FILTER_ALL}>Semua vendor</option>
            <option value={VENDOR_QUOTE_FILTER_RESPONDED}>Sudah ada penawaran</option>
            <option value={VENDOR_QUOTE_FILTER_PENDING}>Belum merespons</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-left text-xs font-medium text-slate-600">Cari nama vendor</span>
          <input
            type="search"
            className={inputClass}
            value={vendorNameQuery}
            onChange={(e) => setVendorNameQuery(e.target.value)}
            placeholder="Ketik nama…"
            autoComplete="off"
          />
        </label>
      </div>

      {filteredMatchedVendorIds.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-left">
          <p className="text-xs font-medium text-slate-700">Email broadcast ke vendor</p>
          <p className="mt-1 text-xs text-slate-500">
            Centang vendor lalu kirim undangan email (link penawaran). Hanya vendor yang punya email aktif di
            database yang akan menerima pesan.
          </p>
          <p className="mt-1 text-xs font-medium text-slate-600">
            Dipilih: {broadcastVendorIds.length} dari {routeSupportedVendorIds.length} vendor rute
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectAllRouteSupportedForBroadcast}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm"
            >
              Pilih semua vendor rute
            </button>
            <button
              type="button"
              onClick={selectAllFilteredForBroadcast}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm"
            >
              Pilih semua (terlihat)
            </button>
            <button
              type="button"
              onClick={clearBroadcastSelection}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm"
            >
              Hapus pilihan
            </button>
            <Button
              type="button"
              disabled={broadcastVendorIds.length === 0 || broadcastSubmitting}
              onClick={() => void sendVendorEmailBroadcast()}
              className="min-h-10 text-sm"
            >
              {broadcastSubmitting ? 'Mengirim…' : `Kirim email (${broadcastVendorIds.length})`}
            </Button>
          </div>
        </div>
      )}

      {filteredMatchedVendorIds.length === 0 && (
        <p className="text-left text-sm text-slate-600">Tidak ada vendor yang cocok dengan filter.</p>
      )}

      <div className="flex flex-col gap-3">
        {filteredMatchedVendorIds.map((vid) => {
          const vendor = getVendorById(vid)
          const name = tokenNameByVendor.get(vid) || routeVendorNameById.get(vid) || vendor?.name || vid
          const token = tokensByVendor.get(vid)
          const tokenMeta = tokenProfileByVendor.get(vid)
          const broadcastSentAt = tokenMeta?.lastBroadcastSentAt || null
          const quote = quotes.find((q) => q.vendorId === vid)
          const hasQuote = Boolean(quote)
          const selectedForBroadcast = broadcastVendorIds.includes(vid)

          return (
            <SectionCard
              key={vid}
              className={`text-left transition-colors ${
                hasQuote
                  ? 'border-emerald-200/90 bg-emerald-50/45 shadow-sm'
                  : 'border-amber-200/85 bg-amber-50/40 shadow-sm'
              }`}
            >
              <div className="flex gap-2">
                <label
                  className="flex shrink-0 cursor-pointer items-start pt-1"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedForBroadcast}
                    onChange={() => toggleBroadcastVendor(vid)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-accent"
                    aria-label={`Pilih ${name} untuk email broadcast`}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => openManual(vid)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-slate-900">{name}</p>
                      <Badge variant={hasQuote ? 'success' : 'neutral'} className="text-[10px]">
                        {hasQuote ? 'Sudah merespons' : 'Belum merespons'}
                      </Badge>
                      <Badge variant={broadcastSentAt ? 'success' : 'neutral'} className="text-[10px]">
                        {broadcastSentAt ? 'Email terkirim' : 'Email belum dikirim'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Harga: {quote ? formatIDR(quote.price) : '—'} • ETA: {quote?.eta || '—'} • Jemput:{' '}
                      {quote?.pickupDate || '—'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Broadcast terakhir: {formatBroadcastDateTime(broadcastSentAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg
                      viewBox="0 0 24 24"
                      className={`h-4 w-4 text-accent transition-transform ${expandedVendor === vid ? 'rotate-180' : ''}`}
                      fill="none"
                      aria-hidden
                    >
                      <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </button>
              </div>

              {expandedVendor === vid && quote && (
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

              {expandedVendor === vid && token && (
                <div className="mt-3 flex min-w-0 items-center gap-1 rounded-lg bg-slate-50 p-2">
                  <p className="min-w-0 flex-1 truncate text-xs text-slate-500">{vendorQuoteUrl(token)}</p>
                  <button
                    type="button"
                    aria-label={
                      copiedQuoteToken === token ? 'Tautan sudah disalin' : 'Salin tautan ke clipboard'
                    }
                    className={`shrink-0 rounded-md p-2 transition-colors ${
                      copiedQuoteToken === token
                        ? 'text-emerald-600 hover:bg-emerald-50'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-accent'
                    }`}
                    onClick={() => void copyVendorQuoteLink(token)}
                  >
                    {copiedQuoteToken === token ? (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
                        <path
                          d="M20 6 9 17l-5-5"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
                        <rect
                          x="9"
                          y="9"
                          width="13"
                          height="13"
                          rx="2"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label="Buka tautan vendor di tab baru"
                    className="shrink-0 rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-accent"
                    onClick={() => window.open(vendorQuoteUrl(token), '_blank', 'noopener,noreferrer')}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
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
                    <Button type="button" onClick={() => void submitManual(vid)} fullWidth>
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
