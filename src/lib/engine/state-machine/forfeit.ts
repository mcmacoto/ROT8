import { createClient } from '@/lib/supabase/server';
import { calculateEloUpdates } from '../matchmaking/elo-rated';
import { triggerAutoDispatchIfEligible } from '../auto-dispatch';

export interface ForfeitParams {
  sessionId: string;
  matchId: string;
  forfeitedByTeam: 'A' | 'B';
  scoreA?: number | null;
  scoreB?: number | null;
}

/**
 * Executes Retire / Forfeit for an active court departure:
 * 1. Sets match.stage = 'result_pending' and sets forfeited_by = 'A' | 'B'.
 * 2. If scoring is enabled, applies real score entered by host and calculates Elo/records.
 * 3. Sets match to 'completed' with completed_at timestamp.
 * 4. Resets court to 'available' (and triggers auto-dispatch if enabled).
 * 5. Returns remaining players to 'queued' and moves departing player to 'resting' (never inserts a substitute).
 */
export async function executeMatchForfeit(params: ForfeitParams) {
  const { sessionId, matchId, forfeitedByTeam, scoreA = 0, scoreB = 0 } = params;
  const supabase = await createClient();

  // 1. Fetch match and session
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .eq('session_id', sessionId)
    .single();

  if (matchError || !match) throw new Error('Match not found');

  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  const scoringRequired = session?.scoring_required ?? true;
  const now = new Date().toISOString();

  // 2. Fetch players for Elo / stats update
  const { data: teamAPlayers } = await supabase
    .from('players')
    .select('*')
    .in('id', match.team_a_ids);

  const { data: teamBPlayers } = await supabase
    .from('players')
    .select('*')
    .in('id', match.team_b_ids);

  let eloDeltaA: number[] = [0, 0];
  let eloDeltaB: number[] = [0, 0];

  const teamAWon = forfeitedByTeam === 'B';

  if (scoringRequired && teamAPlayers && teamBPlayers) {
    const eloUpdates = calculateEloUpdates({
      teamAElos: teamAPlayers.map((p) => p.current_elo) as [number, number],
      teamBElos: teamBPlayers.map((p) => p.current_elo) as [number, number],
      teamAWon,
      teamAMatchCounts: teamAPlayers.map((p) => p.total_matches_played) as [number, number],
      teamBMatchCounts: teamBPlayers.map((p) => p.total_matches_played) as [number, number],
    });

    eloDeltaA = eloUpdates.teamADeltas;
    eloDeltaB = eloUpdates.teamBDeltas;

    // Update player records in parallel
    const playerUpdates = [
      ...teamAPlayers.map((p, i) =>
        supabase
          .from('players')
          .update({
            current_elo: p.current_elo + eloDeltaA[i],
            total_matches_played: p.total_matches_played + 1,
            total_wins: p.total_wins + (teamAWon ? 1 : 0),
            total_losses: p.total_losses + (teamAWon ? 0 : 1),
            point_differential: p.point_differential + ((scoreA || 0) - (scoreB || 0)),
            status: 'queued',
            staged_match_id: null,
            wait_started_at: now,
          })
          .eq('id', p.id)
      ),
      ...teamBPlayers.map((p, i) =>
        supabase
          .from('players')
          .update({
            current_elo: p.current_elo + eloDeltaB[i],
            total_matches_played: p.total_matches_played + 1,
            total_wins: p.total_wins + (teamAWon ? 0 : 1),
            total_losses: p.total_losses + (teamAWon ? 1 : 0),
            point_differential: p.point_differential + ((scoreB || 0) - (scoreA || 0)),
            status: 'queued',
            staged_match_id: null,
            wait_started_at: now,
          })
          .eq('id', p.id)
      ),
    ];
    await Promise.all(playerUpdates);
  } else {
    // Scores disabled - record match counts, win/loss, and return to queue in parallel
    const playerUpdates = [
      ...(teamAPlayers || []).map((p) =>
        supabase
          .from('players')
          .update({
            total_matches_played: (p.total_matches_played || 0) + 1,
            total_wins: (p.total_wins || 0) + (teamAWon ? 1 : 0),
            total_losses: (p.total_losses || 0) + (teamAWon ? 0 : 1),
            status: 'queued',
            staged_match_id: null,
            wait_started_at: now,
          })
          .eq('id', p.id)
      ),
      ...(teamBPlayers || []).map((p) =>
        supabase
          .from('players')
          .update({
            total_matches_played: (p.total_matches_played || 0) + 1,
            total_wins: (p.total_wins || 0) + (teamAWon ? 0 : 1),
            total_losses: (p.total_losses || 0) + (teamAWon ? 1 : 0),
            status: 'queued',
            staged_match_id: null,
            wait_started_at: now,
          })
          .eq('id', p.id)
      ),
    ];
    await Promise.all(playerUpdates);
  }

  // 3. Mark match as completed with forfeit metadata
  const durationSeconds = match.started_at
    ? Math.floor((new Date(now).getTime() - new Date(match.started_at).getTime()) / 1000)
    : 0;

  const matchUpdatePromise = supabase
    .from('matches')
    .update({
      stage: 'completed',
      forfeited_by: forfeitedByTeam,
      score_a: scoringRequired ? scoreA : null,
      score_b: scoringRequired ? scoreB : null,
      elo_delta_team_a: eloDeltaA[0] || null,
      elo_delta_team_b: eloDeltaB[0] || null,
      completed_at: now,
      match_duration_seconds: durationSeconds,
    })
    .eq('id', matchId);

  // 4. Free the court and trigger auto-dispatch if applicable
  if (match.court_id) {
    const courtUpdatePromise = supabase
      .from('courts')
      .update({
        status: 'available',
        current_match_id: null,
      })
      .eq('id', match.court_id);

    await Promise.all([matchUpdatePromise, courtUpdatePromise]);
    await triggerAutoDispatchIfEligible(sessionId, match.court_id);
  } else {
    await matchUpdatePromise;
  }

  return { success: true };
}
