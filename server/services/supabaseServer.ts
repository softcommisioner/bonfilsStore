import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client that forwards the CALLER's JWT.
 *
 * Why this file exists and why it refuses a service-role key
 * ------------------------------------------------------------
 * The entire security model of the China sourcing workflow is Row Level
 * Security (see supabase/migrations/0017). RLS evaluates `auth.uid()`, which
 * comes from the `Authorization` header of the request hitting PostgREST.
 *
 * If the server talked to Supabase with the service-role key, every request
 * would be evaluated as a superuser: RLS would be bypassed, the storage
 * policies in 0018 would never run, and "a customer can only see their own
 * requests" would be enforced by nothing but this file's own `where` clauses.
 * That is one forgotten `.or()` away from a full data leak.
 *
 * So the server impersonates the signed-in customer, not an administrator, and
 * lets the database do the authorising. The correct-privilege property is
 * therefore also the safe-privilege one: if this layer is wrong, the database
 * still holds the line.
 */

const url = process.env.SUPABASE_URL?.trim();
const anonKey = process.env.SUPABASE_ANON_KEY?.trim();

/** True for `sb_secret_...` keys and for legacy JWTs whose role is service_role. */
function isServiceRoleKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  if (!key.startsWith('eyJ')) return false;
  try {
    const base64 = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8')) as {
      role?: string;
    };
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = Boolean(url && anonKey);

if (isSupabaseConfigured && isServiceRoleKey(anonKey!)) {
  throw new Error(
    'SUPABASE_ANON_KEY holds a service-role key. The China sourcing RLS policies ' +
      'are evaluated against the caller JWT, so this client must use the anon / ' +
      'publishable key and forward the caller Authorization header.',
  );
}

export const SUPABASE_BUCKET = 'china-request-images';

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      'Supabase is not configured on the server. Set SUPABASE_URL and ' +
        'SUPABASE_ANON_KEY. The China sourcing workflow is unavailable until then; ' +
        'the legacy /api/china-requests route is unaffected.',
    );
    this.name = 'SupabaseNotConfiguredError';
  }
}

/**
 * A client acting AS the caller.
 *
 * `accessToken` is the customer's own JWT, extracted from the incoming
 * Authorization header. It is deliberately required rather than defaulted: a
 * missing token must fail loudly here, not silently produce a service-role
 * client that bypasses RLS.
 */
export function callerScopedClient(accessToken: string): SupabaseClient {
  if (!url || !anonKey) throw new SupabaseNotConfiguredError();
  if (!accessToken) {
    throw new Error('callerScopedClient requires the caller access token.');
  }
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
