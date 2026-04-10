-- Backend Express memakai koneksi Postgres biasa (tanpa JWT PostgREST), jadi
-- auth.uid() NULL dan policy "user_profiles_select_own" memblokir SELECT.
-- Fungsi SECURITY DEFINER (owner postgres) membaca profil untuk /auth/me tanpa membuka RLS ke anon.

create or replace function public.km_lookup_user_profile(p_user_id uuid)
returns table(id uuid, role text, name text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.role, u.name
  from public.user_profiles u
  where u.id = p_user_id
  limit 1;
$$;

revoke all on function public.km_lookup_user_profile(uuid) from public;
