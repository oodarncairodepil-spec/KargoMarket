-- KargoMarket initial schema for Supabase (Postgres + RLS)
-- Run with Supabase CLI: supabase db push

create extension if not exists pgcrypto;

-- Roles are attached to auth.users via this profile table.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  role text not null check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.vendors (
  id text primary key,
  name text not null,
  service_areas text[] not null default '{}',
  customer_rating numeric(2,1) not null default 0
);

create table if not exists public.inquiries (
  id text primary key default ('inq_' || encode(gen_random_bytes(8), 'hex')),
  created_by_user_id uuid not null references public.profiles(id) on delete restrict,
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
  item_image_urls text[] not null default '{}',
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

create table if not exists public.vendor_tokens (
  token text primary key,
  inquiry_id text not null references public.inquiries(id) on delete cascade,
  vendor_id text not null references public.vendors(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.quotes (
  id text primary key default ('qt_' || encode(gen_random_bytes(8), 'hex')),
  inquiry_id text not null references public.inquiries(id) on delete cascade,
  vendor_id text not null references public.vendors(id) on delete restrict,
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

create table if not exists public.payments (
  inquiry_id text primary key references public.inquiries(id) on delete cascade,
  quote_id text not null references public.quotes(id) on delete cascade,
  proof_file_name text not null,
  proof_data_url text,
  paid_at timestamptz not null default now(),
  vendor_notified boolean not null default false
);

create index if not exists idx_inquiries_created_by on public.inquiries(created_by_user_id);
create index if not exists idx_quotes_inquiry on public.quotes(inquiry_id);
create index if not exists idx_vendor_tokens_inquiry on public.vendor_tokens(inquiry_id);

-- Utility function for admin checks from JWT user id.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.vendors enable row level security;
alter table public.inquiries enable row level security;
alter table public.vendor_tokens enable row level security;
alter table public.quotes enable row level security;
alter table public.payments enable row level security;

-- PROFILES
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- VENDORS (read-only for authenticated users; writes by service role)
drop policy if exists vendors_select_authenticated on public.vendors;
create policy vendors_select_authenticated
on public.vendors
for select
to authenticated
using (true);

-- INQUIRIES
drop policy if exists inquiries_select_own_or_admin on public.inquiries;
create policy inquiries_select_own_or_admin
on public.inquiries
for select
to authenticated
using (created_by_user_id = auth.uid() or public.is_admin());

drop policy if exists inquiries_insert_own_or_admin on public.inquiries;
create policy inquiries_insert_own_or_admin
on public.inquiries
for insert
to authenticated
with check (created_by_user_id = auth.uid() or public.is_admin());

drop policy if exists inquiries_update_own_or_admin on public.inquiries;
create policy inquiries_update_own_or_admin
on public.inquiries
for update
to authenticated
using (created_by_user_id = auth.uid() or public.is_admin())
with check (created_by_user_id = auth.uid() or public.is_admin());

-- VENDOR TOKENS
drop policy if exists vendor_tokens_admin_select on public.vendor_tokens;
create policy vendor_tokens_admin_select
on public.vendor_tokens
for select
to authenticated
using (public.is_admin());

drop policy if exists vendor_tokens_admin_write on public.vendor_tokens;
create policy vendor_tokens_admin_write
on public.vendor_tokens
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- QUOTES
drop policy if exists quotes_select_admin on public.quotes;
create policy quotes_select_admin
on public.quotes
for select
to authenticated
using (public.is_admin());

drop policy if exists quotes_select_customer_released on public.quotes;
create policy quotes_select_customer_released
on public.quotes
for select
to authenticated
using (
  exists (
    select 1
    from public.inquiries i
    where i.id = quotes.inquiry_id
      and i.created_by_user_id = auth.uid()
      and i.quotes_released_to_customer = true
  )
);

drop policy if exists quotes_admin_write on public.quotes;
create policy quotes_admin_write
on public.quotes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- PAYMENTS
drop policy if exists payments_select_own_or_admin on public.payments;
create policy payments_select_own_or_admin
on public.payments
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.inquiries i
    where i.id = payments.inquiry_id
      and i.created_by_user_id = auth.uid()
  )
);

drop policy if exists payments_insert_own_or_admin on public.payments;
create policy payments_insert_own_or_admin
on public.payments
for insert
to authenticated
with check (
  public.is_admin()
  or exists (
    select 1
    from public.inquiries i
    where i.id = payments.inquiry_id
      and i.created_by_user_id = auth.uid()
  )
);

drop policy if exists payments_update_admin on public.payments;
create policy payments_update_admin
on public.payments
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
