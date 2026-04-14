-- Referensi wilayah Indonesia (BPS): provinsi & kabupaten/kota + pencarian teks.
-- Data diisi lewat: node scripts/import-indonesia-regions.mjs

create table if not exists public.id_provinces (
  id bigint primary key,
  code text not null unique,
  name text not null,
  name_normalized text not null
);

create table if not exists public.id_cities (
  id bigint primary key,
  code text not null unique,
  province_code text not null references public.id_provinces (code) on update cascade on delete restrict,
  city_type text not null check (city_type in ('Kota', 'Kabupaten')),
  city_name text not null,
  province_name text not null,
  full_name text not null,
  city_normalized text not null,
  province_normalized text not null,
  search_vector tsvector generated always as (
    to_tsvector(
      'simple'::regconfig,
      coalesce(full_name, '') || ' ' || coalesce(city_name, '') || ' ' || coalesce(province_name, '')
    )
  ) stored
);

create index if not exists id_cities_search_vector_gin on public.id_cities using gin (search_vector);
create index if not exists id_cities_city_prov_norm_btree on public.id_cities (city_normalized, province_normalized);

alter table public.id_provinces enable row level security;
alter table public.id_cities enable row level security;

drop policy if exists id_provinces_select_authenticated on public.id_provinces;
create policy id_provinces_select_authenticated
  on public.id_provinces
  for select
  to authenticated
  using (true);

drop policy if exists id_cities_select_authenticated on public.id_cities;
create policy id_cities_select_authenticated
  on public.id_cities
  for select
  to authenticated
  using (true);
