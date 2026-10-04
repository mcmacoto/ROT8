import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyHostAuthorization } from '@/lib/auth/require-host-auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const isAuthed = await verifyHostAuthorization(sessionId);
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized host' }, { status: 401 });
  }

  const body = await request.json();
  const { courtId, name } = body;

  if (!courtId || typeof name !== 'string') {
    return NextResponse.json({ error: 'courtId and name string are required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('courts')
    .update({ name: name.trim() })
    .eq('id', courtId)
    .eq('session_id', sessionId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ court: data });
}
