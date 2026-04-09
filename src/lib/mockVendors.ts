import type { Vendor } from '../types/models'

export const MOCK_VENDORS: Vendor[] = [
  {
    id: 'v_jkt',
    name: 'Jakarta Express Cargo',
    serviceAreas: ['jakarta', 'jabodetabek', 'tangerang', 'bekasi', 'depok', 'bogor'],
    contactNote: 'WA: 08xx (mock)',
    customerRating: 4.6,
  },
  {
    id: 'v_bandung',
    name: 'Bandung Lintas Raya',
    serviceAreas: ['bandung', 'jawa barat', 'cimahi', 'sumedang'],
    contactNote: 'WA: 08xx (mock)',
    customerRating: 4.4,
  },
  {
    id: 'v_surabaya',
    name: 'Surabaya Nusantara Logistik',
    serviceAreas: ['surabaya', 'jawa timur', 'sidoarjo', 'gresik', 'malang'],
    contactNote: 'WA: 08xx (mock)',
    customerRating: 4.7,
  },
  {
    id: 'v_bali',
    name: 'Bali Island Freight',
    serviceAreas: ['bali', 'denpasar', 'badung', 'gianyar'],
    contactNote: 'WA: 08xx (mock)',
    customerRating: 4.5,
  },
  {
    id: 'v_makassar',
    name: 'Makassar Selatan Line',
    serviceAreas: ['makassar', 'sulawesi', 'sulawesi selatan'],
    contactNote: 'WA: 08xx (mock)',
    customerRating: 4.2,
  },
  {
    id: 'v_general',
    name: 'Kargo Nusantara Umum',
    serviceAreas: ['indonesia', 'nasional', 'lintas pulau'],
    contactNote: 'Fallback vendor',
    customerRating: 4.3,
  },
]
