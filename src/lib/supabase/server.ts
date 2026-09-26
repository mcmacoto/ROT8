import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Creates an administrative Supabase client using the service role key.
 * This client runs in trusted server environments (Route Handlers, Server Actions)
 * and bypasses PostgreSQL Row-Level Security (RLS) policies as designed.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: NEXT_PUBLIC_SUPABASE_URL is missing in production.');
    }
  }

  if (!serviceRoleKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: SUPABASE_SERVICE_ROLE_KEY is required in production for server administrative operations.');
    }
    console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY is missing; falling back to anon key or placeholder. RLS bypass will be inactive.');
  }

  const resolvedUrl = supabaseUrl || 'https://placeholder-project.supabase.co';
  const resolvedKey = serviceRoleKey || anonKey || 'placeholder-anon-key';

  return createSupabaseClient(resolvedUrl, resolvedKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Backwards-compatible async client getter used across server routes and engine modules.
 */
export async function createClient() {
  return createAdminClient();
}
