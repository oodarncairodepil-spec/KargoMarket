import { supabase } from './supabase'

/** Harus sama dengan bucket di migrasi `20260414_storage_kargomarket_uploads.sql`. */
export const STORAGE_BUCKET = 'kargomarket-uploads'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

function fileExtension(file: File): string {
  const t = file.type
  if (t === 'image/jpeg' || t === 'image/jpg') return '.jpg'
  if (t === 'image/png') return '.png'
  if (t === 'image/webp') return '.webp'
  if (t === 'image/gif') return '.gif'
  if (t === 'application/pdf') return '.pdf'
  const n = file.name
  const i = n.lastIndexOf('.')
  if (i >= 0 && i < n.length - 1) {
    const ext = n.slice(i, i + 12).toLowerCase()
    if (/^\.[a-z0-9]+$/.test(ext)) return ext
  }
  return ''
}

/**
 * Unggah file ke Supabase Storage di path `{userId}/{segment}/...`.
 * RLS memerlukan segmen pertama = auth.uid().
 */
export async function uploadUserFile(
  segment: string,
  file: File,
  options?: { extraPath?: string },
): Promise<{ url: string; path: string } | { error: string }> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: `File terlalu besar. Maksimal ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.` }
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const uid = sessionData.session?.user?.id
  if (sessionError || !uid) {
    return { error: 'Sesi tidak valid. Silakan masuk lagi.' }
  }

  const ext = fileExtension(file)
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const extra = options?.extraPath ? `${options.extraPath.replace(/^\/+|\/+$/g, '')}/` : ''
  const path = `${uid}/${segment}/${extra}${id}${ext}`

  const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })

  if (upErr) {
    return { error: upErr.message || 'Gagal mengunggah file.' }
  }

  const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return { url: pub.publicUrl, path }
}

/** True jika string tampak seperti URL publik atau data URL gambar (legacy). */
export function isDisplayableImageUrl(s: string | undefined | null): boolean {
  if (!s) return false
  if (s.startsWith('data:image/')) return true
  if (/^https?:\/\//i.test(s) && /\.(jpe?g|png|gif|webp)(\?|$)/i.test(s)) return true
  if (/^https?:\/\//i.test(s) && /\/storage\/v1\/object\/public\//i.test(s)) return true
  return false
}
