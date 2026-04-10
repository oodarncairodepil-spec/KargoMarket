-- Idempotensi broadcast: satu token aktif per (inquiry, vendor).
-- Edge Function akan reuse token jika sudah ada.

create unique index if not exists km_vendor_tokens_inquiry_vendor_unique
  on public.km_vendor_tokens (inquiry_id, vendor_id)
  where revoked_at is null;

