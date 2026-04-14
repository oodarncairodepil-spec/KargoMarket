/**
 * Parser address_components dari Google Geocoding API (reverse geocode).
 * Di Indonesia, kota/kab sering ada di administrative_area_level_2, bukan locality
 * (locality bisa nama kelurahan/daerah kecil).
 */

function firstLongName(components, type) {
  const c = components.find((x) => x.types && x.types.includes(type))
  return c ? String(c.long_name || '').trim() : ''
}

/**
 * Ambil segmen kota dari formatted_address bila komponen tidak cukup.
 * @param {string} formatted
 */
function cityFromFormattedAddress(formatted) {
  if (!formatted || typeof formatted !== 'string') return ''
  const parts = formatted
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length < 2) return ''
  // Pola umum ID: …, Kecamatan, Kota/Kab, Provinsi, …, kodepos, Indonesia
  for (let i = parts.length - 2; i >= Math.max(0, parts.length - 8); i--) {
    const p = parts[i]
    if (/^(kota |kabupaten |kab\.|kota\.)/i.test(p)) return p
    if (/jakarta|surabaya|bandung|bekasi|bogor|depok|tangerang|medan|semarang|makassar|yogyakarta|denpasar/i.test(p)) {
      return p
    }
  }
  // Fallback: satu segmen sebelum provinsi (biasanya 3–4 dari belakang sebelum "Indonesia")
  const idxIndonesia = parts.findIndex((p) => /^indonesia$/i.test(p))
  if (idxIndonesia > 2) {
    return parts[idxIndonesia - 2] || parts[idxIndonesia - 3] || ''
  }
  return parts[Math.max(0, parts.length - 4)] || ''
}

/**
 * @param {Array<{ long_name: string, short_name: string, types: string[] }>} components
 * @param {string} [formattedAddress]
 * @returns {{ city: string, province: string, postalCode: string, kelurahan: string, kecamatan: string }}
 */
export function parseGoogleAddressComponents(components, formattedAddress = '') {
  if (!Array.isArray(components) || components.length === 0) {
    return {
      city: '',
      province: '',
      postalCode: '',
      kelurahan: '—',
      kecamatan: '—',
    }
  }

  const province = firstLongName(components, 'administrative_area_level_1')

  const level2 = firstLongName(components, 'administrative_area_level_2')
  const level3 = firstLongName(components, 'administrative_area_level_3')
  const locality = firstLongName(components, 'locality')

  // Prioritas: kota/kab (level_2) dulu — cocok untuk Jakarta & kota besar ID; lalu locality; lalu level_3.
  let city = level2 || locality || level3 || firstLongName(components, 'administrative_area_level_4')

  if (!city) {
    city = cityFromFormattedAddress(formattedAddress)
  }

  const kelurahan =
    firstLongName(components, 'sublocality_level_2') ||
    firstLongName(components, 'sublocality_level_1') ||
    firstLongName(components, 'sublocality') ||
    firstLongName(components, 'neighborhood') ||
    locality ||
    '—'

  let kecamatan = level3 || firstLongName(components, 'administrative_area_level_4')
  if (!kecamatan || kecamatan === city) kecamatan = '—'

  let postalCode = firstLongName(components, 'postal_code').replace(/\D/g, '')
  if (!postalCode) postalCode = '00000'
  if (postalCode.length > 7) postalCode = postalCode.slice(0, 7)

  let outCity = city || ''
  if (!outCity && province) {
    outCity = province
  }

  return {
    city: outCity,
    province: province || '',
    postalCode,
    kelurahan: kelurahan || '—',
    kecamatan: kecamatan || '—',
  }
}
