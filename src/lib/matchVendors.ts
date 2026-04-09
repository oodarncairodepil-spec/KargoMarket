import type { Vendor } from '../types/models'
import { MOCK_VENDORS } from './mockVendors'

function normalize(s: string): string {
  return s.trim().toLowerCase()
}

/** Match vendors whose serviceAreas appear in destination; fallback to first 3 + general. */
export function matchVendorsByDestination(destination: string): Vendor[] {
  const dest = normalize(destination)
  if (!dest) {
    return MOCK_VENDORS.slice(0, 3)
  }

  const matched = MOCK_VENDORS.filter((v) =>
    v.serviceAreas.some((area) => dest.includes(normalize(area))),
  )

  if (matched.length > 0) {
    const ids = new Set(matched.map((m) => m.id))
    const general = MOCK_VENDORS.find((v) => v.id === 'v_general')
    if (general && !ids.has(general.id) && matched.length < 3) {
      return [...matched, general]
    }
    return matched
  }

  return [...MOCK_VENDORS.filter((v) => v.id !== 'v_general').slice(0, 2), MOCK_VENDORS.find((v) => v.id === 'v_general')!]
}

export function getVendorById(id: string): Vendor | undefined {
  return MOCK_VENDORS.find((v) => v.id === id)
}
