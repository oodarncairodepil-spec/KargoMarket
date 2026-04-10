import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: Number(process.env.API_PORT || 4000),
  appOrigins: (process.env.APP_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  databaseUrl: process.env.DATABASE_URL || '',
  supabaseUrl: (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim(),
  supabaseServiceRoleKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
}

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required. Example: postgres://user:pass@localhost:5432/kargomarket')
}
