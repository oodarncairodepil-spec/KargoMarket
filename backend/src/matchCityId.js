import { query } from './db.js'
import { normalizeCityForMatch, normalizeProvinceForMatch } from './regionNormalize.js'

/**
 * Cocokkan kota/kab Google ke baris id_cities (setelah impor BPS).
 * @param {string} city
 * @param {string} province
 * @returns {Promise<{ id: string, label: string } | null>}
 */
export async function resolveMatchedCityId(city, province) {
  const cn = normalizeCityForMatch(city)
  const pn = normalizeProvinceForMatch(province)
  if (!cn) return null

  if (pn) {
    const { rows } = await query(
      `SELECT id, full_name FROM id_cities
       WHERE city_normalized = $1 AND province_normalized = $2
       LIMIT 1`,
      [cn, pn],
    )
    if (rows[0]) {
      return { id: String(rows[0].id), label: rows[0].full_name }
    }
  }

  const provTrim = String(province || '').trim()
  if (provTrim) {
    const provLike = `%${provTrim
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_')
      .slice(0, 64)}%`

    const { rows: rows2 } = await query(
      `SELECT id, full_name FROM id_cities
       WHERE city_normalized = $1
         AND (
           province_name ILIKE $2 ESCAPE '\\'
           OR ($3 <> '' AND province_normalized LIKE $3 || '%')
         )
       LIMIT 2`,
      [cn, provLike, pn || ''],
    )
    if (rows2.length === 1) {
      return { id: String(rows2[0].id), label: rows2[0].full_name }
    }
  }

  const { rows: rows3 } = await query(
    `SELECT id, full_name FROM id_cities WHERE city_normalized = $1`,
    [cn],
  )
  if (rows3.length === 1) {
    return { id: String(rows3[0].id), label: rows3[0].full_name }
  }

  return null
}
