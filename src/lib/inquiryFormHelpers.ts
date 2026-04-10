import { formatIDR } from './format'
import type { Inquiry } from '../types/models'

/** Berat: angka saja, satu titik desimal diperbolehkan */
export function sanitizeWeightInput(raw: string): string {
  let s = raw.replace(/[^\d.]/g, '')
  const firstDot = s.indexOf('.')
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '')
  }
  return s
}

/** Dimensi cm: bilangan bulat saja */
export function sanitizeDimensionCm(raw: string): string {
  return raw.replace(/\D/g, '')
}

/** Kode pos: angka saja, maks. 7 digit */
export function sanitizePostalCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 7)
}

/** Digit saja untuk nominal IDR */
export function sanitizeIdrDigits(raw: string): string {
  return raw.replace(/\D/g, '')
}

/** Pemisah ribuan titik (format Indonesia) untuk ditampilkan di input; state tetap simpan digit saja. */
export function formatIdrThousandsFromDigits(digits: string): string {
  const d = digits.replace(/\D/g, '')
  if (!d) return ''
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function formatIdrDigitsString(digits: string): string {
  const n = parseInt(digits.replace(/\D/g, ''), 10)
  if (Number.isNaN(n) || n <= 0) return '—'
  return formatIDR(n)
}

export function formatInquiryDateId(dateStr: string | undefined): string {
  if (!dateStr?.trim()) return '—'
  try {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export function formatDimensionsCm(lengthCm: string, widthCm: string, heightCm: string): string {
  const l = lengthCm.trim()
  const w = widthCm.trim()
  const t = heightCm.trim()
  if (!l && !w && !t) return ''
  const parts = [l || '—', w || '—', t || '—']
  return `${parts.join(' × ')} cm`
}

export const MAX_ITEM_IMAGES = 5
/** Selaras dengan batas unggah Supabase Storage (`20260414_storage_kargomarket_uploads.sql`). */
export const MAX_ITEM_IMAGE_BYTES = 10 * 1024 * 1024

export function formatWeightDisplay(weight: string): string {
  const t = weight.trim()
  if (/^\d+(\.\d+)?$/.test(t)) return `${t} kg`
  return t
}

/** Tampilan satu baris: pakai P×L×T jika ada, else field dimensions lama. */
export function inquiryDimensionsLine(inquiry: Inquiry): string {
  const formatted = formatDimensionsCm(
    inquiry.lengthCm ?? '',
    inquiry.widthCm ?? '',
    inquiry.heightCm ?? '',
  )
  if (formatted) return formatted
  return inquiry.dimensions?.trim() ?? ''
}
