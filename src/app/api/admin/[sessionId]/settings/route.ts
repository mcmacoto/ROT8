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

  const updates = await request.json();
  const supabase = await createClient();

  const allowedUpdates: Record<string, unknown> = {};
  if (updates.match_mode !== undefined) allowedUpdates.match_mode = updates.match_mode;
  if (updates.scoring_required !== undefined) allowedUpdates.scoring_required = updates.scoring_required;
  if (updates.grace_period_seconds !== undefined) allowedUpdates.grace_period_seconds = updates.grace_period_seconds;
  if (updates.on_deck_cap_override !== undefined) allowedUpdates.on_deck_cap_override = updates.on_deck_cap_override;
  if (updates.auto_dispatch_enabled !== undefined) allowedUpdates.auto_dispatch_enabled = updates.auto_dispatch_enabled;

  const { data, error } = await supabase
    .from('sessions')
    .update(allowedUpdates)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session: data });
}
