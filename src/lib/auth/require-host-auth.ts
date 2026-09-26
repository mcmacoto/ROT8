import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { validateHostToken } from './host-token';

export async function verifyHostAuthorization(sessionId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const token =
    cookieStore.get(`host_token_${sessionId}`)?.value ||
    cookieStore.get('rot8_host_token')?.value;

  if (!token) return false;

  const supabase = await createClient();
  const { data: session } = await supabase
    .from('sessions')
    .select('id, join_pin, host_token_hash')
    .eq('id', sessionId)
    .single();

  if (!session || !session.host_token_hash) return false;

  return validateHostToken(token, session.host_token_hash, session.id, session.join_pin);
}
