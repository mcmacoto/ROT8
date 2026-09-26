import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const [
      { data: session, error: sessionError },
      { data: courts },
      { data: matches },
      { data: players },
    ] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', sessionId).single(),
      supabase.from('courts').select('*').eq('session_id', sessionId).order('court_number', { ascending: true }),
      supabase.from('matches').select('*').eq('session_id', sessionId).order('started_at', { ascending: true }),
      supabase.from('players').select('*').eq('session_id', sessionId),
    ]);

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      session,
      courts: courts || [],
      matches: matches || [],
      players: players || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
