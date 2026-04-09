import { app, ensureInitialized } from '../backend/src/server.js'

export default async function handler(req, res) {
  try {
    await ensureInitialized()
    if (typeof req.url === 'string' && req.url.startsWith('/api/')) {
      req.url = req.url.slice(4) || '/'
    }
    return app(req, res)
  } catch (err) {
    console.error('Failed to initialize API', err)
    return res.status(500).json({ error: 'internal_error' })
  }
}
