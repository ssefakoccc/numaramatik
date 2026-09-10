import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Returns a Supabase client with service-role key for privileged server-side operations.
 * Returns null if environment variables are missing.
 */
export function getAdminServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !url ||
    !serviceRoleKey ||
    url === 'your_supabase_url' ||
    serviceRoleKey === 'your_service_role_key' ||
    !url.startsWith('http')
  ) {
    console.error('[Supabase Admin Client] NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY tanımlı değil.');
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
