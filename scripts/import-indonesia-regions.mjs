/**
 * Impor provinsi & kabupaten/kota BPS dari gilang-as/indonesian-region-code (json-full).
 * Prasyarat: migrasi `20260416_id_regions.sql` sudah dijalankan; `DATABASE_URL` di .env.
 *
 *   node scripts/import-indonesia-regions.mjs
 *
 * Opsi env:
 *   INDO_REGION_JSON_BASE — URL dasar folder json-full (default raw GitHub main).
 */

import '../backend/src/envBootstrap.js'
import { Pool } from 'pg'
import { config } from '../backend/src/config.js'
import {
  normalizeCityForMatch,
  normalizeProvinceForMatch,
  parseBpsRegencyName,
  toTitleCaseId,
} from '../backend/src/regionNormalize.js'

const DEFAULT_BASE =
  'https://raw.githubusercontent.com/gilang-as/indonesian-region-code/main/docs/json-full'

const BASE = (process.env.INDO_REGION_JSON_BASE || DEFAULT_BASE).replace(/\/$/, '')
const BATCH = Math.min(500, Math.max(50, Number(process.env.INDO_REGION_BATCH) || 250))

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
      /supabase\.co|supabase\.com|neon\.tech|render\.com|amazonaws\.com/i.test(connectionString))
  return {
    connectionString,
    ...(sslRequired ? { ssl: { rejectUnauthorized: false } } : {}),
  }
}

async function fetchJson(path) {
  const url = `${BASE}/${path}`
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 120_000)
  try {
    const r = await fetch(url, { signal: ac.signal })
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`)
    return await r.json()
  } finally {
    clearTimeout(t)
  }
}

async function main() {
  console.log('Mengambil dataset dari', BASE)
  const [provinces, regencies] = await Promise.all([
    fetchJson('provinces.json'),
    fetchJson('regencies.json'),
  ])
  if (!Array.isArray(provinces) || !Array.isArray(regencies)) {
    throw new Error('Format JSON tidak valid (harus array).')
  }

  const provByCode = new Map()
  for (const p of provinces) {
    const code = String(p.code)
    const displayName = toTitleCaseId(String(p.name || ''))
    const nameNormalized = normalizeProvinceForMatch(displayName)
    provByCode.set(code, { id: BigInt(p.id), code, displayName, nameNormalized })
  }

  const pool = new Pool(poolConfig())
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    for (let i = 0; i < provinces.length; i += BATCH) {
      const chunk = provinces.slice(i, i + BATCH)
      const vals = []
      const params = []
      let n = 1
      for (const p of chunk) {
        const row = provByCode.get(String(p.code))
        if (!row) continue
        vals.push(`($${n++}, $${n++}, $${n++}, $${n++})`)
        params.push(row.id, row.code, row.displayName, row.nameNormalized)
      }
      if (vals.length) {
        await client.query(
          `
          INSERT INTO id_provinces (id, code, name, name_normalized)
          VALUES ${vals.join(',')}
          ON CONFLICT (id) DO UPDATE SET
            code = EXCLUDED.code,
            name = EXCLUDED.name,
            name_normalized = EXCLUDED.name_normalized
          `,
          params,
        )
      }
    }

    /**
   * Di json-full, field `id` regensi hanya unik per provinsi (berulang lintas provinsi).
   * Kode wilayah BPS (`code`) unik nasional — dipakai sebagai PK bigint `id_cities.id`.
   */
  const cityRows = []
    for (const r of regencies) {
      const prov = provByCode.get(String(r.province_code))
      if (!prov) continue
      const codeStr = String(r.code || '').trim()
      if (!/^\d+$/.test(codeStr)) {
        console.warn('Lewati regensi tanpa kode numerik:', r)
        continue
      }
      const { cityType, rest } = parseBpsRegencyName(String(r.name || ''))
      const cityName = toTitleCaseId(rest)
      const provinceName = prov.displayName
      const fullName = `${cityType} ${cityName}, ${provinceName}`
      const cityNormalized = normalizeCityForMatch(rest)
      const provinceNormalized = prov.nameNormalized
      cityRows.push({
        id: BigInt(codeStr),
        code: codeStr,
        province_code: String(r.province_code),
        city_type: cityType,
        city_name: cityName,
        province_name: provinceName,
        full_name: fullName,
        city_normalized: cityNormalized,
        province_normalized: provinceNormalized,
      })
    }

    for (let i = 0; i < cityRows.length; i += BATCH) {
      const chunk = cityRows.slice(i, i + BATCH)
      const vals = []
      const params = []
      let n = 1
      for (const c of chunk) {
        vals.push(
          `($${n++}, $${n++}, $${n++}, $${n++}, $${n++}, $${n++}, $${n++}, $${n++}, $${n++})`,
        )
        params.push(
          c.id,
          c.code,
          c.province_code,
          c.city_type,
          c.city_name,
          c.province_name,
          c.full_name,
          c.city_normalized,
          c.province_normalized,
        )
      }
      await client.query(
        `
        INSERT INTO id_cities (
          id, code, province_code, city_type, city_name, province_name,
          full_name, city_normalized, province_normalized
        ) VALUES ${vals.join(',')}
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          province_code = EXCLUDED.province_code,
          city_type = EXCLUDED.city_type,
          city_name = EXCLUDED.city_name,
          province_name = EXCLUDED.province_name,
          full_name = EXCLUDED.full_name,
          city_normalized = EXCLUDED.city_normalized,
          province_normalized = EXCLUDED.province_normalized
        `,
        params,
      )
    }

    await client.query('COMMIT')
    console.log(
      `Selesai: ${provinces.length} provinsi, ${cityRows.length} kab/kota (dari ${regencies.length} baris sumber).`,
    )
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
