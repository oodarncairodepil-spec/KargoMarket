-- Teks alamat lengkap dari peta (Nominatim) agar tampil konsisten saat edit vendor.
alter table public.vendors
  add column if not exists office_map_label text;
