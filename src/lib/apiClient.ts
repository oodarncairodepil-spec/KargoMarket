import { supabase } from './supabase'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:4000' : '/api')

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  return t ? { Authorization: `Bearer ${t}` } : {}
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
