import { Pool } from 'pg'
import { config } from './config.js'

/** Supabase / banyak host Postgres jarak jauh membutuhkan SSL; tanpa ini login di Vercel sering gagal (500). */
function poolConfig() {
  const connectionString = config.databaseUrl
  const sslDisabled =
    process.env.DATABASE_SSL === '0' ||
    process.env.DATABASE_SSL === 'false' ||
    process.env.DATABASE_SSL === 'off'
  const sslRequired =
    !sslDisabled &&
    (process.env.DATABASE_SSL === 'require' ||
      process.env.DATABASE_SSL === '1' ||
      process.env.VERCEL === '1' ||
      /supabase\.co|supabase\.com|neon\.tech|render\.com|amazonaws\.com/i.test(connectionString))
  return {
    connectionString,
    ...(sslRequired ? { ssl: { rejectUnauthorized: false } } : {}),
  }
}

export const pool = new Pool(poolConfig())

export async function query(text, params = []) {
  return pool.query(text, params)
}
