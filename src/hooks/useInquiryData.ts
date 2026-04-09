import { useMemo } from 'react'
import { useLogisticsStore } from '../store/useLogisticsStore'

/** Hindari selector Zustand yang mengembalikan array/objek baru tiap snapshot (React 19 / getSnapshot loop). */
export function useInquiryData(id: string | undefined) {
  const inquiries = useLogisticsStore((s) => s.inquiries)
  const quotes = useLogisticsStore((s) => s.quotes)

  const inquiry = useMemo(
    () => (id ? inquiries.find((i) => i.id === id) : undefined),
    [inquiries, id],
  )

  const inquiryQuotes = useMemo(
    () => (id ? quotes.filter((q) => q.inquiryId === id) : []),
    [quotes, id],
  )

  const payment = useLogisticsStore((s) => (id ? s.payments[id] : undefined))

  return { inquiry, quotes: inquiryQuotes, payment }
}
