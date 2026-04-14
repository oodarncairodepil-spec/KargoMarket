import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import './envBootstrap.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** Root repo: backend/src -> ../.. */
const repoRoot = path.resolve(__dirname, '../..')

/**
 * Baca GOOGLE_GEOCODING_API_KEY dari satu file .env (tanpa BOM di awal file).
 */
function readGoogleKeyFromEnvPath(filePath) {
  try {
    if (!fs.existsSync(filePath)) return ''
    let raw = fs.readFileSync(filePath, 'utf8')
    raw = raw.replace(/^\uFEFF/, '')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (trimmed.startsWith('#')) continue
      const m = /^\s*GOOGLE_GEOCODING_API_KEY\s*=\s*(.*)$/.exec(line)
      if (m) {
        const v = m[1].trim().replace(/^["']|["']$/g, '')
        return v
      }
    }
  } catch {
    /* ignore */
  }
  return ''
}

/**
 * Kunci geocoding: baca ulang dari process.env + beberapa lokasi .env (dev sering salah cwd).
 * Dipanggil per request agar tidak tergantung urutan evaluasi modul vs dotenv.
 */
export function getGoogleGeocodingApiKey() {
  const fromEnv = (process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim()
  if (fromEnv) return fromEnv

  const candidateRoots = new Set([
    repoRoot,
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(__dirname, '..', '..'),
  ])

  const tried = new Set()
  for (const root of candidateRoots) {
    const normalized = path.normalize(root)
    if (tried.has(normalized)) continue
    tried.add(normalized)

    const bases = [root, path.join(root, 'backend')]
    for (const base of bases) {
      for (const name of ['.env', '.env.local']) {
        const p = path.join(base, name)
        const key = readGoogleKeyFromEnvPath(p)
        if (key) return key
      }
    }
  }

  return ''
}

export const config = {
  port: Number(process.env.API_PORT || 4000),
  appOrigins: (process.env.APP_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  databaseUrl: process.env.DATABASE_URL || '',
  supabaseUrl: (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim(),
  // Fallback VITE_* hanya untuk dev/kesalahan penamaan; jangan impor service role ke kode frontend.
  supabaseServiceRoleKey: (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim(),
  /** Opsional: JWT Secret (Settings → API) — mempercepat /auth/me dengan verifikasi lokal tanpa panggilan ke Supabase Auth. */
  supabaseJwtSecret: (process.env.SUPABASE_JWT_SECRET || '').trim(),
}

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required. Example: postgres://user:pass@localhost:5432/kargomarket')
}
