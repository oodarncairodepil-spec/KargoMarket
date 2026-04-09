export function formatIDR(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)
}

/** Best-effort: extract first integer from ETA string for sorting. */
export function parseEtaDays(eta: string): number {
  const m = eta.match(/(\d+)/)
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER
}
