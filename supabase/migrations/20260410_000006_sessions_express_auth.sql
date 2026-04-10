-- Sesi login Express (cookie km_session). Diperlukan jika API jalan di Vercel tanpa RUNTIME_DB_BOOTSTRAP penuh.
create table if not exists public.sessions (
  token text primary key,
  user_id text not null references public.user_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
