import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Publishable values for the suffolk-tennis project (Nullshift org).
// These are safe to ship in the browser bundle — the anon key is public by
// design and every table is protected by Row Level Security. Env vars
// override them (e.g. to point a preview at another project); the hardcoded
// fallbacks mean a missing Vercel env var can never white-screen the app.
const FALLBACK_URL = 'https://twtmkvorzpvwnznqzcrw.supabase.co';
const FALLBACK_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3dG1rdm9yenB2d256bnF6Y3J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjU0NzQsImV4cCI6MjEwMjY0MTQ3NH0.e6J1Wp2pypuj6bIOQKFt9WvQlxSDy-QVyW2hcrfqtqE';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_PUBLISHABLE_KEY;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
