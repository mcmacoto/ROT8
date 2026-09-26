import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY');
      }
      console.warn('⚠️ Supabase environment variables missing; using development placeholders.');
    }

    browserClient = createBrowserClient(
      url || 'https://placeholder-project.supabase.co',
      key || 'placeholder-anon-key'
    );
  }
  return browserClient;
}
