import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyHostAuthorization } from '@/lib/auth/require-host-auth';
import { handleNoShowRedraft } from '@/lib/engine/state-machine/no-show';
import { executeMatchForfeit } from '@/lib/engine/state-machine/forfeit';
import { calculateEloUpdates } from '@/lib/engine/matchmaking/elo-rated';
import { triggerAutoDispatchIfEligible } from '@/lib/engine/auto-dispatch';
import { composeOnDeckSlot, fillAvailableOnDeckSlots } from '@/lib/engine/on-deck';

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
  const { action, matchId, courtId, noShowPlayerId, scoreA, scoreB, forfeitedByTeam, winningTeam } = body;
  const supabase = await createClient();
  const now = new Date().toISOString();

  // Action: "call_to_court" (transitions on_deck -> summoning on chosen court)
  if (action === 'call_to_court') {
    if (!matchId || !courtId) {
      return NextResponse.json({ error: 'matchId and courtId required' }, { status: 400 });
    }

    const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    // Parallelize match, court, and player updates
    const allPlayerIds = [...match.team_a_ids, ...match.team_b_ids];
    await Promise.all([
      supabase
        .from('matches')
        .update({
          court_id: courtId,
          stage: 'summoning',
          summoned_at: now,
          on_deck_slot_number: null,
        })
        .eq('id', matchId),
      supabase
        .from('courts')
        .update({
          status: 'summoning',
          current_match_id: matchId,
        })
        .eq('id', courtId),
      supabase
        .from('players')
        .update({ status: 'summoned' })
        .in('id', allPlayerIds),
    ]);

    // Re-fill on-deck slots if possible
    await fillAvailableOnDeckSlots(sessionId);

    return NextResponse.json({ success: true });
  }

  // Action: "start_match" (transitions summoning -> in_match)
  if (action === 'start_match') {
    const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
    const allPlayerIds = match ? [...match.team_a_ids, ...match.team_b_ids] : [];

    await Promise.all([
      supabase
        .from('matches')
        .update({
          stage: 'in_match',
          started_at: now,
        })
        .eq('id', matchId),
      supabase
        .from('courts')
        .update({ status: 'in_match' })
        .eq('id', courtId),
      allPlayerIds.length > 0
        ? supabase.from('players').update({ status: 'on_court' }).in('id', allPlayerIds)
        : Promise.resolve(),
    ]);

    return NextResponse.json({ success: true });
  }

  // Action: "no_show" (flags absent player, drafts replacement in <500ms, restarts grace period)
  if (action === 'no_show') {
    try {
      const result = await handleNoShowRedraft(sessionId, matchId, noShowPlayerId);
      return NextResponse.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No-show redraft failed';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Action: "forfeit" (Retire/Forfeit flow with real score)
  if (action === 'forfeit') {
    try {
      const result = await executeMatchForfeit({
        sessionId,
        matchId,
        forfeitedByTeam,
        scoreA,
        scoreB,
      });

      // Replenish on-deck slots after players return to queue
      await fillAvailableOnDeckSlots(sessionId);

      return NextResponse.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Forfeit failed';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Action: "complete_match" (Normal completion)
  if (action === 'complete_match') {
    const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
    const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    const scoringRequired = session?.scoring_required ?? true;
    let eloDeltaA: number[] = [0, 0];
    let eloDeltaB: number[] = [0, 0];

    const { data: teamAPlayers } = await supabase.from('players').select('*').in('id', match.team_a_ids);
    const { data: teamBPlayers } = await supabase.from('players').select('*').in('id', match.team_b_ids);

    const teamAWon = winningTeam
      ? winningTeam === 'A'
      : scoreA !== undefined && scoreB !== undefined
      ? scoreA > scoreB
      : true;

    if (scoringRequired && scoreA !== undefined && scoreB !== undefined && teamAPlayers && teamBPlayers) {
      const eloUpdates = calculateEloUpdates({
        teamAElos: teamAPlayers.map((p) => p.current_elo) as [number, number],
        teamBElos: teamBPlayers.map((p) => p.current_elo) as [number, number],
        teamAWon,
        teamAMatchCounts: teamAPlayers.map((p) => p.total_matches_played) as [number, number],
        teamBMatchCounts: teamBPlayers.map((p) => p.total_matches_played) as [number, number],
      });

      eloDeltaA = eloUpdates.teamADeltas;
      eloDeltaB = eloUpdates.teamBDeltas;

      const playerUpdates = [
        ...teamAPlayers.map((p, i) =>
          supabase.from('players').update({
            current_elo: p.current_elo + eloDeltaA[i],
            total_matches_played: p.total_matches_played + 1,
            total_wins: p.total_wins + (teamAWon ? 1 : 0),
            total_losses: p.total_losses + (teamAWon ? 0 : 1),
            point_differential: p.point_differential + (scoreA - scoreB),
            status: 'queued',
            staged_match_id: null,
            wait_started_at: now,
          }).eq('id', p.id)
        ),
        ...teamBPlayers.map((p, i) =>
          supabase.from('players').update({
            current_elo: p.current_elo + eloDeltaB[i],
            total_matches_played: p.total_matches_played + 1,
            total_wins: p.total_wins + (teamAWon ? 0 : 1),
            total_losses: p.total_losses + (teamAWon ? 1 : 0),
            point_differential: p.point_differential + (scoreB - scoreA),
            status: 'queued',
            staged_match_id: null,
            wait_started_at: now,
          }).eq('id', p.id)
        ),
      ];
      await Promise.all(playerUpdates);
    } else {
      // Scoring disabled - record wins/losses based on selected winner
      const playerUpdates = [
        ...(teamAPlayers || []).map((p) =>
          supabase.from('players').update({
            total_matches_played: (p.total_matches_played || 0) + 1,
            total_wins: (p.total_wins || 0) + (teamAWon ? 1 : 0),
            total_losses: (p.total_losses || 0) + (teamAWon ? 0 : 1),
            status: 'queued',
            staged_match_id: null,
            wait_started_at: now,
          }).eq('id', p.id)
        ),
        ...(teamBPlayers || []).map((p) =>
          supabase.from('players').update({
            total_matches_played: (p.total_matches_played || 0) + 1,
            total_wins: (p.total_wins || 0) + (teamAWon ? 0 : 1),
            total_losses: (p.total_losses || 0) + (teamAWon ? 1 : 0),
            status: 'queued',
            staged_match_id: null,
            wait_started_at: now,
          }).eq('id', p.id)
        ),
      ];
      await Promise.all(playerUpdates);
    }

    const durationSeconds = match.started_at
      ? Math.floor((new Date(now).getTime() - new Date(match.started_at).getTime()) / 1000)
      : 0;

    await Promise.all([
      supabase.from('matches').update({
        stage: 'completed',
        score_a: scoringRequired ? scoreA : null,
        score_b: scoringRequired ? scoreB : null,
        elo_delta_team_a: eloDeltaA[0] || null,
        elo_delta_team_b: eloDeltaB[0] || null,
        completed_at: now,
        match_duration_seconds: durationSeconds,
      }).eq('id', matchId),
      supabase.from('courts').update({
        status: 'available',
        current_match_id: null,
      }).eq('id', courtId),
    ]);

    // Auto dispatch check if enabled
    await triggerAutoDispatchIfEligible(sessionId, courtId);

    // Replenish on-deck slots after players return to queue
    await fillAvailableOnDeckSlots(sessionId);

    return NextResponse.json({ success: true });
  }

  // Action: "direct_dispatch" (Legacy direct dispatch to court)
  if (action === 'direct_dispatch') {
    const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
    if (session && courtId) {
      const { match } = await composeOnDeckSlot(sessionId, 1, session.match_mode);
      if (match) {
        await supabase
          .from('matches')
          .update({
            court_id: courtId,
            stage: 'summoning',
            summoned_at: now,
            on_deck_slot_number: null,
          })
          .eq('id', match.id);

        await supabase
          .from('courts')
          .update({
            status: 'summoning',
            current_match_id: match.id,
          })
          .eq('id', courtId);

        const allPlayerIds = [...match.team_a_ids, ...match.team_b_ids];
        await supabase.from('players').update({ status: 'summoned' }).in('id', allPlayerIds);
        return NextResponse.json({ success: true, matchId: match.id });
      }
    }
    return NextResponse.json({ success: false });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
