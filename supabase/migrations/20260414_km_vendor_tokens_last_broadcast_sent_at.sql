-- Simpan waktu email broadcast terakhir per token vendor inquiry.
alter table public.km_vendor_tokens
  add column if not exists last_broadcast_sent_at timestamptz;

