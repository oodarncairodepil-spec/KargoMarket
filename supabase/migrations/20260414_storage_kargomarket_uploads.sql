-- Bucket publik untuk gambar/dokumen aplikasi (URL publik, baca tanpa token).
-- Path wajib: {auth.uid()}/... agar hanya pemilik akun yang bisa menulis/menghapus objeknya.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kargomarket-uploads',
  'kargomarket-uploads',
  true,
  10485760,
  null
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists "kargomarket_uploads_select_anon" on storage.objects;
drop policy if exists "kargomarket_uploads_insert_own" on storage.objects;
drop policy if exists "kargomarket_uploads_update_own" on storage.objects;
drop policy if exists "kargomarket_uploads_delete_own" on storage.objects;

-- Baca objek di bucket ini (URL publik; tanpa klausa TO = berlaku untuk peran yang mengakses storage).
create policy "kargomarket_uploads_select_anon"
on storage.objects
for select
using (bucket_id = 'kargomarket-uploads');

-- Unggah hanya ke folder pertama = UUID pengguna yang sedang login.
create policy "kargomarket_uploads_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'kargomarket-uploads'
  and split_part(name, '/', 1) = (select auth.uid()::text)
);

create policy "kargomarket_uploads_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'kargomarket-uploads'
  and split_part(name, '/', 1) = (select auth.uid()::text)
)
with check (
  bucket_id = 'kargomarket-uploads'
  and split_part(name, '/', 1) = (select auth.uid()::text)
);

create policy "kargomarket_uploads_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'kargomarket-uploads'
  and split_part(name, '/', 1) = (select auth.uid()::text)
);
