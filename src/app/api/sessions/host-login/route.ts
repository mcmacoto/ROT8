import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deriveSessionHostToken, hashHostToken, getHostCookieConfig } from '@/lib/auth/host-token';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, pin } = body;

    if (!sessionId || !pin || !pin.trim()) {
      return NextResponse.json({ error: 'Session ID and PIN are required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: session, error } = await supabase
      .from('sessions')
      .select('id, name, join_pin, host_token_hash')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.join_pin.trim().toUpperCase() !== pin.trim().toUpperCase()) {
      return NextResponse.json({ error: 'Incorrect Session PIN' }, { status: 401 });
    }

    // Derive deterministic host token for this session & PIN
    const rawToken = deriveSessionHostToken(session.id, session.join_pin);
    const tokenHash = hashHostToken(rawToken);

    // Sync host_token_hash in database if different
    if (session.host_token_hash !== tokenHash) {
      await supabase
        .from('sessions')
        .update({ host_token_hash: tokenHash })
        .eq('id', session.id);
    }

    const response = NextResponse.json({
      success: true,
      sessionId: session.id,
      name: session.name,
    });

    const cookieConfig = getHostCookieConfig();
    response.cookies.set(`host_token_${session.id}`, rawToken, cookieConfig);
    response.cookies.set('rot8_host_token', rawToken, cookieConfig);

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
