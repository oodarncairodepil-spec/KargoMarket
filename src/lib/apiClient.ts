import { supabase } from './supabase'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:4000' : '/api')

let authHeaderCache: { headers: Record<string, string>; until: number } = { headers: {}, until: 0 }

/** Panggil setelah logout agar token tidak di-cache salah. */
export function clearApiAuthHeaderCache() {
  authHeaderCache = { headers: {}, until: 0 }
}

async function authHeaders(): Promise<Record<string, string>> {
  const now = Date.now()
  if (now < authHeaderCache.until && Object.keys(authHeaderCache.headers).length > 0) {
    return authHeaderCache.headers
  }
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  const headers: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {}
  authHeaderCache = { headers, until: now + 20_000 }
  return headers
}

async function request(path: string, init?: RequestInit) {
  let res: Response
  const extra = await authHeaders()
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...extra,
        ...(init?.headers || {}),
      },
    })
  } catch {
    throw new Error('api_unreachable')
  }

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `request_failed_${res.status}`
    throw new Error(message)
  }
  return body
}

export const apiClient = {
  get: (path: string) => request(path, { method: 'GET' }),
  post: (path: string, payload?: unknown) =>
    request(path, { method: 'POST', body: payload == null ? undefined : JSON.stringify(payload) }),
}
