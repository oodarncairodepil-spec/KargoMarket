import { createClient } from 'npm:@supabase/supabase-js@2'

type BroadcastErrorStage = 'inquiry_fetch' | 'vendor_query' | 'token_insert' | 'email_send'

type BroadcastError = {
  vendorId?: string
  vendorEmail?: string
  stage: BroadcastErrorStage
  message: string
}

type BroadcastSummary = {
  success: number
  failed: number
  errors: BroadcastError[]
}

type InquiryRow = {
  id: string
  pickup_kota: string
  destination_kota: string
  item_description: string
  weight: string
  scheduled_pickup_date: string
}

type VendorRow = {
  id: string
  name: string
  email: string | null
  origin_cities?: string[] | null
  destination_cities?: string[] | null
  is_active?: boolean | null
}

type TokenRow = {
  token: string
  vendor_id: string
}

function requiredEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function baseUrlFromEnv(): string {
  const raw = (Deno.env.get('VENDOR_QUOTE_BASE_URL') || 'https://kargomarket.id').trim()
  return raw.replace(/\/+$/, '')
}

function randomToken(prefix = 'tok_'): string {
  // URL-safe token: base64url(18 bytes) ≈ 24 chars
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  const b64 = btoa(String.fromCharCode(...bytes))
  const b64url = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  return `${prefix}${b64url}`
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderInquiryEmail(input: {
  companyName: string
  originCity: string
  destinationCity: string
  description: string
  weight: string
  pickupDate: string
  ctaUrl: string
}): string {
  const companyName = escapeHtml(input.companyName)
  const origin = escapeHtml(input.originCity)
  const dest = escapeHtml(input.destinationCity)
  const desc = escapeHtml(input.description)
  const weight = escapeHtml(input.weight)
  const pickupDate = escapeHtml(input.pickupDate || '—')
  const ctaUrl = input.ctaUrl

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>New Shipment Inquiry</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    <div style="padding:24px 12px;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="padding:18px 18px 0;">
          <p style="margin:0;color:#111827;font-size:18px;font-weight:700;">New Shipment Inquiry</p>
          <p style="margin:8px 0 0;color:#374151;font-size:14px;">Hello ${companyName},</p>
        </div>
        <div style="padding:18px;">
          <div style="background:#f9fafb;border:1px solid #eef2f7;border-radius:12px;padding:14px;">
            <p style="margin:0;color:#111827;font-size:14px;font-weight:700;">Route</p>
            <p style="margin:6px 0 0;color:#111827;font-size:16px;font-weight:700;">${origin} → ${dest}</p>
            <div style="height:10px;"></div>
            <p style="margin:0;color:#111827;font-size:13px;font-weight:700;">Description</p>
            <p style="margin:6px 0 0;color:#374151;font-size:14px;line-height:1.4;">${desc}</p>
            <div style="height:10px;"></div>
            <p style="margin:0;color:#111827;font-size:13px;font-weight:700;">Weight</p>
            <p style="margin:6px 0 0;color:#374151;font-size:14px;">${weight}</p>
            <div style="height:10px;"></div>
            <p style="margin:0;color:#111827;font-size:13px;font-weight:700;">Pickup date</p>
            <p style="margin:6px 0 0;color:#374151;font-size:14px;">${pickupDate}</p>
          </div>

          <div style="height:16px;"></div>
          <a href="${ctaUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:700;font-size:14px;">
            Submit Quotation
          </a>
          <p style="margin:14px 0 0;color:#6b7280;font-size:12px;line-height:1.4;">
            If the button doesn’t work, copy and paste this link:<br />
            <span style="color:#2563eb;word-break:break-all;">${escapeHtml(ctaUrl)}</span>
          </p>
        </div>
        <div style="padding:14px 18px;border-top:1px solid #eef2f7;background:#fbfbfc;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">KargoMarket · This is an automated email.</p>
        </div>
      </div>
    </div>
  </body>
</html>`
}

async function sendEmail(input: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = requiredEnv('RESEND_API_KEY')
  const controller = new AbortController()
  const timeoutMs = 15_000
  const t = setTimeout(() => controller.abort('timeout'), timeoutMs)
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'KargoMarket <noreply@mail.kargomarket.id>',
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Resend error ${res.status}: ${text || res.statusText}`)
    }
  } finally {
    clearTimeout(t)
  }
}

export async function sendInquiryBroadcast(inquiryId: string): Promise<BroadcastSummary> {
  const summary: BroadcastSummary = { success: 0, failed: 0, errors: [] }
  const supabaseUrl = requiredEnv('SUPABASE_URL')
  const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log(`[broadcast] start inquiryId=${inquiryId}`)

  const { data: inquiry, error: inqErr } = await supabase
    .from('km_inquiries')
    .select('id,pickup_kota,destination_kota,item_description,weight,scheduled_pickup_date')
    .eq('id', inquiryId)
    .maybeSingle<InquiryRow>()

  if (inqErr || !inquiry) {
    summary.failed += 1
    summary.errors.push({
      stage: 'inquiry_fetch',
      message: inqErr?.message || 'Inquiry not found',
    })
    return summary
  }

  const originCity = inquiry.pickup_kota
  const destinationCity = inquiry.destination_kota

  // Vendor query (try with is_active; fallback if column missing).
  let vendors: VendorRow[] = []
  {
    const base = supabase
      .from('vendors')
      .select('id,name,email,origin_cities,destination_cities,is_active')
      .contains('origin_cities', [originCity])
      .contains('destination_cities', [destinationCity])

    const r1 = await base
    if (r1.error && /is_active/i.test(r1.error.message)) {
      const r2 = await supabase
        .from('vendors')
        .select('id,name,email,origin_cities,destination_cities')
        .contains('origin_cities', [originCity])
        .contains('destination_cities', [destinationCity])
      if (r2.error) {
        summary.failed += 1
        summary.errors.push({ stage: 'vendor_query', message: r2.error.message })
        return summary
      }
      vendors = (r2.data || []) as VendorRow[]
    } else if (r1.error) {
      summary.failed += 1
      summary.errors.push({ stage: 'vendor_query', message: r1.error.message })
      return summary
    } else {
      vendors = (r1.data || []) as VendorRow[]
    }
  }

  // Optional: enforce active vendors only if field is present.
  vendors = vendors.filter((v) => v.email && v.email.includes('@')).filter((v) => v.is_active !== false)

  // Fallback: jika data onboarding `origin_cities/destination_cities` belum terisi,
  // gunakan daftar vendor yang sudah punya token di km_vendor_tokens (dibuat oleh backend).
  // Ini memastikan broadcast tetap berjalan untuk inquiry yang sudah dibuat.
  const tokensByVendor = new Map<string, string>()
  if (vendors.length === 0) {
    const { data: tokenRows, error: tokenErr } = await supabase
      .from('km_vendor_tokens')
      .select('token,vendor_id')
      .eq('inquiry_id', inquiryId)
      .is('revoked_at', null)
      .returns<TokenRow[]>()
    if (tokenErr) {
      summary.failed += 1
      summary.errors.push({ stage: 'vendor_query', message: tokenErr.message })
      return summary
    }
    for (const t of tokenRows || []) tokensByVendor.set(t.vendor_id, t.token)
    const vendorIds = Array.from(tokensByVendor.keys())
    if (vendorIds.length > 0) {
      const { data: vendorRows, error: vErr } = await supabase
        .from('vendors')
        .select('id,name,email,is_active')
        .in('id', vendorIds)
        .returns<VendorRow[]>()
      if (vErr) {
        summary.failed += 1
        summary.errors.push({ stage: 'vendor_query', message: vErr.message })
        return summary
      }
      vendors = (vendorRows || []).filter((v) => v.email && v.email.includes('@')).filter((v) => v.is_active !== false)
      console.log(`[broadcast] fallback_from_tokens vendors=${vendors.length} tokens=${vendorIds.length}`)
    }
  }

  console.log(`[broadcast] inquiry=${inquiry.id} match=${vendors.length} origin=${originCity} dest=${destinationCity}`)

  const quoteBaseUrl = baseUrlFromEnv()
  const subject = 'New Shipment Inquiry - Submit Your Quote'

  for (const v of vendors) {
    const vendorId = v.id
    const vendorEmail = v.email || ''

    try {
      // Idempotency: reuse existing token if already generated for (inquiry,vendor).
      const { data: existing, error: existingErr } = await supabase
        .from('km_vendor_tokens')
        .select('token,revoked_at')
        .eq('inquiry_id', inquiryId)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ token: string; revoked_at: string | null }>()

      if (existingErr) {
        summary.failed += 1
        summary.errors.push({ vendorId, vendorEmail, stage: 'token_insert', message: existingErr.message })
        continue
      }

      let token = existing?.token || tokensByVendor.get(vendorId) || null
      if (!token || existing?.revoked_at) {
        // Insert new token, retry on collision a few times.
        const maxTries = 3
        let inserted = false
        for (let attempt = 1; attempt <= maxTries; attempt++) {
          const candidate = randomToken('tok_')
          const { error: insErr } = await supabase.from('km_vendor_tokens').insert({
            token: candidate,
            inquiry_id: inquiryId,
            vendor_id: vendorId,
          })
          if (!insErr) {
            token = candidate
            inserted = true
            break
          }
          if (/duplicate key|already exists/i.test(insErr.message)) {
            // collision on token primary key; retry
            continue
          }
          // other errors (e.g. unique (inquiry,vendor) if added)
          if (/inquiry_id.*vendor_id|unique/i.test(insErr.message)) {
            const { data: again } = await supabase
              .from('km_vendor_tokens')
              .select('token')
              .eq('inquiry_id', inquiryId)
              .eq('vendor_id', vendorId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle<{ token: string }>()
            if (again?.token) {
              token = again.token
              inserted = true
              break
            }
          }
          throw insErr
        }
        if (!inserted || !token) throw new Error('Failed to insert token')
      }

      const ctaUrl = `${quoteBaseUrl}/vendor/quote/${token}`
      const html = renderInquiryEmail({
        companyName: v.name || 'Vendor',
        originCity,
        destinationCity,
        description: inquiry.item_description,
        weight: inquiry.weight,
        pickupDate: inquiry.scheduled_pickup_date,
        ctaUrl,
      })

      await sendEmail({ to: vendorEmail, subject, html })
      summary.success += 1
      console.log(`[broadcast] sent vendorId=${vendorId} email=${vendorEmail}`)
    } catch (err) {
      summary.failed += 1
      summary.errors.push({
        vendorId,
        vendorEmail,
        stage: String(err).includes('Resend') ? 'email_send' : 'token_insert',
        message: err instanceof Error ? err.message : String(err),
      })
      console.log(`[broadcast] failed vendorId=${vendorId} email=${vendorEmail} err=${err instanceof Error ? err.message : String(err)}`)
    }

    // Rate-limit safety
    await sleep(220)
  }

  console.log(`[broadcast] done inquiryId=${inquiryId} ok=${summary.success} failed=${summary.failed}`)
  return summary
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    })
  }

  if (req.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' })

  try {
    const payload = (await req.json().catch(() => null)) as { inquiryId?: string } | null
    const inquiryId = payload?.inquiryId?.trim()
    if (!inquiryId) return jsonResponse(400, { error: 'missing_inquiry_id' })
    const summary = await sendInquiryBroadcast(inquiryId)
    return jsonResponse(200, summary)
  } catch (err) {
    console.log(`[broadcast] handler_error ${err instanceof Error ? err.message : String(err)}`)
    return jsonResponse(500, { error: 'internal_error' })
  }
})

