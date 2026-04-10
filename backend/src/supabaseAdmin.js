import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

/** Verifikasi JWT pelanggan/admin lewat Supabase (service role). */
export const supabaseAdmin =
  config.supabaseUrl && config.supabaseServiceRoleKey
    ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null
