import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')
// Pastikan .env ketemu walau `node` dijalankan dari folder lain (cwd bukan root repo).
dotenv.config({ path: path.join(repoRoot, '.env') })
dotenv.config({ path: path.join(repoRoot, '.env.local') })

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
