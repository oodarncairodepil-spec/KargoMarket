import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from './auth.js'
import { query } from './db.js'

export const locationsRouter = Router()

const searchQuerySchema = z.object({
  q: z.string().trim().min(3).max(120),
  limit: z.coerce.number().int().min(1).max(10).optional().default(10),
})

function sanitizeTsQueryInput(q) {
  return q
    .replace(/[^\w\s\u0080-\uFFFF-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

function escapeLike(s) {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

locationsRouter.get('/locations/search', requireAuth(['customer', 'admin']), async (req, res, next) => {
  try {
    const parsed = searchQuerySchema.safeParse({ q: req.query.q, limit: req.query.limit })
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_query' })
    }
    const { q, limit } = parsed.data
    const tsInput = sanitizeTsQueryInput(q)
    const likePat = `%${escapeLike(q.slice(0, 120))}%`

    const { rows } = await query(
      `
      WITH hits AS (
        SELECT
          c.id,
          c.code,
          c.province_code,
          c.city_type,
          c.city_name,
          c.province_name,
          c.full_name,
          CASE
            WHEN tsInput <> '' AND c.search_vector @@ plainto_tsquery('simple', tsInput)
              THEN ts_rank_cd(c.search_vector, plainto_tsquery('simple', tsInput))
            ELSE 0
          END AS ts_score,
          CASE
            WHEN c.full_name ILIKE likePat ESCAPE '\\' THEN 1
            ELSE 0
          END AS like_hit
        FROM id_cities c,
        (SELECT $1::text AS tsInput, $2::text AS likePat) p
        WHERE
          (length(trim(p.tsInput)) > 0 AND c.search_vector @@ plainto_tsquery('simple', p.tsInput))
          OR c.full_name ILIKE p.likePat ESCAPE '\\'
          OR c.city_name ILIKE p.likePat ESCAPE '\\'
      )
      SELECT id, code, province_code, city_type, city_name, province_name, full_name,
        (ts_score * 10 + like_hit)::float AS _ord
      FROM hits
      ORDER BY _ord DESC, full_name ASC
      LIMIT $3
      `,
      [tsInput, likePat, limit],
    )

    const out = rows.map((r) => ({
      id: String(r.id),
      code: r.code,
      provinceCode: r.province_code,
      cityType: r.city_type,
      cityName: r.city_name,
      provinceName: r.province_name,
      fullName: r.full_name,
      label: r.full_name,
    }))
    res.json(out)
  } catch (err) {
    next(err)
  }
})
