alter table public.vendors
  add column if not exists is_active boolean not null default true;

create index if not exists idx_vendors_is_active on public.vendors (is_active);
