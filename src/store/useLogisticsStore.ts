import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { matchVendorsByDestination } from '../lib/matchVendors'
import { generateToken, idPrefix } from '../lib/tokens'
import type {
  Inquiry,
  InquiryStatus,
  InquirySubmitPayload,
  Payment,
  QuoteSubmitPayload,
  VendorRegistration,
  VendorQuote,
} from '../types/models'

const MAX_PROOF_BYTES = 400 * 1024

export type SubmitQuoteResult =
  | { ok: true; updated: boolean }
  | { ok: false; error: 'invalid_token' }

interface LogisticsState {
  inquiries: Inquiry[]
  vendorRegistrations: VendorRegistration[]
  /** token -> assignment */
  tokenIndex: Record<string, { inquiryId: string; vendorId: string; createdAt: string }>
  quotes: VendorQuote[]
  payments: Record<string, Payment>

  submitInquiry: (payload: InquirySubmitPayload) => string
  getInquiry: (id: string) => Inquiry | undefined
  getQuotesForInquiry: (inquiryId: string) => VendorQuote[]
  getTokenEntry: (token: string) => { inquiryId: string; vendorId: string; createdAt: string } | undefined
  submitVendorQuote: (token: string, payload: QuoteSubmitPayload) => SubmitQuoteResult
  adminAddManualQuote: (
    inquiryId: string,
    vendorId: string,
    payload: QuoteSubmitPayload,
  ) => { ok: boolean; updated: boolean }
  getVendorQuoteLink: (token: string) => string
  selectQuote: (inquiryId: string, quoteId: string) => void
  /** Setelah admin selesai meninjau penawaran, pelanggan boleh melihat & memilih. */
  releaseQuotesToCustomer: (inquiryId: string) => void
  setAwaitingPayment: (inquiryId: string) => void
  recordPayment: (
    inquiryId: string,
    proofFileName: string,
    proofDataUrl: string | null,
  ) => void
  addVendorRegistration: (payload: Omit<VendorRegistration, 'id' | 'createdAt'>) => string
  updateVendorRegistration: (
    id: string,
    payload: Omit<VendorRegistration, 'id' | 'createdAt'>,
  ) => boolean
  resetAll: () => void
}

function bumpInquiryStatusForQuotes(inquiry: Inquiry, quoteCount: number): InquiryStatus {
  if (quoteCount >= 1 && inquiry.status === 'awaiting_quotes') {
    return 'quotes_ready'
  }
  if (quoteCount >= 1 && inquiry.status === 'matching') {
    return 'quotes_ready'
  }
  return inquiry.status
}

export const useLogisticsStore = create<LogisticsState>()(
  persist(
    (set, get) => ({
      inquiries: [],
      vendorRegistrations: [],
      tokenIndex: {},
      quotes: [],
      payments: {},

      submitInquiry: (payload) => {
        const inquiryId = idPrefix('inq')
        const matched = matchVendorsByDestination(payload.destination)
        const matchedVendorIds = matched.map((v) => v.id)

        const inquiry: Inquiry = {
          id: inquiryId,
          ...payload,
          status: 'awaiting_quotes',
          createdAt: new Date().toISOString(),
          matchedVendorIds,
          quotesReleasedToCustomer: false,
        }

        const tokenIndex = { ...get().tokenIndex }
        for (const vid of matchedVendorIds) {
          const token = generateToken()
          tokenIndex[token] = {
            inquiryId,
            vendorId: vid,
            createdAt: new Date().toISOString(),
          }
        }

        set((s) => ({
          inquiries: [inquiry, ...s.inquiries],
          tokenIndex,
        }))

        return inquiryId
      },

      getInquiry: (id) => get().inquiries.find((i) => i.id === id),

      getQuotesForInquiry: (inquiryId) =>
        get().quotes.filter((q) => q.inquiryId === inquiryId),

      getTokenEntry: (token) => get().tokenIndex[token],

      submitVendorQuote: (token, payload) => {
        const entry = get().tokenIndex[token]
        if (!entry) {
          return { ok: false, error: 'invalid_token' }
        }
        const { inquiryId, vendorId } = entry
        const existing = get().quotes.find(
          (q) => q.inquiryId === inquiryId && q.vendorId === vendorId,
        )
        const updated = Boolean(existing)
        const prem =
          payload.insuranceIncluded && payload.insurancePremium > 0
            ? Math.round(payload.insurancePremium)
            : undefined
        const quote: VendorQuote = existing
          ? {
              ...existing,
              price: payload.price,
              eta: payload.eta,
              pickupDate: payload.pickupDate,
              notes: payload.notes,
              vehicleType: payload.vehicleType || '',
              insuranceIncluded: payload.insuranceIncluded,
              insurancePremium: prem,
              submittedAt: new Date().toISOString(),
              source: 'vendor_link',
            }
          : {
              id: idPrefix('qt'),
              inquiryId,
              vendorId,
              price: payload.price,
              eta: payload.eta,
              pickupDate: payload.pickupDate,
              notes: payload.notes,
              vehicleType: payload.vehicleType || '',
              insuranceIncluded: payload.insuranceIncluded,
              insurancePremium: prem,
              submittedAt: new Date().toISOString(),
              source: 'vendor_link',
            }

        set((s) => {
          let quotes = s.quotes.filter((q) => q.id !== existing?.id)
          quotes = [...quotes, quote]
          const quoteCount = quotes.filter((q) => q.inquiryId === inquiryId).length
          const inquiries = s.inquiries.map((inq) =>
            inq.id === inquiryId
              ? { ...inq, status: bumpInquiryStatusForQuotes(inq, quoteCount) }
              : inq,
          )
          return { quotes, inquiries }
        })

        return { ok: true, updated }
      },

      adminAddManualQuote: (inquiryId, vendorId, payload) => {
        const inquiry = get().inquiries.find((i) => i.id === inquiryId)
        if (!inquiry) return { ok: false, updated: false }
        if (!inquiry.matchedVendorIds.includes(vendorId)) {
          return { ok: false, updated: false }
        }

        const existing = get().quotes.find(
          (q) => q.inquiryId === inquiryId && q.vendorId === vendorId,
        )
        const updated = Boolean(existing)
        const prem =
          payload.insuranceIncluded && payload.insurancePremium > 0
            ? Math.round(payload.insurancePremium)
            : undefined
        const quote: VendorQuote = existing
          ? {
              ...existing,
              price: payload.price,
              eta: payload.eta,
              pickupDate: payload.pickupDate,
              notes: payload.notes,
              vehicleType: payload.vehicleType || '',
              insuranceIncluded: payload.insuranceIncluded,
              insurancePremium: prem,
              submittedAt: new Date().toISOString(),
              source: 'admin_manual',
            }
          : {
              id: idPrefix('qt'),
              inquiryId,
              vendorId,
              price: payload.price,
              eta: payload.eta,
              pickupDate: payload.pickupDate,
              notes: payload.notes,
              vehicleType: payload.vehicleType || '',
              insuranceIncluded: payload.insuranceIncluded,
              insurancePremium: prem,
              submittedAt: new Date().toISOString(),
              source: 'admin_manual',
            }

        set((s) => {
          let quotes = s.quotes.filter((q) => q.id !== existing?.id)
          quotes = [...quotes, quote]
          const quoteCount = quotes.filter((q) => q.inquiryId === inquiryId).length
          const inquiries = s.inquiries.map((inq) =>
            inq.id === inquiryId
              ? { ...inq, status: bumpInquiryStatusForQuotes(inq, quoteCount) }
              : inq,
          )
          return { quotes, inquiries }
        })

        return { ok: true, updated }
      },

      getVendorQuoteLink: (token) => {
        if (typeof window === 'undefined') return `/vendor/quote/${token}`
        return `${window.location.origin}/vendor/quote/${token}`
      },

      selectQuote: (inquiryId, quoteId) => {
        set((s) => ({
          inquiries: s.inquiries.map((inq) =>
            inq.id === inquiryId
              ? { ...inq, status: 'vendor_selected', selectedQuoteId: quoteId }
              : inq,
          ),
        }))
      },

      releaseQuotesToCustomer: (inquiryId) => {
        set((s) => ({
          inquiries: s.inquiries.map((inq) =>
            inq.id === inquiryId ? { ...inq, quotesReleasedToCustomer: true } : inq,
          ),
        }))
      },

      setAwaitingPayment: (inquiryId) => {
        set((s) => ({
          inquiries: s.inquiries.map((inq) =>
            inq.id === inquiryId && inq.status === 'vendor_selected'
              ? { ...inq, status: 'awaiting_payment' }
              : inq,
          ),
        }))
      },

      recordPayment: (inquiryId, proofFileName, proofDataUrl) => {
        const inquiry = get().inquiries.find((i) => i.id === inquiryId)
        if (!inquiry?.selectedQuoteId) return

        let safeUrl = proofDataUrl
        if (safeUrl && safeUrl.length > MAX_PROOF_BYTES) {
          safeUrl = null
        }

        const payment: Payment = {
          inquiryId,
          quoteId: inquiry.selectedQuoteId,
          proofFileName,
          proofDataUrl: safeUrl,
          paidAt: new Date().toISOString(),
          vendorNotified: true,
        }

        set((s) => ({
          payments: { ...s.payments, [inquiryId]: payment },
          inquiries: s.inquiries.map((inq) =>
            inq.id === inquiryId ? { ...inq, status: 'paid' } : inq,
          ),
        }))
      },

      addVendorRegistration: (payload) => {
        const newId = idPrefix('vreg')
        const item: VendorRegistration = {
          id: newId,
          createdAt: new Date().toISOString(),
          ...payload,
        }
        set((s) => ({ vendorRegistrations: [item, ...s.vendorRegistrations] }))
        return newId
      },

      updateVendorRegistration: (id, payload) => {
        const existing = get().vendorRegistrations.find((v) => v.id === id)
        if (!existing) return false
        set((s) => ({
          vendorRegistrations: s.vendorRegistrations.map((v) =>
            v.id === id ? { ...v, ...payload } : v,
          ),
        }))
        return true
      },

      resetAll: () => {
        set({ inquiries: [], vendorRegistrations: [], tokenIndex: {}, quotes: [], payments: {} })
      },
    }),
    { name: 'kargomarket-logistics' },
  ),
)

/** Tokens for an inquiry (for admin UI). */
export function getTokensForInquiry(
  tokenIndex: Record<string, { inquiryId: string; vendorId: string; createdAt: string }>,
  inquiryId: string,
): { token: string; vendorId: string }[] {
  return Object.entries(tokenIndex)
    .filter(([, v]) => v.inquiryId === inquiryId)
    .map(([token, v]) => ({ token, vendorId: v.vendorId }))
}
