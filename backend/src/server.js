import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { z } from 'zod'
import { clearSessionCookie, deleteSession, loginWithPassword, requireAuth, setSessionCookie } from './auth.js'
import { config } from './config.js'
import { query } from './db.js'
import { ensureSchema, ensureSeedUsers, ensureSeedVendors } from './schema.js'
import { id, normalizeArea } from './utils.js'

const app = express()
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())
app.use(
  cors({
    origin: config.appOrigin,
    credentials: true,
  }),
)

const loginWindowMs = 5 * 60 * 1000
const loginLimit = 20
const loginAttempts = new Map()

function requireTrustedOrigin(req, res, next) {
  const origin = req.get('origin')
  if (!origin || origin === config.appOrigin) return next()
  return res.status(403).json({ error: 'invalid_origin' })
}

function rateLimitLogin(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown'
  const now = Date.now()
  const record = loginAttempts.get(ip) || { count: 0, resetAt: now + loginWindowMs }
  if (now > record.resetAt) {
    record.count = 0
    record.resetAt = now + loginWindowMs
  }
  record.count += 1
  loginAttempts.set(ip, record)
  if (record.count > loginLimit) {
    return res.status(429).json({ error: 'too_many_login_attempts' })
  }
  return next()
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: z.enum(['customer', 'admin']).optional(),
})

const quoteSchema = z.object({
  price: z.number().int().positive(),
  eta: z.string(),
  pickupDate: z.string(),
  notes: z.string().default(''),
  vehicleType: z.string(),
  insuranceIncluded: z.boolean(),
  insurancePremium: z.number().int().nonnegative(),
})

const inquirySchema = z.object({
  pickup: z.string(),
  destination: z.string(),
  pickupAddress: z.string(),
  pickupKelurahan: z.string(),
  pickupKecamatan: z.string(),
  pickupKota: z.string(),
  pickupPostalCode: z.string(),
  destinationAddress: z.string(),
  destinationKelurahan: z.string(),
  destinationKecamatan: z.string(),
  destinationKota: z.string(),
  destinationPostalCode: z.string(),
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

function mapInquiryRow(r) {
  return {
    id: r.id,
    pickup: r.pickup,
    destination: r.destination,
    pickupAddress: r.pickup_address,
    pickupKelurahan: r.pickup_kelurahan,
    pickupKecamatan: r.pickup_kecamatan,
    pickupKota: r.pickup_kota,
    pickupPostalCode: r.pickup_postal_code,
    destinationAddress: r.destination_address,
    destinationKelurahan: r.destination_kelurahan,
    destinationKecamatan: r.destination_kecamatan,
    destinationKota: r.destination_kota,
    destinationPostalCode: r.destination_postal_code,
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
    createdAt: r.created_at,
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

app.post('/auth/login', requireTrustedOrigin, rateLimitLogin, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' })
    const result = await loginWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
      expectedRole: parsed.data.role,
    })
    if (!result) return res.status(401).json({ error: 'invalid_credentials' })
    setSessionCookie(res, result.token)
    return res.json({ user: result.user })
  } catch (err) {
    return next(err)
  }
})

app.post('/auth/logout', requireTrustedOrigin, async (req, res, next) => {
  try {
    const token = req.cookies?.km_session
    await deleteSession(token)
    clearSessionCookie(res)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

app.get('/auth/me', async (req, res, next) => {
  try {
    const token = req.cookies?.[config.sessionCookieName]
    if (!token) return res.json({ user: null })
    const result = await query(
      `
      SELECT u.id, u.email, u.role, u.name
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = $1
        AND s.expires_at > NOW()
      LIMIT 1
      `,
      [token],
    )
    return res.json({ user: result.rows[0] || null })
  } catch (err) {
    return next(err)
  }
})

app.get('/customer/inquiries', requireAuth(['customer']), async (req, res, next) => {
  try {
    const { rows } = await query(
      `
      SELECT i.*, COALESCE(array_agg(t.vendor_id) FILTER (WHERE t.vendor_id IS NOT NULL), '{}') AS matched_vendor_ids
      FROM inquiries i
      LEFT JOIN vendor_tokens t ON t.inquiry_id = i.id
      WHERE i.created_by_user_id = $1
      GROUP BY i.id
      ORDER BY i.created_at DESC
      `,
      [req.user.id],
    )
    res.json({ inquiries: rows.map(mapInquiryRow) })
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
      INSERT INTO inquiries (
        id, created_by_user_id, pickup, destination, pickup_address, pickup_kelurahan, pickup_kecamatan,
        pickup_kota, pickup_postal_code, destination_address, destination_kelurahan, destination_kecamatan,
        destination_kota, destination_postal_code, item_description, weight, dimensions, length_cm, width_cm,
        height_cm, item_image_urls, special_requirements, scheduled_pickup_date, koli_count, estimated_item_value,
        vehicle_type, special_treatment, insurance, additional_packing, budget_estimate, tnc_accepted_at,
        status, quotes_released_to_customer
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,'awaiting_quotes',FALSE
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
        payload.destinationAddress,
        payload.destinationKelurahan,
        payload.destinationKecamatan,
        payload.destinationKota,
        payload.destinationPostalCode,
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
    for (const vendorId of matchedVendorIds) {
      await query(
        `
        INSERT INTO vendor_tokens (token, inquiry_id, vendor_id)
        VALUES ($1,$2,$3)
        `,
        [id('tok'), inquiryId, vendorId],
      )
    }
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
      FROM inquiries i
      LEFT JOIN vendor_tokens t ON t.inquiry_id = i.id
      WHERE i.id = $1 AND i.created_by_user_id = $2
      GROUP BY i.id
      `,
      [req.params.id, req.user.id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'not_found' })
    res.json({ inquiry: mapInquiryRow(rows[0]) })
  } catch (err) {
    next(err)
  }
})

app.get('/customer/inquiries/:id/quotes', requireAuth(['customer']), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM inquiries WHERE id = $1 AND created_by_user_id = $2 LIMIT 1`,
      [req.params.id, req.user.id],
    )
    const inquiry = rows[0]
    if (!inquiry) return res.status(404).json({ error: 'not_found' })
    if (!inquiry.quotes_released_to_customer) {
      return res.status(403).json({ error: 'quotes_not_released' })
    }
    const qr = await query(`SELECT * FROM quotes WHERE inquiry_id = $1 ORDER BY submitted_at DESC`, [req.params.id])
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
    const iq = await query(`SELECT * FROM inquiries WHERE id = $1 AND created_by_user_id = $2 LIMIT 1`, [
      req.params.id,
      req.user.id,
    ])
    const inquiry = iq.rows[0]
    if (!inquiry) return res.status(404).json({ error: 'not_found' })
    if (!inquiry.quotes_released_to_customer) return res.status(403).json({ error: 'quotes_not_released' })
    const qq = await query(`SELECT id FROM quotes WHERE id = $1 AND inquiry_id = $2 LIMIT 1`, [quoteId, req.params.id])
    if (!qq.rows[0]) return res.status(404).json({ error: 'quote_not_found' })
    await query(`UPDATE inquiries SET selected_quote_id = $1, status = 'vendor_selected' WHERE id = $2`, [
      quoteId,
      req.params.id,
    ])
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
  },
)

app.get('/admin/inquiries', requireAuth(['admin']), async (_req, res, next) => {
  try {
    const { rows } = await query(
      `
      SELECT i.*, u.name AS customer_name,
             COALESCE(array_agg(t.vendor_id) FILTER (WHERE t.vendor_id IS NOT NULL), '{}') AS matched_vendor_ids
      FROM inquiries i
      JOIN users u ON u.id = i.created_by_user_id
      LEFT JOIN vendor_tokens t ON t.inquiry_id = i.id
      GROUP BY i.id, u.name
      ORDER BY i.created_at DESC
      `,
    )
    res.json({
      inquiries: rows.map((r) => ({
        ...mapInquiryRow(r),
        customerName: r.customer_name,
      })),
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
             COALESCE(array_agg(t.vendor_id) FILTER (WHERE t.vendor_id IS NOT NULL), '{}') AS matched_vendor_ids
      FROM inquiries i
      JOIN users u ON u.id = i.created_by_user_id
      LEFT JOIN vendor_tokens t ON t.inquiry_id = i.id
      WHERE i.id = $1
      GROUP BY i.id, u.name
      `,
      [req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'not_found' })
    const quoteRows = await query(`SELECT * FROM quotes WHERE inquiry_id = $1 ORDER BY submitted_at DESC`, [req.params.id])
    const tokenRows = await query(`SELECT token, vendor_id FROM vendor_tokens WHERE inquiry_id = $1`, [req.params.id])
    res.json({
      inquiry: {
        ...mapInquiryRow(rows[0]),
        customerName: rows[0].customer_name,
      },
      quotes: quoteRows.rows.map(mapQuoteRow),
      tokens: tokenRows.rows.map((r) => ({ token: r.token, vendorId: r.vendor_id })),
    })
  } catch (err) {
    next(err)
  }
})

app.post(
  '/admin/inquiries/:id/release-quotes',
  requireTrustedOrigin,
  requireAuth(['admin']),
  async (req, res, next) => {
  try {
    await query(`UPDATE inquiries SET quotes_released_to_customer = TRUE WHERE id = $1`, [req.params.id])
    res.json({ ok: true })
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
    const existing = await query(`SELECT id FROM quotes WHERE inquiry_id = $1 AND vendor_id = $2 LIMIT 1`, [
      req.params.id,
      vendorId,
    ])
    const quoteId = existing.rows[0]?.id || id('qt')
    await query(
      `
      INSERT INTO quotes (
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
    await query(`UPDATE inquiries SET status = 'quotes_ready' WHERE id = $1 AND status = 'awaiting_quotes'`, [req.params.id])
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
      FROM vendor_tokens t
      JOIN inquiries i ON i.id = t.inquiry_id
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
    const tr = await query(`SELECT inquiry_id, vendor_id FROM vendor_tokens WHERE token = $1 LIMIT 1`, [
      req.params.token,
    ])
    if (!tr.rows[0]) return res.status(404).json({ error: 'invalid_token' })
    const { inquiry_id: inquiryId, vendor_id: vendorId } = tr.rows[0]
    const payload = payloadParse.data
    const existing = await query(`SELECT id FROM quotes WHERE inquiry_id = $1 AND vendor_id = $2 LIMIT 1`, [
      inquiryId,
      vendorId,
    ])
    const quoteId = existing.rows[0]?.id || id('qt')
    await query(
      `
      INSERT INTO quotes (
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
    await query(`UPDATE inquiries SET status = 'quotes_ready' WHERE id = $1 AND status = 'awaiting_quotes'`, [inquiryId])
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'internal_error' })
})

async function start() {
  await ensureSchema()
  await ensureSeedUsers()
  await ensureSeedVendors()
  app.listen(config.port, () => {
    console.log(`API running on http://localhost:${config.port}`)
  })
}

start().catch((err) => {
  console.error('Failed to start API', err)
  process.exit(1)
})
