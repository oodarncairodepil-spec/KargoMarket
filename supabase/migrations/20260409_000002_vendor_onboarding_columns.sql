-- Extend vendors table to store admin vendor onboarding data.
-- Safe to run multiple times.

alter table public.vendors
  add column if not exists business_type text check (business_type in ('CV', 'PT', 'Perorangan')),
  add column if not exists established_year text,
  add column if not exists origin_cities text[] not null default '{}',
  add column if not exists destination_cities text[] not null default '{}',
  add column if not exists pic_name text,
  add column if not exists whatsapp_number text,
  add column if not exists email text,
  add column if not exists owner_name text,
  add column if not exists owner_identity_proof_name text,
  add column if not exists owner_identity_proof_data_url text,
  add column if not exists service_types text[] not null default '{}',
  add column if not exists specializations text[] not null default '{}',
  add column if not exists vehicle_types text[] not null default '{}',
  add column if not exists max_capacity text,
  add column if not exists operational_days text[] not null default '{}',
  add column if not exists operational_hours text,
  add column if not exists pricing_scheme text check (pricing_scheme in ('Harga Nett', 'Fee (Komisi)')),
  add column if not exists pricing_method text check (pricing_method in ('Per kg', 'Per trip', 'Per Koli', 'Custom')),
  add column if not exists supports_bidding boolean,
  add column if not exists legal_nib_name text,
  add column if not exists legal_nib_data_url text,
  add column if not exists npwp_name text,
  add column if not exists npwp_data_url text,
  add column if not exists fleet_photos jsonb not null default '[]'::jsonb,
  add column if not exists office_photo_name text,
  add column if not exists office_photo_data_url text,
  add column if not exists office_maps_link text,
  add column if not exists office_latitude double precision,
  add column if not exists office_longitude double precision,
  add column if not exists sla_response text,
  add column if not exists insurance_terms text,
  add column if not exists packing_fee_terms text,
  add column if not exists other_fees_terms text,
  add column if not exists payment_terms text,
  add column if not exists tax_terms text,
  add column if not exists tnc_accepted boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_vendors_business_type on public.vendors (business_type);
create index if not exists idx_vendors_updated_at on public.vendors (updated_at desc);

-- Allow admin to insert/update vendors from client app (authenticated admin only).
drop policy if exists vendors_admin_insert on public.vendors;
create policy vendors_admin_insert
on public.vendors
for insert
to authenticated
with check (public.is_admin());

drop policy if exists vendors_admin_update on public.vendors;
create policy vendors_admin_update
on public.vendors
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Optional trigger to keep updated_at current.
create or replace function public.set_vendors_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_vendors_set_updated_at on public.vendors;
create trigger trg_vendors_set_updated_at
before update on public.vendors
for each row execute function public.set_vendors_updated_at();
