import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { PageShell } from '../../components/PageShell'
import { StickyCTA } from '../../components/StickyCTA'
import { apiClient } from '../../lib/apiClient'
import { uploadUserFile } from '../../lib/storageUpload'
import type { Inquiry } from '../../types/models'

export function InquiryPaymentPage() {
  const { id } = useParams<{ id: string }>()
  const [inquiry, setInquiry] = useState<Inquiry | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [fileName, setFileName] = useState('')
  /** URL publik Supabase setelah unggah (dikirim ke API sebagai proofDataUrl). */
  const [proofPublicUrl, setProofPublicUrl] = useState<string | null>(null)
  const [proofKind, setProofKind] = useState<'image' | 'pdf' | null>(null)
  const [uploadingProof, setUploadingProof] = useState(false)
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

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError('')
    const file = e.target.files?.[0]
    if (!file) {
      setFileName('')
      setProofPublicUrl(null)
      setProofKind(null)
      return
    }
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    if (!isImage && !isPdf) {
      setError('Hanya gambar atau PDF yang diperbolehkan.')
      setFileName('')
      setProofPublicUrl(null)
      setProofKind(null)
      e.target.value = ''
      return
    }
    setUploadingProof(true)
    setFileName(file.name)
    const res = await uploadUserFile('payments', file, { extraPath: inquiryId })
    setUploadingProof(false)
    if ('error' in res) {
      setError(res.error)
      setFileName('')
      setProofPublicUrl(null)
      setProofKind(null)
      e.target.value = ''
      return
    }
    setProofPublicUrl(res.url)
    setProofKind(isPdf ? 'pdf' : 'image')
    e.target.value = ''
  }

  async function submit() {
    setError('')
    if (!fileName || !proofPublicUrl) {
      setError(uploadingProof ? 'Tunggu unggah selesai.' : 'Pilih file bukti pembayaran dan pastikan unggah berhasil.')
      return
    }
    setSubmitting(true)
    try {
      const res = (await apiClient.post(`/customer/inquiries/${inquiryId}/confirm-payment`, {
        proofFileName: fileName,
        proofDataUrl: proofPublicUrl,
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
                {payment.proofDataUrl ? ' (URL bukti tersimpan)' : ' (tanpa URL bukti)'}
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
              Unggah bukti transfer. File disimpan di Supabase Storage; URL disimpan bersama permintaan Anda.
            </p>
            {error && (
              <p
                className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-100"
                role="alert"
              >
                {error}
              </p>
            )}
            <label className="block text-left">
              <span className="text-sm font-medium text-slate-700">Bukti pembayaran</span>
              <input
                type="file"
                accept="image/*,.pdf"
                disabled={uploadingProof}
                onChange={(ev) => void onFile(ev)}
                className="mt-2 block w-full min-h-12 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-4 file:py-2 file:text-sm file:font-semibold file:text-accent disabled:opacity-50"
              />
            </label>
            {uploadingProof && (
              <p className="text-left text-sm text-slate-600">Mengunggah ke penyimpanan…</p>
            )}
            {proofKind === 'image' && proofPublicUrl && (
              <Card className="overflow-hidden p-0">
                <img src={proofPublicUrl} alt="Pratinjau bukti" className="max-h-48 w-full object-contain" />
              </Card>
            )}
            {proofKind === 'pdf' && proofPublicUrl && (
              <Card className="text-left text-sm text-slate-700">
                <p>PDF terunggah: {fileName}</p>
                <a
                  href={proofPublicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block font-medium text-accent"
                >
                  Buka file
                </a>
              </Card>
            )}
          </>
        )}
      </PageShell>

      {!alreadyPaid && (
        <StickyCTA aboveBottomNav>
          <button
            type="button"
            disabled={submitting || uploadingProof || !proofPublicUrl}
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
