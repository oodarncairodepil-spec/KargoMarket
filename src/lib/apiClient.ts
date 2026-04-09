const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

async function request(path: string, init?: RequestInit) {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      ...init,
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
