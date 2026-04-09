import { Navigate, useParams } from 'react-router-dom'

export function VendorQuoteRedirect() {
  const { token } = useParams<{ token: string }>()
  if (!token) return <Navigate to="/" replace />
  return <Navigate to={`/vendor/quote/${token}`} replace />
}
