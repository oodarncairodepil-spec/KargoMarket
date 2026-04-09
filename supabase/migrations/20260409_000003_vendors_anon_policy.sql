-- Allow frontend anon key to read/write vendors.
-- NOTE: this is permissive and intended for current app flow
-- where admin login is handled outside Supabase Auth.

drop policy if exists vendors_select_authenticated on public.vendors;
drop policy if exists vendors_admin_insert on public.vendors;
drop policy if exists vendors_admin_update on public.vendors;

create policy vendors_select_anon
on public.vendors
for select
to anon, authenticated
using (true);

create policy vendors_insert_anon
on public.vendors
for insert
to anon, authenticated
with check (true);

create policy vendors_update_anon
on public.vendors
for update
to anon, authenticated
using (true)
with check (true);
