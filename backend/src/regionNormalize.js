/**
 * Normalisasi nama kota/kab & provinsi untuk cocok dengan kolom id_cities (impor BPS) & Google Geocoding.
 */

const STOP = new Set([
  'kabupaten',
  'kota',
  'kab',
  'adm',
  'administrasi',
  'daerah',
  'khusus',
  'ibu',
  'provinsi',
  'kepulauan',
  'kep',
])

/** Google EN → segmen Indonesia (Jakarta). */
const JAKARTA_EN = [
  ['south jakarta', 'jakarta selatan'],
  ['east jakarta', 'jakarta timur'],
  ['central jakarta', 'jakarta pusat'],
  ['west jakarta', 'jakarta barat'],
  ['north jakarta', 'jakarta utara'],
  ['thousand islands', 'kepulauan seribu'],
]

function squashSpaces(s) {
  return s.replace(/\s+/g, ' ').trim()
}

function stripStopwords(tokens) {
  return tokens.filter((t) => t && !STOP.has(t))
}

/**
 * Token lowercase untuk matching kota/kab (BPS rest name atau string Google).
 * @param {string} raw
 */
export function normalizeCityForMatch(raw) {
  if (!raw || typeof raw !== 'string') return ''
  let s = raw.toLowerCase().replace(/\./g, ' ')
  const squashed = squashSpaces(s)
  for (const [en, id] of JAKARTA_EN) {
    if (squashed.includes(en)) {
      s = squashed.replace(new RegExp(en.replace(/\s+/g, '\\s+'), 'gi'), id)
      break
    }
  }
  s = squashSpaces(s.replace(/[^a-z0-9\s]/gi, ' '))
  const parts = stripStopwords(s.split(/\s+/).filter(Boolean))
  return squashSpaces(parts.join(' '))
}

/**
 * @param {string} raw
 */
/** Nama provinsi ala Google (EN) → label mendekati BPS untuk normalisasi. */
const PROVINCE_GOOGLE_EN = {
  'west java': 'Jawa Barat',
  'east java': 'Jawa Timur',
  'central java': 'Jawa Tengah',
  'special region of yogyakarta': 'DI Yogyakarta',
  'special capital region of jakarta': 'DKI Jakarta',
  'jakarta': 'DKI Jakarta',
  'north sumatra': 'Sumatera Utara',
  'south sumatra': 'Sumatera Selatan',
  'west sumatra': 'Sumatera Barat',
  'riau islands': 'Kep. Riau',
  'bangka belitung islands': 'Kep. Bangka Belitung',
  'north kalimantan': 'Kalimantan Utara',
  'east kalimantan': 'Kalimantan Timur',
  'south kalimantan': 'Kalimantan Selatan',
  'central kalimantan': 'Kalimantan Tengah',
  'west kalimantan': 'Kalimantan Barat',
  'north sulawesi': 'Sulawesi Utara',
  'south sulawesi': 'Sulawesi Selatan',
  'central sulawesi': 'Sulawesi Tengah',
  'southeast sulawesi': 'Sulawesi Tenggara',
  'west sulawesi': 'Sulawesi Barat',
  'west nusa tenggara': 'Nusa Tenggara Barat',
  'east nusa tenggara': 'Nusa Tenggara Timur',
  'west papua': 'Papua Barat',
  'southwest papua': 'Papua Barat Daya',
  'central papua': 'Papua Tengah',
  'highland papua': 'Papua Pegunungan',
  'south papua': 'Papua Selatan',
}

/**
 * Perbaiki label provinsi dari Google (sering EN) sebelum normalisasi token.
 * @param {string} raw
 */
export function expandGoogleProvinceName(raw) {
  if (!raw || typeof raw !== 'string') return ''
  const k = squashSpaces(raw.toLowerCase().replace(/\./g, ' '))
  return PROVINCE_GOOGLE_EN[k] || raw
}

export function normalizeProvinceForMatch(raw) {
  if (!raw || typeof raw !== 'string') return ''
  const expanded = expandGoogleProvinceName(raw)
  let s = expanded.toLowerCase().replace(/\./g, ' ')
  s = squashSpaces(s.replace(/[^a-z0-9\s]/gi, ' '))
  if (/^(dki|jakarta)\b/.test(s) || s.includes('daerah khusus ibukota') || s.includes('ibukota jakarta')) {
    return 'dki jakarta'
  }
  const parts = stripStopwords(s.split(/\s+/).filter(Boolean))
  if (parts.join(' ') === 'jakarta') return 'dki jakarta'
  return squashSpaces(parts.join(' '))
}

/**
 * Judul kasus ringan untuk tampilan (nama provinsi/kota dari data BPS UPPERCASE).
 * @param {string} raw
 */
export function toTitleCaseId(raw) {
  if (!raw || typeof raw !== 'string') return ''
  return squashSpaces(
    raw
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' '),
  )
}

/**
 * Pecah nama regensi BPS jadi tipe & sisa nama.
 * @param {string} name
 * @returns {{ cityType: 'Kota' | 'Kabupaten', rest: string }}
 */
export function parseBpsRegencyName(name) {
  const u = String(name || '').trim()
  if (/^KAB\.\s*/i.test(u)) {
    return { cityType: 'Kabupaten', rest: u.replace(/^KAB\.\s*/i, '').trim() }
  }
  if (/^KABUPATEN\s+/i.test(u)) {
    return { cityType: 'Kabupaten', rest: u.replace(/^KABUPATEN\s+/i, '').trim() }
  }
  if (/^KOTA\s+/i.test(u)) {
    return { cityType: 'Kota', rest: u.replace(/^KOTA\s+/i, '').trim() }
  }
  return { cityType: 'Kabupaten', rest: u }
}
