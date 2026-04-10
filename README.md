# KargoMarket

Satu project untuk 3 pihak:
- Customer (wajib login)
- Admin (wajib login)
- Vendor (tanpa login, via tautan token unik)

## Stack
- Frontend: Vite + React + TypeScript + Zustand
- Backend: Node.js + Express
- DB: PostgreSQL

## Setup
1. Salin environment: `cp .env.example .env`
2. PostgreSQL (satu DB dengan Supabase atau lokal) — set `DATABASE_URL`.
3. Supabase:
   - Buat pengguna di **Authentication → Users** (email/password).
   - Di tabel **`public.user_profiles`**, satu baris per pengguna: `id` = UUID yang sama dengan `auth.users.id`, plus `role` (`admin` | `customer`) dan `name`.
   - Jalankan migrasi di folder `supabase/migrations` (urut), terutama `20260411_user_profiles_supabase_auth.sql` jika Anda migrasi dari skema lama.
4. Variabel wajib di `.env` / Vercel:
   - `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server)
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `APP_ORIGIN`
5. `npm install`
6. `npm run seed:server` — hanya vendor demo (bukan pengguna login).

## Menjalankan
- Frontend: `npm run dev`
- Backend API: `npm run dev:server`

Default API: `http://localhost:4000`. Frontend: `VITE_API_BASE_URL` opsional (default dev → `http://localhost:4000`).

## Login
- Frontend: **Supabase Auth** (`signInWithPassword`).
- API: header **`Authorization: Bearer <access_token>`**; server memverifikasi JWT lalu membaca `role` dari `user_profiles`.

## Endpoint utama
- Auth: `GET /auth/me` (Bearer)
- Customer: `/customer/inquiries`, `/customer/inquiries/:id`, `/customer/inquiries/:id/quotes`, `/customer/inquiries/:id/select-quote`
- Admin: `/admin/inquiries`, `/admin/inquiries/:id`, `/admin/inquiries/:id/release-quotes`, `/admin/inquiries/:id/manual-quote`
- Vendor: `/vendor/quote/:token` (GET/POST)

## Supabase migration (RLS)
- File migration: `supabase/migrations/20260409_000001_kargomarket_init.sql`
- Berisi:
  - create table utama (`profiles`, `vendors`, `inquiries`, `vendor_tokens`, `quotes`, `payments`)
  - kolom sesuai flow 3 pihak
  - RLS policy untuk customer/admin berbasis `auth.uid()`
