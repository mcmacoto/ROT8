import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateInitialElo } from '@/lib/engine/matchmaking/elo-rated';
import { fillAvailableOnDeckSlots } from '@/lib/engine/on-deck';
import { verifyPlayerPin } from '@/lib/utils/player-pin';
import { sanitizePlayerName } from '@/lib/utils/sanitize';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sessionId, name, staticRating, requesterId, targetId, playerId, pin } = body;
    const supabase = await createClient();

    // Self-Service Action 1: Request to join queue (places in holding list awaiting host approval per Feature #5)
    if (action === 'check_in' || action === 'request_join') {
      const cleanName = sanitizePlayerName(name);
      if (!sessionId || !cleanName) {
        return NextResponse.json({ error: 'Valid session ID and player name are required' }, { status: 400 });
      }

      const rating = staticRating !== undefined && staticRating !== null ? Number(staticRating) : 0;
      const initialElo = calculateInitialElo(rating);
      const nowIso = new Date().toISOString();

      // Check if player was already pre-added to holding list ('checked_in')
      const { data: existingHolding } = await supabase
        .from('players')
        .select('*')
        .eq('session_id', sessionId)
        .eq('status', 'checked_in')
        .ilike('name', cleanName)
        .limit(1)
        .maybeSingle();

      if (existingHolding) {
        // Keep in holding list awaiting host check-in approval, update rating if provided
        if (rating > 0) {
          const { data: updated, error: updateErr } = await supabase
            .from('players')
            .update({ static_rating: rating, current_elo: initialElo })
            .eq('id', existingHolding.id)
            .select()
            .single();
          if (!updateErr && updated) {
            return NextResponse.json({ player: updated, pendingApproval: true });
          }
        }
        return NextResponse.json({ player: existingHolding, pendingApproval: true });
      }

      // Check if already in queue or playing
      const { data: existingActive } = await supabase
        .from('players')
        .select('*')
        .eq('session_id', sessionId)
        .ilike('name', cleanName)
        .neq('status', 'checked_out')
        .limit(1)
        .maybeSingle();

      if (existingActive) {
        return NextResponse.json({ player: existingActive, pendingApproval: existingActive.status === 'checked_in' });
      }

      // Otherwise insert new player row into holding list ('checked_in') awaiting host approval
      const insertPayload: Record<string, unknown> = {
        session_id: sessionId,
        name: cleanName,
        static_rating: rating,
        current_elo: initialElo,
        status: 'checked_in', // Holding list awaiting host check-in
        wait_started_at: nowIso,
      };

      let { data: player, error } = await supabase
        .from('players')
        .insert(insertPayload)
        .select()
        .single();

      if (error && (error.code === '23514' || error.message?.includes('players_static_rating_check'))) {
        if (rating === 0) {
          insertPayload.static_rating = null;
          const fallbackRes = await supabase
            .from('players')
            .insert(insertPayload)
            .select()
            .single();
          player = fallbackRes.data;
          error = fallbackRes.error;
        }
      }

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ player, pendingApproval: true });
    }

    // Self-Service Action 2: Claim / Track Player Profile with PIN (Feature #6)
    if (action === 'claim_profile') {
      if (!sessionId || !playerId || !pin) {
        return NextResponse.json({ error: 'Session ID, Player ID, and PIN are required' }, { status: 400 });
      }

      const { data: session } = await supabase
        .from('sessions')
        .select('join_pin')
        .eq('id', sessionId)
        .single();

      const { data: player } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .eq('session_id', sessionId)
        .single();

      if (!player) {
        return NextResponse.json({ error: 'Player not found in this session' }, { status: 404 });
      }

      const isValidPin = verifyPlayerPin(pin, player.id, session?.join_pin || '');
      if (!isValidPin) {
        return NextResponse.json({ error: 'Incorrect Player PIN. Please ask the host for your PIN.' }, { status: 401 });
      }

      return NextResponse.json({ success: true, player });
    }

    // Self-Service Action 2: Request Pair Lock (Host-only approval flow)
    if (action === 'request_pair_lock') {
      if (!sessionId || !requesterId || !targetId || requesterId === targetId) {
        return NextResponse.json({ error: 'Valid requester and target player required' }, { status: 400 });
      }

      const { data: req, error } = await supabase
        .from('pair_lock_requests')
        .insert({
          session_id: sessionId,
          requester_id: requesterId,
          target_id: targetId,
          status: 'pending',
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ request: req });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { playerId, action } = body;
    const supabase = await createClient();

    // Self-Service: Rest / Resume Toggle (Module 3 Step 6)
    if (action === 'toggle_rest') {
      const { data: current } = await supabase
        .from('players')
        .select('status, session_id')
        .eq('id', playerId)
        .single();

      if (!current) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

      // Only players in 'queued' or 'resting' can toggle
      if (current.status !== 'queued' && current.status !== 'resting') {
        return NextResponse.json(
          { error: `Cannot toggle rest while player is in '${current.status}' state.` },
          { status: 400 }
        );
      }

      const nextStatus = current.status === 'queued' ? 'resting' : 'queued';
      const updatePayload: { status: string; wait_started_at?: string } = { status: nextStatus };
      if (nextStatus === 'queued') {
        updatePayload.wait_started_at = new Date().toISOString();
      }

      const { data: updated, error } = await supabase
        .from('players')
        .update(updatePayload)
        .eq('id', playerId)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      if (nextStatus === 'queued' && current.session_id) {
        await fillAvailableOnDeckSlots(current.session_id);
      }

      return NextResponse.json({ player: updated });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
