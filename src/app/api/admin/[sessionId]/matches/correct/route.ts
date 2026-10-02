import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyHostAuthorization } from '@/lib/auth/require-host-auth';
import { calculateEloUpdates } from '@/lib/engine/matchmaking/elo-rated';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const isAuthed = await verifyHostAuthorization(sessionId);
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized host' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { matchId, scoreA, scoreB, winningTeam, forfeitedByTeam } = body;

    if (!matchId) {
      return NextResponse.json({ error: 'matchId is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Fetch match and session
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .eq('session_id', sessionId)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (match.stage !== 'completed') {
      return NextResponse.json(
        { error: 'Only completed matches can have their results corrected' },
        { status: 400 }
      );
    }

    const { data: session } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    const scoringRequired = session?.scoring_required ?? true;

    // 2. Fetch team players
    const { data: teamAPlayers } = await supabase
      .from('players')
      .select('*')
      .in('id', match.team_a_ids);

    const { data: teamBPlayers } = await supabase
      .from('players')
      .select('*')
      .in('id', match.team_b_ids);

    if (!teamAPlayers || !teamBPlayers) {
      return NextResponse.json({ error: 'Team players not found' }, { status: 404 });
    }

    // 3. Determine previous winner and deltas to revert
    let prevTeamAWon = true;
    if (match.forfeited_by === 'A') {
      prevTeamAWon = false;
    } else if (match.forfeited_by === 'B') {
      prevTeamAWon = true;
    } else if (match.score_a !== null && match.score_b !== null) {
      prevTeamAWon = match.score_a > match.score_b;
    } else if (match.elo_delta_team_a !== null && match.elo_delta_team_a !== undefined) {
      prevTeamAWon = match.elo_delta_team_a > 0;
    }

    const prevScoreA = match.score_a ?? 0;
    const prevScoreB = match.score_b ?? 0;
    const prevPointDiffA = prevScoreA - prevScoreB;
    const prevPointDiffB = prevScoreB - prevScoreA;
    const prevEloDeltaA = match.elo_delta_team_a ?? 0;
    const prevEloDeltaB = match.elo_delta_team_b ?? 0;

    // Compute base (reverted) player stats
    const teamABase = teamAPlayers.map((p) => ({
      player: p,
      baseElo: p.current_elo - prevEloDeltaA,
      baseWins: Math.max(0, p.total_wins - (prevTeamAWon ? 1 : 0)),
      baseLosses: Math.max(0, p.total_losses - (prevTeamAWon ? 0 : 1)),
      basePointDiff: p.point_differential - (scoringRequired ? prevPointDiffA : 0),
      baseMatchCount: Math.max(0, p.total_matches_played - 1),
    }));

    const teamBBase = teamBPlayers.map((p) => ({
      player: p,
      baseElo: p.current_elo - prevEloDeltaB,
      baseWins: Math.max(0, p.total_wins - (prevTeamAWon ? 0 : 1)),
      baseLosses: Math.max(0, p.total_losses - (prevTeamAWon ? 1 : 0)),
      basePointDiff: p.point_differential - (scoringRequired ? prevPointDiffB : 0),
      baseMatchCount: Math.max(0, p.total_matches_played - 1),
    }));

    // 4. Determine new winner
    let newTeamAWon = true;
    if (forfeitedByTeam === 'A') {
      newTeamAWon = false;
    } else if (forfeitedByTeam === 'B') {
      newTeamAWon = true;
    } else if (winningTeam === 'A') {
      newTeamAWon = true;
    } else if (winningTeam === 'B') {
      newTeamAWon = false;
    } else if (scoreA !== undefined && scoreB !== undefined && scoreA !== null && scoreB !== null) {
      newTeamAWon = Number(scoreA) > Number(scoreB);
    }

    const newScoreA = scoreA !== undefined && scoreA !== null ? Number(scoreA) : null;
    const newScoreB = scoreB !== undefined && scoreB !== null ? Number(scoreB) : null;

    let newEloDeltaA: number[] = [0, 0];
    let newEloDeltaB: number[] = [0, 0];

    if (
      scoringRequired &&
      newScoreA !== null &&
      newScoreB !== null &&
      teamABase.length > 0 &&
      teamBBase.length > 0
    ) {
      const eloUpdates = calculateEloUpdates({
        teamAElos: teamABase.map((b) => b.baseElo) as [number, number],
        teamBElos: teamBBase.map((b) => b.baseElo) as [number, number],
        teamAWon: newTeamAWon,
        teamAMatchCounts: teamABase.map((b) => b.baseMatchCount) as [number, number],
        teamBMatchCounts: teamBBase.map((b) => b.baseMatchCount) as [number, number],
      });
      newEloDeltaA = eloUpdates.teamADeltas;
      newEloDeltaB = eloUpdates.teamBDeltas;
    }

    const newPointDiffA = newScoreA !== null && newScoreB !== null ? newScoreA - newScoreB : 0;
    const newPointDiffB = newScoreA !== null && newScoreB !== null ? newScoreB - newScoreA : 0;

    // 5. Update players in database
    const playerUpdates = [
      ...teamABase.map((b, i) =>
        supabase
          .from('players')
          .update({
            current_elo: Math.round(b.baseElo + (scoringRequired ? (newEloDeltaA[i] || 0) : 0)),
            total_wins: b.baseWins + (newTeamAWon ? 1 : 0),
            total_losses: b.baseLosses + (newTeamAWon ? 0 : 1),
            point_differential: b.basePointDiff + (scoringRequired ? newPointDiffA : 0),
          })
          .eq('id', b.player.id)
      ),
      ...teamBBase.map((b, i) =>
        supabase
          .from('players')
          .update({
            current_elo: Math.round(b.baseElo + (scoringRequired ? (newEloDeltaB[i] || 0) : 0)),
            total_wins: b.baseWins + (newTeamAWon ? 0 : 1),
            total_losses: b.baseLosses + (newTeamAWon ? 1 : 0),
            point_differential: b.basePointDiff + (scoringRequired ? newPointDiffB : 0),
          })
          .eq('id', b.player.id)
      ),
    ];

    await Promise.all(playerUpdates);

    // 6. Update match in database
    const { data: updatedMatch, error: updateError } = await supabase
      .from('matches')
      .update({
        score_a: scoringRequired ? newScoreA : null,
        score_b: scoringRequired ? newScoreB : null,
        forfeited_by: forfeitedByTeam || null,
        elo_delta_team_a: scoringRequired && newEloDeltaA.length > 0 ? newEloDeltaA[0] : null,
        elo_delta_team_b: scoringRequired && newEloDeltaB.length > 0 ? newEloDeltaB[0] : null,
      })
      .eq('id', matchId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update match record: ' + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      match: updatedMatch,
      eloDeltas: {
        teamA: newEloDeltaA,
        teamB: newEloDeltaB,
      },
      winner: newTeamAWon ? 'A' : 'B',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error correcting match';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
