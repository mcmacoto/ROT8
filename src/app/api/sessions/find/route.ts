import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pin = searchParams.get('pin')?.trim().toUpperCase();

  if (!pin || pin.length !== 6) {
    return NextResponse.json({ error: 'Valid 6-character PIN required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: session, error } = await supabase
    .from('sessions')
    .select('id, name, is_active')
    .eq('join_pin', pin)
    .eq('is_active', true)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found or inactive' }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: session.id,
    name: session.name,
  });
}
