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
1. Salin environment:
   - `cp .env.example .env`
2. Pastikan PostgreSQL aktif dan `DATABASE_URL` valid di `.env`.
3. Isi variabel Supabase di `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Install dependency:
   - `npm install`
4. Seed schema + data awal:
   - `npm run seed:server`

## Menjalankan
- Frontend: `npm run dev`
- Backend API: `npm run dev:server`

Default API berjalan di `http://localhost:4000`.
Frontend memakai `VITE_API_BASE_URL` (opsional). Jika tidak diisi, default ke `http://localhost:4000`.

## Akun demo (seed default)
- Admin: `admin@kargomarket.test` / `Admin123!`
- Customer: `customer@kargomarket.test` / `Customer123!`

## Endpoint utama
- Auth: `/auth/login`, `/auth/me`, `/auth/logout`
- Customer: `/customer/inquiries`, `/customer/inquiries/:id`, `/customer/inquiries/:id/quotes`, `/customer/inquiries/:id/select-quote`
- Admin: `/admin/inquiries`, `/admin/inquiries/:id`, `/admin/inquiries/:id/release-quotes`, `/admin/inquiries/:id/manual-quote`
- Vendor: `/vendor/quote/:token` (GET/POST)

## Supabase migration (RLS)
- File migration: `supabase/migrations/20260409_000001_kargomarket_init.sql`
- Berisi:
  - create table utama (`profiles`, `vendors`, `inquiries`, `vendor_tokens`, `quotes`, `payments`)
  - kolom sesuai flow 3 pihak
  - RLS policy untuk customer/admin berbasis `auth.uid()`
