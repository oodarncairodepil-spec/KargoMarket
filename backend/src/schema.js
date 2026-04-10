import bcrypt from 'bcryptjs'
import { query } from './db.js'
import { id } from './utils.js'

const VENDORS = [
  {
    id: 'v_jkt',
    name: 'Jakarta Express Cargo',
    serviceAreas: ['jakarta', 'jabodetabek', 'tangerang', 'bekasi', 'depok', 'bogor'],
    customerRating: 4.6,
  },
  {
    id: 'v_bandung',
    name: 'Bandung Lintas Raya',
    serviceAreas: ['bandung', 'jawa barat', 'cimahi', 'sumedang'],
    customerRating: 4.4,
  },
  {
    id: 'v_surabaya',
    name: 'Surabaya Nusantara Logistik',
    serviceAreas: ['surabaya', 'jawa timur', 'sidoarjo', 'gresik', 'malang'],
    customerRating: 4.7,
  },
  {
    id: 'v_bali',
    name: 'Bali Island Freight',
    serviceAreas: ['bali', 'denpasar', 'badung', 'gianyar'],
    customerRating: 4.5,
  },
  {
    id: 'v_makassar',
    name: 'Makassar Selatan Line',
    serviceAreas: ['makassar', 'sulawesi', 'sulawesi selatan'],
    customerRating: 4.2,
  },
  {
    id: 'v_general',
    name: 'Kargo Nusantara Umum',
    serviceAreas: ['indonesia', 'nasional', 'lintas pulau'],
    customerRating: 4.3,
  },
]

export async function ensureSchema() {
  await query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user_profiles'
      ) THEN
        ALTER TABLE public.users RENAME TO user_profiles;
      END IF;
    END $$;
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('customer','admin')),
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  await query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID;`)

  await query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth')
         AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users')
         AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_auth_user_id_fkey') THEN
        ALTER TABLE public.user_profiles
        ADD CONSTRAINT user_profiles_auth_user_id_fkey
        FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
      END IF;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END $$;
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      service_areas TEXT[] NOT NULL,
      customer_rating NUMERIC(2,1) NOT NULL
    );
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS km_inquiries (
      id TEXT PRIMARY KEY,
      created_by_user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
      pickup TEXT NOT NULL,
      destination TEXT NOT NULL,
      pickup_address TEXT NOT NULL,
      pickup_kelurahan TEXT NOT NULL,
      pickup_kecamatan TEXT NOT NULL,
      pickup_kota TEXT NOT NULL,
      pickup_postal_code TEXT NOT NULL,
      destination_address TEXT NOT NULL,
      destination_kelurahan TEXT NOT NULL,
      destination_kecamatan TEXT NOT NULL,
      destination_kota TEXT NOT NULL,
      destination_postal_code TEXT NOT NULL,
      item_description TEXT NOT NULL,
      weight TEXT NOT NULL,
      dimensions TEXT NOT NULL,
      length_cm TEXT NOT NULL,
      width_cm TEXT NOT NULL,
      height_cm TEXT NOT NULL,
      item_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
      special_requirements TEXT NOT NULL DEFAULT '',
      scheduled_pickup_date TEXT NOT NULL,
      koli_count TEXT NOT NULL,
      estimated_item_value TEXT NOT NULL,
      vehicle_type TEXT NOT NULL DEFAULT '',
      special_treatment TEXT NOT NULL DEFAULT '',
      insurance BOOLEAN NOT NULL DEFAULT FALSE,
      additional_packing BOOLEAN NOT NULL DEFAULT FALSE,
      budget_estimate TEXT NOT NULL DEFAULT '',
      tnc_accepted_at TEXT NOT NULL,
      status TEXT NOT NULL,
      selected_quote_id TEXT,
      quotes_released_to_customer BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  await query(`ALTER TABLE km_inquiries ADD COLUMN IF NOT EXISTS payment_proof_file_name TEXT`)
  await query(`ALTER TABLE km_inquiries ADD COLUMN IF NOT EXISTS payment_proof_data_url TEXT`)
  await query(`ALTER TABLE km_inquiries ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`)

  await query(`
    CREATE TABLE IF NOT EXISTS km_vendor_tokens (
      token TEXT PRIMARY KEY,
      inquiry_id TEXT NOT NULL REFERENCES km_inquiries(id) ON DELETE CASCADE,
      vendor_id TEXT NOT NULL REFERENCES vendors(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ
    );
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS km_quotes (
      id TEXT PRIMARY KEY,
      inquiry_id TEXT NOT NULL REFERENCES km_inquiries(id) ON DELETE CASCADE,
      vendor_id TEXT NOT NULL REFERENCES vendors(id),
      price INTEGER NOT NULL,
      eta TEXT NOT NULL,
      pickup_date TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source TEXT NOT NULL CHECK (source IN ('vendor_link','admin_manual')),
      vehicle_type TEXT NOT NULL DEFAULT '',
      insurance_included BOOLEAN NOT NULL DEFAULT FALSE,
      insurance_premium INTEGER,
      UNIQUE (inquiry_id, vendor_id)
    );
  `)
}

export async function ensureSeedUsers() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@kargomarket.test'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!'
  const customerEmail = process.env.SEED_CUSTOMER_EMAIL || 'customer@kargomarket.test'
  const customerPassword = process.env.SEED_CUSTOMER_PASSWORD || 'Customer123!'

  await upsertUser({
    email: adminEmail,
    password: adminPassword,
    role: 'admin',
    name: 'Admin KargoMarket',
    authUserId: process.env.SEED_ADMIN_AUTH_USER_ID || null,
  })
  await upsertUser({
    email: customerEmail,
    password: customerPassword,
    role: 'customer',
    name: 'Customer Demo',
    authUserId: process.env.SEED_CUSTOMER_AUTH_USER_ID || null,
  })
}

async function upsertUser({ email, password, role, name, authUserId }) {
  const hash = await bcrypt.hash(password, 10)
  const userId = id('usr')
  await query(
    `
    INSERT INTO user_profiles (id, email, password_hash, role, name)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          name = EXCLUDED.name
    `,
    [userId, email, hash, role, name],
  )
  if (authUserId && /^[0-9a-f-]{36}$/i.test(authUserId)) {
    await query(`UPDATE user_profiles SET auth_user_id = $1::uuid WHERE email = $2`, [authUserId, email])
  }
}

export async function ensureSeedVendors() {
  for (const v of VENDORS) {
    await query(
      `
      INSERT INTO vendors (id, name, service_areas, customer_rating)
      VALUES ($1,$2,$3::text[],$4)
      ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            service_areas = EXCLUDED.service_areas,
            customer_rating = EXCLUDED.customer_rating
      `,
      [v.id, v.name, v.serviceAreas, v.customerRating],
    )
  }
}
