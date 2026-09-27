import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser-safe Supabase client.
 *
 * SECURITY: everything under `src/` is bundled into public JavaScript, so this
 * file may only ever receive the *anon* / publishable key. The service-role key
 * bypasses Row Level Security entirely and must stay on the server. A check
 * below rejects a service-role key rather than letting it ship in the bundle.
 */

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** True for `sb_secret_...` keys and for legacy JWTs whose role is service_role. */
function isServiceRoleKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  if (!key.startsWith('eyJ')) return false;
  try {
    const base64 = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64)) as { role?: string };
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = Boolean(url && anonKey);

if (isSupabaseConfigured && isServiceRoleKey(anonKey!)) {
  throw new Error(
    'VITE_SUPABASE_ANON_KEY holds a service-role key, which must never be exposed ' +
      'to the browser because it bypasses Row Level Security. Use the anon / ' +
      'publishable key here and keep the service-role key on the server only.',
  );
}

/**
 * Null until both variables are set, so a missing configuration degrades
 * gracefully instead of throwing during module evaluation. Use
 * `requireSupabase()` when a caller genuinely needs the client.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, ' +
        'then restart the dev server or rebuild - Vite inlines them at build time.',
    );
  }
  return supabase;
}
