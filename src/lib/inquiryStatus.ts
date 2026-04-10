import type { InquiryStatus } from '../types/models'

export function inquiryStatusLabel(s: InquiryStatus): string {
  const map: Record<InquiryStatus, string> = {
    draft: 'Draft',
    matching: 'Mencocokkan vendor',
    awaiting_quotes: 'Menunggu penawaran',
    quotes_ready: 'Penawaran siap',
    vendor_selected: 'Vendor dipilih',
    awaiting_payment: 'Menunggu pembayaran',
    paid: 'Menunggu verifikasi pembayaran',
    payment_confirmed: 'Pembayaran terkonfirmasi',
    in_transit: 'Dalam pengiriman',
    cancelled: 'Dibatalkan',
    completed: 'Selesai',
  }
  return map[s]
}

export function inquiryStatusBadgeVariant(
  s: InquiryStatus,
): 'pending' | 'success' | 'info' | 'neutral' {
  if (s === 'payment_confirmed' || s === 'completed') return 'success'
  if (s === 'in_transit') return 'info'
  if (s === 'cancelled') return 'neutral'
  if (s === 'quotes_ready' || s === 'vendor_selected') return 'info'
  if (s === 'awaiting_quotes' || s === 'awaiting_payment' || s === 'matching' || s === 'paid') return 'pending'
  return 'neutral'
}
