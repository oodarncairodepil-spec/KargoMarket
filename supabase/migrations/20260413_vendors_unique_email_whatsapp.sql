-- Satu email / satu nomor WhatsApp per vendor (abaikan string kosong).
-- Normalisasi email di aplikasi: disimpan lowercase; index pakai lower(trim(...)).

create unique index if not exists vendors_email_unique_idx
  on public.vendors (lower(trim(email)))
  where email is not null and btrim(email) <> '';

create unique index if not exists vendors_whatsapp_unique_idx
  on public.vendors (btrim(whatsapp_number))
  where whatsapp_number is not null and btrim(whatsapp_number) <> '';
