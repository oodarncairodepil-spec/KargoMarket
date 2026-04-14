import cors from 'cors'
import express from 'express'
import { z } from 'zod'
import { requireAuth, resolveUserFromRequest } from './auth.js'
import { config, getGoogleGeocodingApiKey } from './config.js'
import { query } from './db.js'
import { ensureSchema, ensureSeedVendors } from './schema.js'
import { parseGoogleAddressComponents } from './googleGeocode.js'
import { locationsRouter } from './locationsRouter.js'
import { resolveMatchedCityId } from './matchCityId.js'
import { id, normalizeArea } from './utils.js'

export const app = express()
app.use(express.json({ limit: '2mb' }))
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true)
      // Jangan throw error di sini (akan jadi 500 di Vercel). Cukup "deny" CORS
      // agar browser memblokir, dan untuk POST kita pakai `requireTrustedOrigin`.
      return callback(null, config.appOrigins.includes(origin))
    },
    credentials: true,
  }),
)
app.use(locationsRouter)

let initPromise = null

export function ensureInitialized() {
  if (!initPromise) {
    initPromise = (async () => {
      const fullBootstrap =
        process.env.RUNTIME_DB_BOOTSTRAP === '1' || process.env.RUNTIME_DB_BOOTSTRAP === 'true'
      await ensureSchema()
      if (process.env.VERCEL === '1' && !fullBootstrap) {
        return
      }
      await ensureSeedVendors()
    })()
  }
  return initPromise
}

async function invokeBroadcastEdgeFunction(inquiryId, vendorIds = null) {
  // Best-effort: jangan gagalkan create inquiry kalau email gagal.
  const base = (config.supabaseUrl || '').replace(/\/$/, '')
  const key = config.supabaseServiceRoleKey
  if (!base || !key) {
    console.warn('Broadcast skipped: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return
  }
  const payload =
    Array.isArray(vendorIds) && vendorIds.length > 0
      ? { inquiryId, vendorIds }
      : { inquiryId }
  const timeoutMs =
    Array.isArray(vendorIds) && vendorIds.length > 0 ? Math.min(120_000, 15_000 + vendorIds.length * 400) : 2500
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${base}/functions/v1/send-inquiry-broadcast`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn('Broadcast invoke failed', res.status, text)
      return
    }
    const body = await res.json().catch(() => null)
    console.log('Broadcast invoked', body)
  } catch (e) {
    console.warn('Broadcast invoke error', e instanceof Error ? e.message : String(e))
  } finally {
    clearTimeout(t)
  }
}

/** Admin-triggered broadcast: tunggu respons edge function (timeout lebih lama). */
async function invokeBroadcastEdgeFunctionForAdmin(inquiryId, vendorIds) {
  const base = (config.supabaseUrl || '').replace(/\/$/, '')
  const key = config.supabaseServiceRoleKey
  if (!base || !key) {
    return { ok: false, status: 503, body: { error: 'broadcast_unconfigured' } }
  }
  const ids = Array.isArray(vendorIds) ? vendorIds : []
  const timeoutMs = Math.min(180_000, 20_000 + ids.length * 500)
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${base}/functions/v1/send-inquiry-broadcast`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inquiryId, vendorIds: ids }),
      signal: controller.signal,
    })
    const text = await res.text().catch(() => '')
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = { raw: text }
    }
    return { ok: res.ok, status: res.status, body: json }
  } catch (e) {
    return {
      ok: false,
      status: 504,
      body: { error: 'broadcast_timeout_or_unreachable', detail: e instanceof Error ? e.message : String(e) },
    }
  } finally {
    clearTimeout(t)
  }
}

function requireTrustedOrigin(req, res, next) {
  const origin = req.get('origin')
  if (!origin || config.appOrigins.includes(origin)) return next()
  return res.status(403).json({ error: 'invalid_origin' })
}

const quoteSchema = z.object({
  price: z.number().int().positive(),
  eta: z.string(),
  pickupDate: z.string(),
  notes: z.string().default(''),
  vehicleType: z.string(),
  insuranceIncluded: z.boolean(),
  insurancePremium: z.number().int().nonnegative(),
})

const MAX_PAYMENT_PROOF_URL_CHARS = 400 * 1024

const confirmPaymentSchema = z.object({
  proofFileName: z.string().min(1),
  proofDataUrl: z.string().nullable().optional(),
})
const adminConfirmPaymentSchema = z.object({
  confirmationImageUrl: z.string().url(),
})
const adminUpdateStatusSchema = z.object({
  status: z.enum([
    'awaiting_quotes',
    'quotes_ready',
    'vendor_selected',
    'awaiting_payment',
    'paid',
    'payment_confirmed',
    'in_transit',
    'cancelled',
    'completed',
  ]),
})

const optionalCityId = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === undefined || v === null || v === '') return null
    const n = typeof v === 'string' ? Number(String(v).trim()) : Number(v)
    if (!Number.isFinite(n) || n <= 0) return null
    return Math.trunc(n)
  })

const inquirySchema = z.object({
  pickup: z.string(),
  destination: z.string(),
  pickupAddress: z.string(),
  pickupKelurahan: z.string(),
  pickupKecamatan: z.string(),
  pickupKota: z.string(),
  pickupPostalCode: z.string(),
  pickupProvince: z.string().default(''),
  pickupCityId: optionalCityId,
  destinationAddress: z.string(),
  destinationKelurahan: z.string(),
  destinationKecamatan: z.string(),
  destinationKota: z.string(),
  destinationPostalCode: z.string(),
  destinationProvince: z.string().default(''),
  destinationCityId: optionalCityId,
  itemDescription: z.string(),
  weight: z.string(),
  dimensions: z.string(),
  lengthCm: z.string(),
  widthCm: z.string(),
  heightCm: z.string(),
  itemImageUrls: z.array(z.string()).default([]),
  specialRequirements: z.string().default(''),
  scheduledPickupDate: z.string(),
  koliCount: z.string(),
  estimatedItemValue: z.string(),
  vehicleType: z.string().default(''),
  specialTreatment: z.string().default(''),
  insurance: z.boolean(),
  additionalPacking: z.boolean(),
  budgetEstimate: z.string().default(''),
  tncAcceptedAt: z.string(),
})

function toIso(v) {
  if (v == null) return undefined
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

/** Ringkas untuk daftar admin — tanpa alamat panjang, gambar base64, dll. */
function mapAdminInquiryListRow(r) {
  const createdAt = toIso(r.created_at) ?? r.created_at
  const ymd = createdAt.slice(0, 10).replace(/-/g, '')
  const ddmmyy = ymd.length === 8 ? `${ymd.slice(6, 8)}${ymd.slice(4, 6)}${ymd.slice(2, 4)}` : '000000'
  const compactId = String(r.id || '')
    .replace(/^inq_/i, '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(-6)
    .toUpperCase()
  return {
    id: r.id,
    displayNo: `INQ-${ddmmyy}-${compactId || '000000'}`,
    pickup: r.pickup,
    destination: r.destination,
    itemDescription: r.item_description,
    itemImageUrls: r.item_image_urls || [],
    status: r.status,
    quotesReleasedToCustomer: Boolean(r.quotes_released_to_customer),
    createdAt,
    customerName: r.customer_name,
    quoteCount: Number(r.quote_count) || 0,
    matchedVendorCount: Number(r.matched_vendor_count) || 0,
  }
}

/** Daftar inquiry pelanggan — kolom ringkas (tanpa bukti bayar/base64) agar respons cepat. */
function mapCustomerInquiryListRow(r) {
  return {
    id: r.id,
    pickup: r.pickup,
    destination: r.destination,
    itemDescription: r.item_description,
    itemImageUrls: r.item_image_urls || [],
    specialRequirements: '',
    weight: '',
    dimensions: '',
    status: r.status,
    createdAt: toIso(r.created_at) ?? r.created_at,
    selectedQuoteId: r.selected_quote_id || undefined,
    matchedVendorIds: [],
    quotesReleasedToCustomer: Boolean(r.quotes_released_to_customer),
    quoteCount: Number(r.quote_count) || 0,
    matchedVendorCount: Number(r.matched_vendor_count) || 0,
  }
}

function mapInquiryRow(r) {
  const paidAt = r.paid_at != null ? toIso(r.paid_at) : undefined
  return {
    id: r.id,
    pickup: r.pickup,
    destination: r.destination,
    pickupAddress: r.pickup_address,
    pickupKelurahan: r.pickup_kelurahan,
    pickupKecamatan: r.pickup_kecamatan,
    pickupKota: r.pickup_kota,
    pickupPostalCode: r.pickup_postal_code,
    pickupProvince: r.pickup_province || '',
    destinationAddress: r.destination_address,
    destinationKelurahan: r.destination_kelurahan,
    destinationKecamatan: r.destination_kecamatan,
    destinationKota: r.destination_kota,
    destinationPostalCode: r.destination_postal_code,
    destinationProvince: r.destination_province || '',
    pickupCityId: r.pickup_city_id != null ? String(r.pickup_city_id) : undefined,
    destinationCityId: r.destination_city_id != null ? String(r.destination_city_id) : undefined,
    itemDescription: r.item_description,
    weight: r.weight,
    dimensions: r.dimensions,
    lengthCm: r.length_cm,
    widthCm: r.width_cm,
    heightCm: r.height_cm,
    itemImageUrls: r.item_image_urls || [],
    specialRequirements: r.special_requirements || '',
    scheduledPickupDate: r.scheduled_pickup_date,
    koliCount: r.koli_count,
    estimatedItemValue: r.estimated_item_value,
    vehicleType: r.vehicle_type || '',
    specialTreatment: r.special_treatment || '',
    insurance: Boolean(r.insurance),
    additionalPacking: Boolean(r.additional_packing),
    budgetEstimate: r.budget_estimate || '',
    tncAcceptedAt: r.tnc_accepted_at,
    status: r.status,
    selectedQuoteId: r.selected_quote_id || undefined,
    matchedVendorIds: r.matched_vendor_ids || [],
    quotesReleasedToCustomer: Boolean(r.quotes_released_to_customer),
    createdAt: toIso(r.created_at) ?? r.created_at,
    ...(paidAt
      ? {
          payment: {
            inquiryId: r.id,
            quoteId: r.selected_quote_id || '',
            proofFileName: r.payment_proof_file_name || '',
            proofDataUrl: r.payment_proof_data_url ?? null,
            paidAt,
            vendorNotified: true,
          },
        }
      : {}),
    quoteCount: r.quote_count != null ? Number(r.quote_count) : undefined,
    matchedVendorCount: r.matched_vendor_count != null ? Number(r.matched_vendor_count) : undefined,
    paymentConfirmationImageUrl: r.payment_confirmation_image_url || undefined,
    paymentConfirmedAt: r.payment_confirmed_at ? toIso(r.payment_confirmed_at) : undefined,
  }
}

function mapQuoteRow(r) {
  return {
    id: r.id,
    inquiryId: r.inquiry_id,
    vendorId: r.vendor_id,
    price: r.price,
    eta: r.eta,
    pickupDate: r.pickup_date,
    notes: r.notes || '',
    submittedAt: r.submitted_at,
    source: r.source,
    vehicleType: r.vehicle_type || '',
    insuranceIncluded: Boolean(r.insurance_included),
    insurancePremium: r.insurance_premium ?? undefined,
  }
}

async function getMatchedVendors(destination) {
  const { rows } = await query(`SELECT id, service_areas FROM vendors`)
  const dest = normalizeArea(destination)
  const matched = rows
    .filter((v) => (v.service_areas || []).some((a) => dest.includes(normalizeArea(a))))
    .map((v) => v.id)
  if (matched.length) return matched
  const fallback = rows.filter((v) => v.id !== 'v_general').slice(0, 2).map((v) => v.id)
  return [...fallback, 'v_general']
}

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/auth/me', async (req, res, next) => {
  try {
    const { user, authError } = await resolveUserFromRequest(req)
    return res.json({ user, authError: authError ?? null })
  } catch (err) {
    return next(err)
  }
})

app.get('/customer/inquiries', requireAuth(['customer']), async (req, res, next) => {
  try {
    const { rows } = await query(
      `
      SELECT
        i.id,
        i.pickup,
        i.destination,
        i.item_description,
        i.item_image_urls,
        i.status,
        i.created_at,
        i.quotes_released_to_customer,
        i.selected_quote_id,
        (SELECT COUNT(*)::int FROM km_quotes q WHERE q.inquiry_id = i.id) AS quote_count,
        (SELECT COUNT(*)::int FROM km_vendor_tokens t2 WHERE t2.inquiry_id = i.id) AS matched_vendor_count
      FROM km_inquiries i
      WHERE i.created_by_user_id = $1
      ORDER BY i.created_at DESC
      `,
      [req.user.id],
    )
    res.json({ inquiries: rows.map(mapCustomerInquiryListRow) })
  } catch (err) {
    next(err)
  }
})

app.get('/customer/geocode/reverse', requireAuth(['customer']), async (req, res, next) => {
  try {
    const lat = Number(req.query.lat)
    const lng = Number(req.query.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'invalid_coordinates' })
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'invalid_coordinates' })
    }
    const key = getGoogleGeocodingApiKey()
    if (!key) {
      console.warn(
        '[geocode/reverse] GOOGLE_GEOCODING_API_KEY kosong. Cek .env di root project, lalu restart server. cwd=',
        process.cwd(),
      )
      return res.status(503).json({ error: 'geocoding_unconfigured' })
    }
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${lat},${lng}`)}&key=${encodeURIComponent(key)}`
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 8000)
    let data
    try {
      const r = await fetch(url, { signal: ac.signal })
      data = await r.json()
    } finally {
      clearTimeout(t)
    }
    if (!data || typeof data !== 'object') {
      return res.status(502).json({ error: 'geocode_bad_response' })
    }
    if (data.status !== 'OK' || !data.results?.[0]) {
      const googleErr =
        typeof data.error_message === 'string' && data.error_message.trim()
          ? data.error_message.trim().slice(0, 300)
          : undefined
      console.warn('[geocode/reverse] Google status:', data.status, googleErr || '')
      return res.status(422).json({
        error: 'geocode_no_results',
        googleStatus: data.status,
        googleErrorMessage: googleErr,
      })
    }
    const first = data.results[0]
    const formatted = first.formatted_address || ''
    const parsed = parseGoogleAddressComponents(first.address_components || [], formatted)
    let matchedCityId = null
    let matchedCityLabel = null
    try {
      const m = await resolveMatchedCityId(parsed.city, parsed.province)
      if (m) {
        matchedCityId = m.id
        matchedCityLabel = m.label
      }
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
      if (code !== '42P01') {
        console.warn('[geocode/reverse] resolveMatchedCityId:', err instanceof Error ? err.message : String(err))
      }
    }
    res.json({
      city: parsed.city,
      province: parsed.province,
      postalCode: parsed.postalCode,
      kelurahan: parsed.kelurahan,
      kecamatan: parsed.kecamatan,
      formattedAddress: formatted,
      matchedCityId,
      matchedCityLabel,
    })
  } catch (err) {
    next(err)
  }
})

app.post('/customer/inquiries', requireTrustedOrigin, requireAuth(['customer']), async (req, res, next) => {
  try {
    const parsed = inquirySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' })
    const payload = parsed.data
    const inquiryId = id('inq')
    const matchedVendorIds = await getMatchedVendors(payload.destination)
    await query(
      `
      INSERT INTO km_inquiries (
        id, created_by_user_id, pickup, destination, pickup_address, pickup_kelurahan, pickup_kecamatan,
        pickup_kota, pickup_postal_code, pickup_province, pickup_city_id, destination_address, destination_kelurahan, destination_kecamatan,
        destination_kota, destination_postal_code, destination_province, destination_city_id, item_description, weight, dimensions, length_cm, width_cm,
        height_cm, item_image_urls, special_requirements, scheduled_pickup_date, koli_count, estimated_item_value,
        vehicle_type, special_treatment, insurance, additional_packing, budget_estimate, tnc_accepted_at,
        status, quotes_released_to_customer
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25::jsonb,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,'awaiting_quotes',FALSE
      )
      `,
      [
        inquiryId,
        req.user.id,
        payload.pickup,
        payload.destination,
        payload.pickupAddress,
        payload.pickupKelurahan,
        payload.pickupKecamatan,
        payload.pickupKota,
        payload.pickupPostalCode,
        payload.pickupProvince,
        payload.pickupCityId,
        payload.destinationAddress,
        payload.destinationKelurahan,
        payload.destinationKecamatan,
        payload.destinationKota,
        payload.destinationPostalCode,
        payload.destinationProvince,
        payload.destinationCityId,
        payload.itemDescription,
        payload.weight,
        payload.dimensions,
        payload.lengthCm,
        payload.widthCm,
        payload.heightCm,
        JSON.stringify(payload.itemImageUrls),
        payload.specialRequirements,
        payload.scheduledPickupDate,
        payload.koliCount,
        payload.estimatedItemValue,
        payload.vehicleType,
        payload.specialTreatment,
        payload.insurance,
        payload.additionalPacking,
        payload.budgetEstimate,
        payload.tncAcceptedAt,
      ],
    )
    // Hindari duplikat vendor yang bisa memicu constraint error.
    const uniqueVendorIds = Array.from(new Set(matchedVendorIds))
    for (const vendorId of uniqueVendorIds) {
      await query(
        `
        INSERT INTO km_vendor_tokens (token, inquiry_id, vendor_id)
        VALUES ($1,$2,$3)
        `,
        [id('tok'), inquiryId, vendorId],
      )
    }
    // Fire broadcast (Resend) via Supabase Edge Function.
    await invokeBroadcastEdgeFunction(inquiryId)
    res.status(201).json({ inquiryId })
  } catch (err) {
    next(err)
  }
})

app.get('/customer/inquiries/:id', requireAuth(['customer']), async (req, res, next) => {
  try {
    const { rows } = await query(
      `
      SELECT i.*, COALESCE(array_agg(t.vendor_id) FILTER (WHERE t.vendor_id IS NOT NULL), '{}') AS matched_vendor_ids
      FROM km_inquiries i
      LEFT JOIN km_vendor_tokens t ON t.inquiry_id = i.id
      WHERE i.id = $1 AND i.created_by_user_id = $2
      GROUP BY i.id
      `,
      [req.params.id, req.user.id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'not_found' })
    const row = rows[0]
    const inquiry = mapInquiryRow(row)
    let selectedQuote
    if (row.selected_quote_id) {
      const qq = await query(
        `SELECT * FROM km_quotes WHERE id = $1 AND inquiry_id = $2 LIMIT 1`,
        [row.selected_quote_id, row.id],
      )
      const qr = qq.rows[0]
      if (qr) {
        const vr = await query(`SELECT id, name, customer_rating FROM vendors WHERE id = $1 LIMIT 1`, [qr.vendor_id])
        const v = vr.rows[0]
        selectedQuote = {
          ...mapQuoteRow(qr),
          vendor: v
            ? { id: v.id, name: v.name, customerRating: Number(v.customer_rating) }
            : null,
        }
      }
    }
    res.json({ inquiry, selectedQuote })
  } catch (err) {
    next(err)
  }
})

app.get('/customer/inquiries/:id/quotes', requireAuth(['customer']), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM km_inquiries WHERE id = $1 AND created_by_user_id = $2 LIMIT 1`,
      [req.params.id, req.user.id],
    )
    const inquiry = rows[0]
    if (!inquiry) return res.status(404).json({ error: 'not_found' })
    if (!inquiry.quotes_released_to_customer) {
      return res.status(403).json({ error: 'quotes_not_released' })
    }
    const qr = await query(`SELECT * FROM km_quotes WHERE inquiry_id = $1 ORDER BY submitted_at DESC`, [req.params.id])
    const vr = await query(`SELECT id, name, customer_rating FROM vendors`)
    const vendorMap = new Map(vr.rows.map((v) => [v.id, v]))
    const quotes = qr.rows.map((q) => ({
      ...mapQuoteRow(q),
      vendor: vendorMap.get(q.vendor_id) || null,
    }))
    res.json({ quotes })
  } catch (err) {
    next(err)
  }
})

app.post(
  '/customer/inquiries/:id/select-quote',
  requireTrustedOrigin,
  requireAuth(['customer']),
  async (req, res, next) => {
  try {
    const quoteId = String(req.body?.quoteId || '')
    if (!quoteId) return res.status(400).json({ error: 'quote_required' })
    const iq = await query(`SELECT * FROM km_inquiries WHERE id = $1 AND created_by_user_id = $2 LIMIT 1`, [
      req.params.id,
      req.user.id,
    ])
    const inquiry = iq.rows[0]
    if (!inquiry) return res.status(404).json({ error: 'not_found' })
    if (!inquiry.quotes_released_to_customer) return res.status(403).json({ error: 'quotes_not_released' })
    const qq = await query(`SELECT id FROM km_quotes WHERE id = $1 AND inquiry_id = $2 LIMIT 1`, [quoteId, req.params.id])
    if (!qq.rows[0]) return res.status(404).json({ error: 'quote_not_found' })
    await query(`UPDATE km_inquiries SET selected_quote_id = $1, status = 'vendor_selected' WHERE id = $2`, [
      quoteId,
      req.params.id,
    ])
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
  },
)

app.post(
  '/customer/inquiries/:id/begin-payment',
  requireTrustedOrigin,
  requireAuth(['customer']),
  async (req, res, next) => {
    try {
      const r = await query(
        `
        UPDATE km_inquiries
        SET status = 'awaiting_payment'
        WHERE id = $1
          AND created_by_user_id = $2
          AND status IN ('vendor_selected', 'awaiting_payment')
        RETURNING id
        `,
        [req.params.id, req.user.id],
      )
      if (!r.rows[0]) return res.status(409).json({ error: 'invalid_state' })
      res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  },
)

app.post(
  '/customer/inquiries/:id/confirm-payment',
  requireTrustedOrigin,
  requireAuth(['customer']),
  async (req, res, next) => {
    try {
      const parsed = confirmPaymentSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' })
      const { proofFileName, proofDataUrl } = parsed.data
      let safeUrl = proofDataUrl ?? null
      if (safeUrl && safeUrl.length > MAX_PAYMENT_PROOF_URL_CHARS) safeUrl = null

      const iq = await query(
        `SELECT id, status, selected_quote_id FROM km_inquiries WHERE id = $1 AND created_by_user_id = $2 LIMIT 1`,
        [req.params.id, req.user.id],
      )
      const inquiry = iq.rows[0]
      if (!inquiry) return res.status(404).json({ error: 'not_found' })
      if (!inquiry.selected_quote_id) return res.status(409).json({ error: 'no_quote' })
      const allowed =
        inquiry.status === 'awaiting_payment' ||
        inquiry.status === 'vendor_selected' ||
        inquiry.status === 'paid'
      if (!allowed) return res.status(409).json({ error: 'invalid_state' })
      if (inquiry.status === 'paid') {
        const fresh = await query(
          `
          SELECT i.*, COALESCE(array_agg(t.vendor_id) FILTER (WHERE t.vendor_id IS NOT NULL), '{}') AS matched_vendor_ids
          FROM km_inquiries i
          LEFT JOIN km_vendor_tokens t ON t.inquiry_id = i.id
          WHERE i.id = $1 AND i.created_by_user_id = $2
          GROUP BY i.id
          `,
          [req.params.id, req.user.id],
        )
        return res.json({ inquiry: mapInquiryRow(fresh.rows[0]) })
      }

      await query(
        `
        UPDATE km_inquiries
        SET status = 'paid',
            payment_proof_file_name = $1,
            payment_proof_data_url = $2,
            paid_at = NOW()
        WHERE id = $3 AND created_by_user_id = $4
        `,
        [proofFileName, safeUrl, req.params.id, req.user.id],
      )
      const fresh = await query(
        `
        SELECT i.*, COALESCE(array_agg(t.vendor_id) FILTER (WHERE t.vendor_id IS NOT NULL), '{}') AS matched_vendor_ids
        FROM km_inquiries i
        LEFT JOIN km_vendor_tokens t ON t.inquiry_id = i.id
        WHERE i.id = $1 AND i.created_by_user_id = $2
        GROUP BY i.id
        `,
        [req.params.id, req.user.id],
      )
      res.json({ inquiry: mapInquiryRow(fresh.rows[0]) })
    } catch (err) {
      next(err)
    }
  },
)

app.get('/admin/inquiries', requireAuth(['admin']), async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10) || 10))
    const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0)
    const q = String(req.query.q ?? '').trim()
    const fetchLimit = limit + 1
    const hasQuery = q.length > 0
    const { rows } = hasQuery
      ? await query(
          `
          SELECT i.id, i.pickup, i.destination, i.item_description, i.item_image_urls, i.status, i.quotes_released_to_customer, i.created_at,
                 u.name AS customer_name,
                 (SELECT COUNT(*)::int FROM km_quotes q WHERE q.inquiry_id = i.id) AS quote_count,
                 (SELECT COUNT(*)::int FROM km_vendor_tokens t WHERE t.inquiry_id = i.id) AS matched_vendor_count
          FROM km_inquiries i
          JOIN user_profiles u ON u.id = i.created_by_user_id
          WHERE i.id ILIKE $3 OR u.name ILIKE $3
          ORDER BY i.created_at DESC
          LIMIT $1 OFFSET $2
          `,
          [fetchLimit, offset, `%${q}%`],
        )
      : await query(
          `
          SELECT i.id, i.pickup, i.destination, i.item_description, i.item_image_urls, i.status, i.quotes_released_to_customer, i.created_at,
                 u.name AS customer_name,
                 (SELECT COUNT(*)::int FROM km_quotes q WHERE q.inquiry_id = i.id) AS quote_count,
                 (SELECT COUNT(*)::int FROM km_vendor_tokens t WHERE t.inquiry_id = i.id) AS matched_vendor_count
          FROM km_inquiries i
          JOIN user_profiles u ON u.id = i.created_by_user_id
          ORDER BY i.created_at DESC
          LIMIT $1 OFFSET $2
          `,
          [fetchLimit, offset],
        )
    const hasMore = rows.length > limit
    const slice = hasMore ? rows.slice(0, limit) : rows
    res.json({
      inquiries: slice.map(mapAdminInquiryListRow),
      hasMore,
      nextOffset: offset + slice.length,
    })
  } catch (err) {
    next(err)
  }
})

app.get('/admin/inquiries/:id', requireAuth(['admin']), async (req, res, next) => {
  try {
    const { rows } = await query(
      `
      SELECT i.*, u.name AS customer_name,
             COALESCE(array_agg(t.vendor_id) FILTER (WHERE t.vendor_id IS NOT NULL), '{}') AS matched_vendor_ids,
             (SELECT COUNT(*)::int FROM km_quotes q WHERE q.inquiry_id = i.id) AS quote_count,
             (SELECT COUNT(*)::int FROM km_vendor_tokens t2 WHERE t2.inquiry_id = i.id) AS matched_vendor_count
      FROM km_inquiries i
      JOIN user_profiles u ON u.id = i.created_by_user_id
      LEFT JOIN km_vendor_tokens t ON t.inquiry_id = i.id
      WHERE i.id = $1
      GROUP BY i.id, u.name
      `,
      [req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'not_found' })
    const quoteRows = await query(`SELECT * FROM km_quotes WHERE inquiry_id = $1 ORDER BY submitted_at DESC`, [req.params.id])
    const tokenRows = await query(
      `
      SELECT
        t.token,
        t.vendor_id,
        v.name AS vendor_name,
        COALESCE(v.origin_cities, '{}'::text[]) AS origin_cities,
        COALESCE(v.destination_cities, '{}'::text[]) AS destination_cities,
        COALESCE(v.service_areas, '{}'::text[]) AS service_areas
      FROM km_vendor_tokens t
      LEFT JOIN vendors v ON v.id = t.vendor_id
      WHERE t.inquiry_id = $1
      `,
      [req.params.id],
    )
    res.json({
      inquiry: {
        ...mapInquiryRow(rows[0]),
        customerName: rows[0].customer_name,
      },
      quotes: quoteRows.rows.map(mapQuoteRow),
      tokens: tokenRows.rows.map((r) => ({
        token: r.token,
        vendorId: r.vendor_id,
        vendorName: r.vendor_name || null,
        originCities: Array.isArray(r.origin_cities) ? r.origin_cities : [],
        destinationCities: Array.isArray(r.destination_cities) ? r.destination_cities : [],
        serviceAreas: Array.isArray(r.service_areas) ? r.service_areas : [],
      })),
    })
  } catch (err) {
    next(err)
  }
})

app.post(
  '/admin/inquiries/:id/confirm-payment',
  requireTrustedOrigin,
  requireAuth(['admin']),
  async (req, res, next) => {
    try {
      const parsed = adminConfirmPaymentSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' })
      await query(
        `
        UPDATE km_inquiries
        SET payment_confirmation_image_url = $1,
            payment_confirmed_at = NOW(),
            status = CASE WHEN status = 'paid' THEN 'payment_confirmed' ELSE status END
        WHERE id = $2
        `,
        [parsed.data.confirmationImageUrl, req.params.id],
      )
      res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  },
)

app.post(
  '/admin/inquiries/:id/update-status',
  requireTrustedOrigin,
  requireAuth(['admin']),
  async (req, res, next) => {
    try {
      const parsed = adminUpdateStatusSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' })
      await query(`UPDATE km_inquiries SET status = $1 WHERE id = $2`, [parsed.data.status, req.params.id])
      res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  },
)

app.post(
  '/admin/inquiries/:id/release-quotes',
  requireTrustedOrigin,
  requireAuth(['admin']),
  async (req, res, next) => {
  try {
    await query(`UPDATE km_inquiries SET quotes_released_to_customer = TRUE WHERE id = $1`, [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
  },
)

app.post(
  '/admin/inquiries/:id/broadcast',
  requireTrustedOrigin,
  requireAuth(['admin']),
  async (req, res, next) => {
    try {
      const raw = req.body?.vendorIds
      const vendorIds = Array.isArray(raw)
        ? raw.map((x) => String(x ?? '').trim()).filter(Boolean)
        : []
      if (vendorIds.length === 0) {
        return res.status(400).json({ error: 'vendor_ids_required' })
      }
      const inquiryId = req.params.id
      const exists = await query(`SELECT id FROM km_inquiries WHERE id = $1 LIMIT 1`, [inquiryId])
      if (!exists.rows[0]) {
        return res.status(404).json({ error: 'not_found' })
      }
      const result = await invokeBroadcastEdgeFunctionForAdmin(inquiryId, vendorIds)
      if (!result.ok) {
        return res.status(result.status >= 400 ? result.status : 502).json(result.body || { error: 'broadcast_failed' })
      }
      res.json(result.body ?? { ok: true })
    } catch (err) {
      next(err)
    }
  },
)

app.post(
  '/admin/inquiries/:id/manual-quote',
  requireTrustedOrigin,
  requireAuth(['admin']),
  async (req, res, next) => {
  try {
    const vendorId = String(req.body?.vendorId || '')
    const payloadParse = quoteSchema.safeParse(req.body?.payload)
    if (!vendorId || !payloadParse.success) return res.status(400).json({ error: 'invalid_payload' })
    const payload = payloadParse.data
    const existing = await query(`SELECT id FROM km_quotes WHERE inquiry_id = $1 AND vendor_id = $2 LIMIT 1`, [
      req.params.id,
      vendorId,
    ])
    const quoteId = existing.rows[0]?.id || id('qt')
    await query(
      `
      INSERT INTO km_quotes (
        id, inquiry_id, vendor_id, price, eta, pickup_date, notes, source,
        vehicle_type, insurance_included, insurance_premium
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,'admin_manual',$8,$9,$10)
      ON CONFLICT (inquiry_id, vendor_id) DO UPDATE
        SET price = EXCLUDED.price,
            eta = EXCLUDED.eta,
            pickup_date = EXCLUDED.pickup_date,
            notes = EXCLUDED.notes,
            source = EXCLUDED.source,
            vehicle_type = EXCLUDED.vehicle_type,
            insurance_included = EXCLUDED.insurance_included,
            insurance_premium = EXCLUDED.insurance_premium,
            submitted_at = NOW()
      `,
      [
        quoteId,
        req.params.id,
        vendorId,
        payload.price,
        payload.eta || '—',
        payload.pickupDate || '—',
        payload.notes || '',
        payload.vehicleType || '',
        payload.insuranceIncluded,
        payload.insuranceIncluded ? payload.insurancePremium : null,
      ],
    )
    await query(`UPDATE km_inquiries SET status = 'quotes_ready' WHERE id = $1 AND status = 'awaiting_quotes'`, [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
  },
)

app.get('/vendor/quote/:token', async (req, res, next) => {
  try {
    const tr = await query(
      `
      SELECT t.token, t.vendor_id, i.*
      FROM km_vendor_tokens t
      JOIN km_inquiries i ON i.id = t.inquiry_id
      WHERE t.token = $1
      LIMIT 1
      `,
      [req.params.token],
    )
    const row = tr.rows[0]
    if (!row) return res.status(404).json({ error: 'invalid_token' })
    const vendorRes = await query(`SELECT id, name, customer_rating FROM vendors WHERE id = $1 LIMIT 1`, [row.vendor_id])
    res.json({
      vendor: vendorRes.rows[0] || null,
      inquiry: mapInquiryRow(row),
    })
  } catch (err) {
    next(err)
  }
})

app.post('/vendor/quote/:token', requireTrustedOrigin, async (req, res, next) => {
  try {
    const payloadParse = quoteSchema.safeParse(req.body)
    if (!payloadParse.success) return res.status(400).json({ error: 'invalid_payload' })
    const tr = await query(`SELECT inquiry_id, vendor_id FROM km_vendor_tokens WHERE token = $1 LIMIT 1`, [
      req.params.token,
    ])
    if (!tr.rows[0]) return res.status(404).json({ error: 'invalid_token' })
    const { inquiry_id: inquiryId, vendor_id: vendorId } = tr.rows[0]
    const payload = payloadParse.data
    const existing = await query(`SELECT id FROM km_quotes WHERE inquiry_id = $1 AND vendor_id = $2 LIMIT 1`, [
      inquiryId,
      vendorId,
    ])
    const quoteId = existing.rows[0]?.id || id('qt')
    await query(
      `
      INSERT INTO km_quotes (
        id, inquiry_id, vendor_id, price, eta, pickup_date, notes, source,
        vehicle_type, insurance_included, insurance_premium
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,'vendor_link',$8,$9,$10)
      ON CONFLICT (inquiry_id, vendor_id) DO UPDATE
        SET price = EXCLUDED.price,
            eta = EXCLUDED.eta,
            pickup_date = EXCLUDED.pickup_date,
            notes = EXCLUDED.notes,
            source = EXCLUDED.source,
            vehicle_type = EXCLUDED.vehicle_type,
            insurance_included = EXCLUDED.insurance_included,
            insurance_premium = EXCLUDED.insurance_premium,
            submitted_at = NOW()
      `,
      [
        quoteId,
        inquiryId,
        vendorId,
        payload.price,
        payload.eta || '—',
        payload.pickupDate || '—',
        payload.notes || '',
        payload.vehicleType || '',
        payload.insuranceIncluded,
        payload.insuranceIncluded ? payload.insurancePremium : null,
      ],
    )
    await query(`UPDATE km_inquiries SET status = 'quotes_ready' WHERE id = $1 AND status = 'awaiting_quotes'`, [inquiryId])
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

app.use((err, _req, res, _next) => {
  console.error(err)
  // Beri error yang lebih informatif untuk kasus migrasi DB belum terpasang di production.
  const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
  const message = err instanceof Error ? err.message : ''
  if (code === '42P01') {
    // undefined_table
    return res.status(500).json({ error: 'db_missing_table', detail: message })
  }
  if (code === '42703') {
    // undefined_column
    return res.status(500).json({ error: 'db_missing_column', detail: message })
  }
  if (code === '23503') {
    // foreign_key_violation
    return res.status(500).json({ error: 'db_fk_violation', detail: message })
  }
  res.status(500).json({ error: 'internal_error' })
})

async function start() {
  await ensureInitialized()
  app.listen(config.port, () => {
    console.log(`API running on http://localhost:${config.port}`)
  })
}

if (process.env.VERCEL !== '1') {
  start().catch((err) => {
    console.error('Failed to start API', err)
    process.exit(1)
  })
}
