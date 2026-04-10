-- user_profiles: id = auth.users.id (UUID), hanya role + name. Email/password di auth.users.
-- Hapus sesi cookie Express; API memakai Bearer JWT Supabase.

drop table if exists public.sessions;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'email'
  ) then
    alter table public.user_profiles rename to user_profiles_legacy;
  end if;
end $$;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('customer', 'admin')),
  name text not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.user_profiles_legacy') is not null then
    insert into public.user_profiles (id, role, name, created_at)
    select l.auth_user_id, l.role, l.name, l.created_at
    from public.user_profiles_legacy l
    where l.auth_user_id is not null
    on conflict (id) do update
      set role = excluded.role,
          name = excluded.name;

    update public.km_inquiries i
    set created_by_user_id = l.auth_user_id::text
    from public.user_profiles_legacy l
    where i.created_by_user_id = l.id
      and l.auth_user_id is not null;

    drop table public.user_profiles_legacy;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'km_inquiries'
      and column_name = 'created_by_user_id'
      and udt_name = 'text'
  ) then
    alter table public.km_inquiries drop constraint if exists km_inquiries_created_by_user_id_fkey;
    alter table public.km_inquiries
      alter column created_by_user_id type uuid using created_by_user_id::uuid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'km_inquiries_created_by_user_id_fkey'
  ) then
    alter table public.km_inquiries
      add constraint km_inquiries_created_by_user_id_fkey
      foreign key (created_by_user_id) references public.user_profiles (id) on delete restrict;
  end if;
end $$;

alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own" on public.user_profiles
  for select to authenticated
  using (auth.uid() = id);
