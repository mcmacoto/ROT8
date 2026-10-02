import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyHostAuthorization } from '@/lib/auth/require-host-auth';
import { editPlayer } from '@/lib/db/player-edit';
import { calculateInitialElo } from '@/lib/engine/matchmaking/elo-rated';
import { parsePlayerList, isValidStaticRating } from '@/lib/utils/parse-player-list';
import { fillAvailableOnDeckSlots } from '@/lib/engine/on-deck';
import { sanitizePlayerName } from '@/lib/utils/sanitize';
import { StaticRating } from '@/types/database';

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
  const { action } = body;
  const supabase = await createClient();

  // 1. Bulk import action
  if (action === 'bulk_import') {
    let playersToImport: { name: string; rating: StaticRating }[] = [];

    if (Array.isArray(body.players)) {
      playersToImport = body.players
        .map((p: { name?: unknown; rating?: unknown }) => ({
          name: sanitizePlayerName(p.name),
          rating: isValidStaticRating(Number(p.rating)) ? (Number(p.rating) as StaticRating) : (0 as StaticRating),
        }))
        .filter((p: { name: string; rating: StaticRating }) => p.name.length > 0);
    } else if (typeof body.rawText === 'string') {
      const defaultRating = isValidStaticRating(Number(body.defaultRating))
        ? (Number(body.defaultRating) as StaticRating)
        : 0;
      playersToImport = parsePlayerList(body.rawText, defaultRating)
        .map((p) => ({ ...p, name: sanitizePlayerName(p.name) }))
        .filter((p) => p.name.length > 0);
    }

    if (playersToImport.length === 0) {
      return NextResponse.json({ error: 'No valid players provided for import' }, { status: 400 });
    }

    const destinationStatus = body.status === 'checked_in' ? 'checked_in' : 'queued';
    const nowIso = new Date().toISOString();

    const insertPayload = playersToImport.map((p) => ({
      session_id: sessionId,
      name: p.name,
      static_rating: p.rating,
      current_elo: calculateInitialElo(p.rating),
      status: destinationStatus,
      wait_started_at: nowIso,
    }));

    let { data, error } = await supabase
      .from('players')
      .insert(insertPayload)
      .select();

    if (error && (error.code === '23514' || error.message?.includes('players_static_rating_check'))) {
      const fallbackPayload = insertPayload.map((p) => ({
        ...p,
        static_rating: p.static_rating === 0 ? null : p.static_rating,
      }));
      const fallbackRes = await supabase.from('players').insert(fallbackPayload).select();
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If added directly to queue, replenish available on-deck slots
    if (destinationStatus === 'queued') {
      await fillAvailableOnDeckSlots(sessionId);
    }

    return NextResponse.json({ players: data, count: data?.length || 0 });
  }

  // 2. Check in to queue action (promotes checked_in players to queued)
  if (action === 'check_in_to_queue') {
    const { playerIds } = body;
    if (!Array.isArray(playerIds) || playerIds.length === 0) {
      return NextResponse.json({ error: 'playerIds array is required' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('players')
      .update({
        status: 'queued',
        wait_started_at: nowIso,
      })
      .in('id', playerIds)
      .eq('session_id', sessionId)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Automatically replenish on-deck slots if unfilled
    await fillAvailableOnDeckSlots(sessionId);

    return NextResponse.json({ updated: data, count: data?.length || 0 });
  }

  // 3. Checkout player action (removes from active rotation)
  if (action === 'checkout') {
    const { playerId } = body;
    if (!playerId) {
      return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
    }

    // Verify player is not on active court or summoned
    const { data: existing, error: fetchErr } = await supabase
      .from('players')
      .select('id, status')
      .eq('id', playerId)
      .eq('session_id', sessionId)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    if (['on_court', 'summoned', 'staged'].includes(existing.status)) {
      return NextResponse.json(
        {
          error: `Cannot checkout player while in status "${existing.status}". Forfeit match or substitute player first.`,
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('players')
      .update({ status: 'checked_out' })
      .eq('id', playerId)
      .eq('session_id', sessionId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ player: data });
  }

  // 4. Default: Add single player (supports destination 'queued' or 'checked_in')
  const cleanName = sanitizePlayerName(body.name);
  const static_rating: StaticRating = body.static_rating !== undefined && isValidStaticRating(Number(body.static_rating))
    ? (Number(body.static_rating) as StaticRating)
    : 0;

  if (!cleanName) {
    return NextResponse.json({ error: 'Valid player name is required' }, { status: 400 });
  }

  const destinationStatus = body.status === 'checked_in' ? 'checked_in' : 'queued';
  const initialElo = calculateInitialElo(static_rating);
  const nowIso = new Date().toISOString();

  const insertPayload: Record<string, unknown> = {
    session_id: sessionId,
    name: cleanName,
    static_rating,
    current_elo: initialElo,
    status: destinationStatus,
    wait_started_at: nowIso,
  };

  let { data, error } = await supabase
    .from('players')
    .insert(insertPayload)
    .select()
    .single();

  if (error && (error.code === '23514' || error.message?.includes('players_static_rating_check'))) {
    if (static_rating === 0) {
      insertPayload.static_rating = null;
      const fallbackRes = await supabase
        .from('players')
        .insert(insertPayload)
        .select()
        .single();
      data = fallbackRes.data;
      error = fallbackRes.error;
    }
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If added directly to queue, automatically replenish on-deck slots
  if (destinationStatus === 'queued') {
    await fillAvailableOnDeckSlots(sessionId);
  }

  return NextResponse.json({ player: data });
}

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
  const { playerId, name, static_rating, status } = body;

  if (!playerId) {
    return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
  }

  const supabase = await createClient();

  if (status) {
    // Status override (resting, queued, checked_out, checked_in)
    const updatePayload: Record<string, unknown> = { status };
    if (status === 'queued') {
      updatePayload.wait_started_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('players')
      .update(updatePayload)
      .eq('id', playerId)
      .eq('session_id', sessionId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (status === 'queued') {
      await fillAvailableOnDeckSlots(sessionId);
    }

    return NextResponse.json({ player: data });
  }

  // Edit name / rating (NO AUDIT LOG table written per Module 1 §6)
  try {
    let sanitizedName: string | undefined = undefined;
    if (name !== undefined) {
      sanitizedName = sanitizePlayerName(name);
      if (sanitizedName.length < 1) {
        return NextResponse.json({ error: 'Player name must contain at least 1 valid character.' }, { status: 400 });
      }
    }

    const updated = await editPlayer(playerId, { name: sanitizedName, static_rating });
    return NextResponse.json({ player: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Edit player failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
