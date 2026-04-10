import { jwtVerify } from 'jose'
import { config } from './config.js'
import { query } from './db.js'
import { supabaseAdmin } from './supabaseAdmin.js'

function bearerToken(req) {
  const auth = req.headers.authorization
  return auth?.startsWith('Bearer ') ? auth.slice(7).trim() : ''
}

/**
 * Verifikasi JWT cepat (tanpa round-trip ke Supabase) bila SUPABASE_JWT_SECRET diset.
 * @param {string} jwt
 * @returns {Promise<{ id: string, email: string } | null>}
 */
async function verifyAccessTokenLocally(jwt) {
  const secret = config.supabaseJwtSecret
  if (!secret) return null
  try {
    const { payload } = await jwtVerify(jwt, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
    })
    const sub = typeof payload.sub === 'string' ? payload.sub : ''
    if (!sub) return null
    const email = typeof payload.email === 'string' ? payload.email : ''
    return { id: sub, email }
  } catch {
    return null
  }
}

/**
 * @param {string} jwt
 * @returns {Promise<import('@supabase/supabase-js').User | { id: string, email: string } | null>}
 */
async function getSupabaseAuthUser(jwt) {
  const local = await verifyAccessTokenLocally(jwt)
  if (local) return local

  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin.auth.getUser(jwt)
  if (!error && data?.user) return data.user

  const base = config.supabaseUrl.replace(/\/$/, '')
  const key = config.supabaseServiceRoleKey
  if (!base || !key) return null
  try {
    const res = await fetch(`${base}/auth/v1/user`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${jwt}`,
      },
    })
    if (!res.ok) return null
    const body = await res.json()
    if (body?.id) return /** @type {import('@supabase/supabase-js').User} */ (body)
    if (body?.user?.id) return body.user
  } catch {
    return null
  }
  return null
}

/**
 * @param {string} userId
 */
async function lookupProfileById(userId) {
  try {
    const { rows } = await query(
      `SELECT id, role, name FROM km_lookup_user_profile($1::uuid)`,
      [userId],
    )
    if (rows[0]) return rows[0]
  } catch (err) {
    if (err?.code !== '42883') throw err
  }
  const { rows } = await query(
    `SELECT id, role, name FROM public.user_profiles WHERE id = $1::uuid LIMIT 1`,
    [userId],
  )
  return rows[0] || null
}

/**
 * @param {import('express').Request} req
 * @param {{ requireToken?: boolean }} [options]
 * @returns {Promise<{ user: { id: string, email: string, role: string, name: string } | null, authError: string | null }>}
 */
export async function resolveUserFromRequest(req, options = {}) {
  const requireToken = options.requireToken === true
  const raw = bearerToken(req)

  if (!raw) {
    return { user: null, authError: requireToken ? 'no_token' : null }
  }

  const su = await getSupabaseAuthUser(raw)
  if (!su?.id) {
    const canVerify = Boolean(supabaseAdmin || config.supabaseJwtSecret)
    if (!canVerify) {
      console.error(
        'Auth verify unavailable: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_JWT_SECRET for local JWT verify',
      )
      return { user: null, authError: 'server_misconfigured' }
    }
    return { user: null, authError: 'invalid_token' }
  }

  const row = await lookupProfileById(su.id)
  if (!row) {
    return { user: null, authError: 'profile_missing' }
  }

  return {
    user: {
      id: String(row.id),
      email: su.email || '',
      role: row.role,
      name: row.name,
    },
    authError: null,
  }
}

export function requireAuth(roles = []) {
  return async (req, res, next) => {
    try {
      const { user, authError } = await resolveUserFromRequest(req, { requireToken: true })
      if (!user) {
        const code = authError || 'unauthorized'
        const status =
          code === 'server_misconfigured'
            ? 503
            : code === 'profile_missing'
              ? 403
              : 401
        return res.status(status).json({ error: code })
      }
      if (roles.length > 0 && !roles.includes(user.role)) {
        return res.status(403).json({ error: 'forbidden' })
      }
      req.user = user
      return next()
    } catch (err) {
      return next(err)
    }
  }
}
