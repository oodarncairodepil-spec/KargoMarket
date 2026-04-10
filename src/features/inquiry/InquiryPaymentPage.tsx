import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { PageShell } from '../../components/PageShell'
import { StickyCTA } from '../../components/StickyCTA'
import { apiClient } from '../../lib/apiClient'
import type { Inquiry } from '../../types/models'

const MAX_FILE_BYTES = 350 * 1024

export function InquiryPaymentPage() {
  const { id } = useParams<{ id: string }>()
  const [inquiry, setInquiry] = useState<Inquiry | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) {
      setInquiry(null)
      setLoading(false)
      return
    }
    let mounted = true
    void (async () => {
      try {
        setLoading(true)
        const res = (await apiClient.get(`/customer/inquiries/${id}`)) as { inquiry?: Inquiry }
        if (!mounted) return
        setInquiry(res.inquiry ?? null)
      } catch {
        if (mounted) setInquiry(null)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [id])

  if (!id) {
    return (
      <PageShell title="Tidak ditemukan">
        <Link to="/" className="text-accent">
          Beranda
        </Link>
      </PageShell>
    )
  }

  if (loading) {
    return (
      <PageShell title="Pembayaran">
        <p className="text-left text-sm text-slate-600">Memuat...</p>
      </PageShell>
    )
  }

  if (!inquiry) {
    return (
      <PageShell title="Tidak ditemukan">
        <Link to="/" className="text-accent">
          Beranda
        </Link>
      </PageShell>
    )
  }

  const inquiryId = id
  const payment = inquiry.payment

  const canAccessPayment =
    inquiry.status === 'awaiting_payment' ||
    inquiry.status === 'vendor_selected' ||
    inquiry.status === 'paid'
  if (!canAccessPayment) {
    return (
      <PageShell title="Pembayaran">
        <p className="text-slate-600">Selesaikan pemilihan vendor dan tagihan terlebih dahulu.</p>
        <Link to={`/customer/inquiry/${inquiry.id}`} className="mt-4 font-semibold text-accent">
          Kembali ke detail
        </Link>
      </PageShell>
    )
  }

  const alreadyPaid = inquiry.status === 'paid' && payment

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError('')
    const file = e.target.files?.[0]
    if (!file) {
      setFileName('')
      setPreview(null)
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('File terlalu besar. Maksimal sekitar 350 KB untuk unggahan.')
      setFileName('')
      setPreview(null)
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      setPreview(typeof reader.result === 'string' ? reader.result : null)
    }
    reader.readAsDataURL(file)
  }

  async function submit() {
    setError('')
    if (!fileName) {
      setError('Pilih file bukti pembayaran.')
      return
    }
    setSubmitting(true)
    try {
      const res = (await apiClient.post(`/customer/inquiries/${inquiryId}/confirm-payment`, {
        proofFileName: fileName,
        proofDataUrl: preview,
      })) as { inquiry?: Inquiry }
      if (res.inquiry) setInquiry(res.inquiry)
    } catch {
      setError('Gagal mengirim bukti. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageShell
        title="Pembayaran"
        headerRight={
          <Link to={`/customer/inquiry/${inquiry.id}/invoice`} className="text-sm font-medium text-accent">
            Tagihan
          </Link>
        }
      >
        {alreadyPaid && payment && (
          <>
            <Card className="border-emerald-100 bg-emerald-50/70 text-left text-sm text-emerald-900">
              <p className="font-semibold">Vendor telah diberi tahu (simulasi).</p>
              <p className="mt-2 text-emerald-800">
                Bukti: {payment.proofFileName}
                {payment.proofDataUrl ? ' (tersimpan ringkas)' : ' (hanya nama file — file terlalu besar untuk disimpan)'}
              </p>
            </Card>
            <Link
              to={`/customer/inquiry/${inquiry.id}`}
              className="flex min-h-12 items-center justify-center rounded-xl bg-slate-900 text-center text-base font-semibold text-white"
            >
              Kembali ke detail
            </Link>
          </>
        )}

        {!alreadyPaid && (
          <>
            <p className="text-left text-sm text-slate-600">
              Unggah bukti transfer (simulasi). Bukti disimpan di server bersama permintaan Anda.
            </p>
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-100">
                {error}
              </p>
            )}
            <label className="block text-left">
              <span className="text-sm font-medium text-slate-700">Bukti pembayaran</span>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={onFile}
                className="mt-2 block w-full min-h-12 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-4 file:py-2 file:text-sm file:font-semibold file:text-accent"
              />
            </label>
            {preview && preview.startsWith('data:image') && (
              <Card className="overflow-hidden p-0">
                <img src={preview} alt="Pratinjau bukti" className="max-h-48 w-full object-contain" />
              </Card>
            )}
          </>
        )}
      </PageShell>

      {!alreadyPaid && (
        <StickyCTA aboveBottomNav>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit()}
            className="w-full min-h-12 rounded-xl bg-accent text-base font-semibold text-white shadow-md disabled:opacity-50"
          >
            {submitting ? 'Mengirim…' : 'Konfirmasi bayar'}
          </button>
        </StickyCTA>
      )}
    </>
  )
}
