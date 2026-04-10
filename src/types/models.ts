export type InquiryStatus =
  | 'draft'
  | 'matching'
  | 'awaiting_quotes'
  | 'quotes_ready'
  | 'vendor_selected'
  | 'awaiting_payment'
  | 'paid'
  | 'payment_confirmed'
  | 'in_transit'
  | 'cancelled'
  | 'completed'

export interface User {
  id: string
  name: string
  role: 'customer' | 'admin'
}

export interface Vendor {
  id: string
  name: string
  serviceAreas: string[]
  contactNote?: string
  /** Rating rata-rata dari pelanggan (mock, skala ~1–5) */
  customerRating: number
}

export interface VendorRegistration {
  id: string
  companyName: string
  businessType: 'CV' | 'PT' | 'Perorangan'
  establishedYear?: string
  originCities: string[]
  destinationCities: string[]
  picName: string
  whatsappNumber: string
  email: string
  ownerName: string
  ownerIdentityProofName?: string
  ownerIdentityProofDataUrl?: string
  serviceTypes: string[]
  specializations: string[]
  vehicleTypes: VehicleType[]
  maxCapacity?: string
  operationalDays: string[]
  operationalHours: string
  pricingScheme: 'Harga Nett' | 'Fee (Komisi)'
  pricingMethod: 'Per kg' | 'Per trip' | 'Per Koli' | 'Custom'
  supportsBidding: boolean
  legalNibName?: string
  legalNibDataUrl?: string
  npwpName?: string
  npwpDataUrl?: string
  /** `dataUrl` berisi URL publik atau data URL lama (nama kolom DB tetap JSON fleksibel). */
  fleetPhotos: { name: string; dataUrl?: string; url?: string }[]
  officePhotoName: string
  officePhotoDataUrl?: string
  officeMapsLink: string
  officeLatitude?: number
  officeLongitude?: number
  slaResponse: string
  insuranceTerms: string
  packingFeeTerms: string
  otherFeesTerms: string
  paymentTerms: string
  taxTerms: string
  tncAccepted: boolean
  isActive: boolean
  createdAt: string
}

export type VehicleType = 'Pickup' | 'CDD' | 'Fuso' | 'Trailer'
export type SpecialTreatmentType = 'Cold' | 'Fragile' | 'Crane' | 'Express'

export interface Inquiry {
  id: string
  createdByUserId?: string
  createdByName?: string
  /** Ringkas kota asal/tujuan (untuk rute & pencocokan vendor) */
  pickup: string
  destination: string
  /** Alamat & wilayah terstruktur (data baru); lama bisa kosong */
  pickupAddress?: string
  pickupKelurahan?: string
  pickupKecamatan?: string
  pickupKota?: string
  pickupPostalCode?: string
  destinationAddress?: string
  destinationKelurahan?: string
  destinationKecamatan?: string
  destinationKota?: string
  destinationPostalCode?: string
  itemDescription: string
  /** Angka saja (mis. kg), dari input numerik */
  weight: string
  /** Ringkas untuk tampilan/vendor (P × L × T cm); data lama mungkin hanya ini */
  dimensions: string
  /** cm, opsional (input terpisah) */
  lengthCm?: string
  widthCm?: string
  heightCm?: string
  /** URL publik gambar barang (Supabase Storage) atau data URL lama */
  itemImageUrls?: string[]
  specialRequirements: string
  /** Tanggal penjemputan yang diharapkan (YYYY-MM-DD) */
  scheduledPickupDate?: string
  /** Jumlah koli */
  koliCount?: string
  /** Estimasi nilai barang (angka IDR, string digit) */
  estimatedItemValue?: string
  vehicleType?: VehicleType | ''
  specialTreatment?: SpecialTreatmentType | ''
  insurance?: boolean
  additionalPacking?: boolean
  /** Estimasi budget (angka IDR, string digit) */
  budgetEstimate?: string
  /** Waktu persetujuan S&K saat kirim */
  tncAcceptedAt?: string
  status: InquiryStatus
  createdAt: string
  selectedQuoteId?: string
  matchedVendorIds: string[]
  /** Jika false, pelanggan belum boleh melihat/memilih penawaran sampai admin melepas. */
  quotesReleasedToCustomer?: boolean
  /** Terset dari API setelah konfirmasi bayar (bukan Zustand). */
  payment?: Payment
  quoteCount?: number
  matchedVendorCount?: number
  paymentConfirmationImageUrl?: string
  paymentConfirmedAt?: string
}

export interface VendorTokenEntry {
  token: string
  inquiryId: string
  vendorId: string
  createdAt: string
}

export interface VendorQuote {
  id: string
  inquiryId: string
  vendorId: string
  price: number
  eta: string
  pickupDate: string
  notes: string
  submittedAt: string
  source: 'vendor_link' | 'admin_manual'
  vehicleType?: VehicleType | ''
  insuranceIncluded?: boolean
  /** Premi asuransi (IDR) jika disertakan */
  insurancePremium?: number
  /** Dari GET /customer/inquiries/:id (penawaran terpilih + vendor). */
  vendor?: { id: string; name: string; customerRating: number } | null
}

export interface Payment {
  inquiryId: string
  quoteId: string
  proofFileName: string
  proofDataUrl: string | null
  paidAt: string
  vendorNotified: boolean
}

export interface InquirySubmitPayload {
  createdByUserId?: string
  createdByName?: string
  pickup: string
  destination: string
  pickupAddress: string
  pickupKelurahan: string
  pickupKecamatan: string
  pickupKota: string
  pickupPostalCode: string
  destinationAddress: string
  destinationKelurahan: string
  destinationKecamatan: string
  destinationKota: string
  destinationPostalCode: string
  itemDescription: string
  weight: string
  dimensions: string
  lengthCm: string
  widthCm: string
  heightCm: string
  itemImageUrls: string[]
  specialRequirements: string
  scheduledPickupDate: string
  koliCount: string
  estimatedItemValue: string
  vehicleType: VehicleType | ''
  specialTreatment: SpecialTreatmentType | ''
  insurance: boolean
  additionalPacking: boolean
  /** Boleh kosong */
  budgetEstimate: string
  tncAcceptedAt: string
}

export interface QuoteSubmitPayload {
  price: number
  eta: string
  pickupDate: string
  notes: string
  vehicleType: VehicleType | ''
  insuranceIncluded: boolean
  insurancePremium: number
}
