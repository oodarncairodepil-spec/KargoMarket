import { ensureSchema, ensureSeedVendors } from './schema.js'
import { pool } from './db.js'

async function run() {
  await ensureSchema()
  await ensureSeedVendors()
  console.log('Seed completed (vendors only). Buat pengguna di Supabase Auth + baris user_profiles.)')
}

run()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await pool.end()
  })
