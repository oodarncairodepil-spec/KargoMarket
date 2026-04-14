-- FK ke master kota BPS (opsional, nullable).

alter table public.vendors
  add column if not exists office_city_id bigint references public.id_cities (id) on delete set null;

create index if not exists idx_vendors_office_city_id on public.vendors (office_city_id);

alter table public.km_inquiries
  add column if not exists pickup_city_id bigint references public.id_cities (id) on delete set null,
  add column if not exists destination_city_id bigint references public.id_cities (id) on delete set null;

create index if not exists idx_km_inquiries_pickup_city_id on public.km_inquiries (pickup_city_id);
create index if not exists idx_km_inquiries_destination_city_id on public.km_inquiries (destination_city_id);
