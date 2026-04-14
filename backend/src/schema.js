import { query } from './db.js'

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
      id UUID PRIMARY KEY,
      role TEXT NOT NULL CHECK (role IN ('customer','admin')),
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  await query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_profiles'
          AND column_name = 'id' AND udt_name = 'uuid'
      )
         AND EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth')
         AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users')
      THEN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_id_fkey_auth_users'
        ) THEN
          ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey_auth_users;
          ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_id_fkey_auth_users
            FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
      END IF;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END $$;
  `)

  await query(`
    CREATE OR REPLACE FUNCTION public.km_lookup_user_profile(p_user_id uuid)
    RETURNS TABLE(id uuid, role text, name text)
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
      SELECT u.id, u.role, u.name
      FROM public.user_profiles u
      WHERE u.id = p_user_id
      LIMIT 1;
    $fn$;
  `)
  await query(`REVOKE ALL ON FUNCTION public.km_lookup_user_profile(uuid) FROM PUBLIC`)

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
      created_by_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
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
  await query(`ALTER TABLE km_inquiries ADD COLUMN IF NOT EXISTS pickup_province TEXT NOT NULL DEFAULT ''`)
  await query(`ALTER TABLE km_inquiries ADD COLUMN IF NOT EXISTS destination_province TEXT NOT NULL DEFAULT ''`)
  await query(`ALTER TABLE km_inquiries ADD COLUMN IF NOT EXISTS pickup_city_id BIGINT`)
  await query(`ALTER TABLE km_inquiries ADD COLUMN IF NOT EXISTS destination_city_id BIGINT`)
  await query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS origin_cities TEXT[] NOT NULL DEFAULT '{}'::text[]`)
  await query(
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS destination_cities TEXT[] NOT NULL DEFAULT '{}'::text[]`,
  )
  await query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS office_city_id BIGINT`)
  await query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS office_map_label TEXT`)

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
