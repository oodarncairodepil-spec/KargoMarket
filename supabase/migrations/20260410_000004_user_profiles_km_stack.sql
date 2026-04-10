-- Align app tables with Express API: user_profiles (was public.users), km_inquiries, km_vendor_tokens, km_quotes.
-- Run after existing KargoMarket migrations. Safe to re-run where IF NOT EXISTS applies.

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'users'
  ) and not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_profiles'
  ) then
    alter table public.users rename to user_profiles;
  end if;
end $$;

create table if not exists public.user_profiles (
  id text primary key,
  email text unique not null,
  password_hash text not null,
  role text not null check (role in ('customer', 'admin')),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.user_profiles add column if not exists auth_user_id uuid;

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'auth')
     and exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users')
     and not exists (select 1 from pg_constraint where conname = 'user_profiles_auth_user_id_fkey') then
    alter table public.user_profiles
      add constraint user_profiles_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users (id) on delete set null;
  end if;
exception
  when duplicate_object then null;
end $$;

create table if not exists public.km_inquiries (
  id text primary key,
  created_by_user_id text not null references public.user_profiles (id) on delete restrict,
  pickup text not null,
  destination text not null,
  pickup_address text not null,
  pickup_kelurahan text not null,
  pickup_kecamatan text not null,
  pickup_kota text not null,
  pickup_postal_code text not null,
  destination_address text not null,
  destination_kelurahan text not null,
  destination_kecamatan text not null,
  destination_kota text not null,
  destination_postal_code text not null,
  item_description text not null,
  weight text not null,
  dimensions text not null default '',
  length_cm text not null default '',
  width_cm text not null default '',
  height_cm text not null default '',
  item_image_urls jsonb not null default '[]'::jsonb,
  special_requirements text not null default '',
  scheduled_pickup_date text not null default '',
  koli_count text not null default '',
  estimated_item_value text not null default '',
  vehicle_type text not null default '',
  special_treatment text not null default '',
  insurance boolean not null default false,
  additional_packing boolean not null default false,
  budget_estimate text not null default '',
  tnc_accepted_at text not null default '',
  status text not null default 'awaiting_quotes',
  selected_quote_id text,
  quotes_released_to_customer boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.km_vendor_tokens (
  token text primary key,
  inquiry_id text not null references public.km_inquiries (id) on delete cascade,
  vendor_id text not null references public.vendors (id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.km_quotes (
  id text primary key,
  inquiry_id text not null references public.km_inquiries (id) on delete cascade,
  vendor_id text not null references public.vendors (id) on delete restrict,
  price bigint not null check (price > 0),
  eta text not null default '—',
  pickup_date text not null default '—',
  notes text not null default '',
  submitted_at timestamptz not null default now(),
  source text not null check (source in ('vendor_link', 'admin_manual')),
  vehicle_type text not null default '',
  insurance_included boolean not null default false,
  insurance_premium bigint,
  unique (inquiry_id, vendor_id)
);
