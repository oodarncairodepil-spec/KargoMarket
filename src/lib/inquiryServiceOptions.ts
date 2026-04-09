import type { Inquiry, SpecialTreatmentType, VehicleType } from '../types/models'

export const VEHICLE_TYPES: VehicleType[] = ['Pickup', 'CDD', 'Fuso', 'Trailer']
export const SPECIAL_TREATMENTS: SpecialTreatmentType[] = ['Cold', 'Fragile', 'Crane', 'Express']

export const TNC_SUMMARY_LINES = [
  'Harga penawaran bersifat indikatif dan dapat berubah setelah verifikasi (muatan, rute, atau kondisi lapangan).',
  'Biaya tambahan dapat dikenakan jika berat, dimensi, jumlah koli, atau penanganan khusus berbeda dari data yang Anda kirim.',
  'Ketentuan pembayaran dan tanggung jawab mengikat setelah Anda memilih vendor dan menyetujui tagihan/konfirmasi resmi.',
] as const

export function vehicleLabel(v: Inquiry['vehicleType']): string {
  if (!v) return '—'
  return v
}

export function treatmentLabel(t: Inquiry['specialTreatment']): string {
  if (!t) return '—'
  return t
}

export function yesNoId(b: boolean | undefined): string {
  if (b === undefined) return '—'
  return b ? 'Ya' : 'Tidak'
}
