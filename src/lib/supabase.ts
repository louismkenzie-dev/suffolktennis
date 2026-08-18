import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
  )
}

/**
 * Browser Supabase client for the Suffolk Tennis app.
 *
 * This replaces the Lovable-managed client. If you are porting the Lovable
 * codebase over, delete `src/integrations/supabase/client.ts` and repoint its
 * imports here — see docs/SUPABASE.md.
 *
 * Only the publishable key is used, so every table this touches must be
 * protected by Row Level Security.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
