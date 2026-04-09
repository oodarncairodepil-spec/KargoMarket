import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { config } from './config.js'
import { query } from './db.js'

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const SESSION_TTL_MS = 14 * ONE_DAY_MS

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production'
  res.cookie(config.sessionCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: SESSION_TTL_MS,
  })
}

export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production'
  res.clearCookie(config.sessionCookieName, { httpOnly: true, sameSite: 'lax', secure })
}

export async function loginWithPassword({ email, password, expectedRole }) {
  const result = await query(
    `SELECT id, email, password_hash, role, name FROM users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase().trim()],
  )
  const user = result.rows[0]
  if (!user) return null
  if (expectedRole && user.role !== expectedRole) return null
  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) return null

  const token = crypto.randomBytes(24).toString('hex')
  await query(
    `
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES ($1, $2, NOW() + INTERVAL '14 days')
    `,
    [token, user.id],
  )
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
  }
}

export async function sessionFromToken(token) {
  if (!token) return null
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
  return result.rows[0] || null
}

export async function deleteSession(token) {
  if (!token) return
  await query(`DELETE FROM sessions WHERE token = $1`, [token])
}

export function requireAuth(roles = []) {
  return async (req, res, next) => {
    try {
      const token = req.cookies?.[config.sessionCookieName]
      const user = await sessionFromToken(token)
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
