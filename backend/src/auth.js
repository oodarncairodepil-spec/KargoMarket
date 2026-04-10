import { config } from './config.js'
import { query } from './db.js'
import { supabaseAdmin } from './supabaseAdmin.js'

/**
 * @returns {Promise<{ id: string, email: string, role: string, name: string } | null>}
 */
export async function resolveUserFromRequest(req) {
  if (!supabaseAdmin) {
    console.error('Supabase admin client missing: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    return null
  }
  const auth = req.headers.authorization
  const raw = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!raw) return null

  const { data, error } = await supabaseAdmin.auth.getUser(raw)
  if (error || !data?.user) return null

  const su = data.user
  const { rows } = await query(
    `SELECT id, role, name FROM user_profiles WHERE id = $1::uuid LIMIT 1`,
    [su.id],
  )
  const row = rows[0]
  if (!row) return null

  return {
    id: String(row.id),
    email: su.email || '',
    role: row.role,
    name: row.name,
  }
}

export function requireAuth(roles = []) {
  return async (req, res, next) => {
    try {
      const user = await resolveUserFromRequest(req)
      if (!user) return res.status(401).json({ error: 'unauthorized' })
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
