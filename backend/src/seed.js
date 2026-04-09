import { ensureSchema, ensureSeedUsers, ensureSeedVendors } from './schema.js'
import { pool } from './db.js'

async function run() {
  await ensureSchema()
  await ensureSeedUsers()
  await ensureSeedVendors()
  console.log('Seed completed.')
}

run()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await pool.end()
  })
