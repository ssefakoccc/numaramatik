import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Returns a Supabase client with anon key for public server-side read operations.
 * Returns null if environment variables are missing.
 */
export function getPublicServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !url ||
    !anonKey ||
    url === 'your_supabase_url' ||
    anonKey === 'your_supabase_anon_key' ||
    !url.startsWith('http')
  ) {
    console.error('[Supabase Public Client] NEXT_PUBLIC_SUPABASE_URL veya NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı değil.');
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
