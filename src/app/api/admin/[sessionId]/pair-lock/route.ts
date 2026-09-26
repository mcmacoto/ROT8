import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyHostAuthorization } from '@/lib/auth/require-host-auth';
import { dissolveLockedPair } from '@/lib/engine/locked-pair-dissolution';
import { evaluateLockedPair } from '@/lib/engine/matchmaking/locked-pairs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const isAuthed = await verifyHostAuthorization(sessionId);
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized host' }, { status: 401 });
  }

  const body = await request.json();
  const { action, player1Id, player2Id, playerId, requestId } = body;
  const supabase = await createClient();

  // Action: "create" manual locked pair
  if (action === 'create') {
    const { data: p1 } = await supabase.from('players').select('*').eq('id', player1Id).single();
    const { data: p2 } = await supabase.from('players').select('*').eq('id', player2Id).single();

    if (!p1 || !p2) return NextResponse.json({ error: 'Players not found' }, { status: 404 });

    const pairEval = evaluateLockedPair(p1, p2);

    const { data: pair, error } = await supabase
      .from('locked_pairs')
      .insert({
        session_id: sessionId,
        player_1_id: player1Id,
        player_2_id: player2Id,
        composite_static_rating: pairEval.compositeStaticRating,
        composite_elo: pairEval.compositeElo,
        is_active: true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ pair });
  }

  // Action: "dissolve" locked pair
  if (action === 'dissolve') {
    try {
      const result = await dissolveLockedPair(sessionId, playerId);
      return NextResponse.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Dissolve failed';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Action: "approve_request"
  if (action === 'approve_request') {
    const { data: req } = await supabase
      .from('pair_lock_requests')
      .select('*')
      .eq('id', requestId)
      .eq('session_id', sessionId)
      .single();

    if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    const { data: p1 } = await supabase.from('players').select('*').eq('id', req.requester_id).single();
    const { data: p2 } = await supabase.from('players').select('*').eq('id', req.target_id).single();

    if (!p1 || !p2) return NextResponse.json({ error: 'Players not found' }, { status: 404 });

    const pairEval = evaluateLockedPair(p1, p2);

    await supabase.from('locked_pairs').insert({
      session_id: sessionId,
      player_1_id: p1.id,
      player_2_id: p2.id,
      composite_static_rating: pairEval.compositeStaticRating,
      composite_elo: pairEval.compositeElo,
      is_active: true,
    });

    await supabase
      .from('pair_lock_requests')
      .update({ status: 'approved', resolved_at: new Date().toISOString() })
      .eq('id', requestId);

    return NextResponse.json({ success: true });
  }

  // Action: "dismiss_request"
  if (action === 'dismiss_request') {
    await supabase
      .from('pair_lock_requests')
      .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
      .eq('id', requestId);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
