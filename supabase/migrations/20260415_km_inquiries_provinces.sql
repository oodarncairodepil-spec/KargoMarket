-- Provinsi dari reverse geocoding (Google), terpisah dari kota untuk tampilan/admin.
alter table public.km_inquiries
  add column if not exists pickup_province text not null default '',
  add column if not exists destination_province text not null default '';
