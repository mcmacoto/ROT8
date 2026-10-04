import { createClient } from '@/lib/supabase/server';
import { StaticRating } from '@/types/database';

export interface PlayerEditInput {
  name?: string;
  static_rating?: StaticRating;
}

/**
 * Directly updates player name and/or rating.
 * STRICT NON-LOGGING POLICY: No audit table or change history log is written.
 */
export async function editPlayer(playerId: string, updates: PlayerEditInput) {
  const supabase = await createClient();

  const updatePayload: Record<string, unknown> = {};
  if (updates.name !== undefined) updatePayload.name = updates.name.trim();
  if (updates.static_rating !== undefined) updatePayload.static_rating = updates.static_rating;

  let { data, error } = await supabase
    .from('players')
    .update(updatePayload)
    .eq('id', playerId)
    .select()
    .single();

  if (error && (error.code === '23514' || error.message?.includes('players_static_rating_check'))) {
    if (updates.static_rating === 0) {
      updatePayload.static_rating = null;
      const retryRes = await supabase
        .from('players')
        .update(updatePayload)
        .eq('id', playerId)
        .select()
        .single();
      data = retryRes.data;
      error = retryRes.error;
    }
  }

  if (error) {
    throw new Error(`Failed to edit player: ${error.message}`);
  }

  return data;
}

/**
 * Replaces a player in an on-deck or summoning match with another player.
 * Supports:
 * - Direct replacement during both 'on_deck' and 'summoning' stages (Issue 4).
 * - Drafting replacement from the queue OR another on-deck slot (Issue 5).
 * - Placing the outgoing player into the Check-in / Holding list (Issue 10).
 */
export async function replaceMatchPlayer(
  sessionId: string,
  matchId: string,
  outgoingPlayerId: string,
  incomingPlayerId: string,
  options: { returnToHolding?: boolean } = {}
) {
  const supabase = await createClient();

  // 1. Fetch match and verify stage
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .eq('session_id', sessionId)
    .single();

  if (matchError || !match) {
    throw new Error('Match not found');
  }

  if (match.stage !== 'on_deck' && match.stage !== 'summoning') {
    throw new Error(
      `Player replacement is only permitted during on-deck or summoning stages. Current stage: '${match.stage}'.`
    );
  }

  // 2. Fetch incoming player and verify eligibility
  const { data: incomingPlayer, error: incomingError } = await supabase
    .from('players')
    .select('*')
    .eq('id', incomingPlayerId)
    .eq('session_id', sessionId)
    .single();

  if (incomingError || !incomingPlayer) {
    throw new Error('Replacement player not found');
  }

  if (incomingPlayer.status === 'on_court') {
    throw new Error('Cannot substitute a player who is currently active in a match.');
  }

  // If incoming player is currently staged in another match (Issue 5), vacate them from that donor match
  const donorMatchId = incomingPlayer.staged_match_id;
  if (donorMatchId && donorMatchId !== matchId) {
    const { data: donorMatch } = await supabase
      .from('matches')
      .select('*')
      .eq('id', donorMatchId)
      .single();

    if (donorMatch && donorMatch.stage === 'on_deck') {
      const newDonorA = (donorMatch.team_a_ids as string[]).filter((id: string) => id !== incomingPlayerId);
      const newDonorB = (donorMatch.team_b_ids as string[]).filter((id: string) => id !== incomingPlayerId);

      await supabase
        .from('matches')
        .update({
          team_a_ids: newDonorA,
          team_b_ids: newDonorB,
        })
        .eq('id', donorMatchId);
    }
  }

  // 3. Determine team assignment
  let newTeamA = [...match.team_a_ids];
  let newTeamB = [...match.team_b_ids];
  let found = false;

  if (newTeamA.includes(outgoingPlayerId)) {
    newTeamA = newTeamA.map((id) => (id === outgoingPlayerId ? incomingPlayerId : id));
    found = true;
  } else if (newTeamB.includes(outgoingPlayerId)) {
    newTeamB = newTeamB.map((id) => (id === outgoingPlayerId ? incomingPlayerId : id));
    found = true;
  }

  if (!found) {
    throw new Error('Outgoing player is not part of this match');
  }

  // 4. Update outgoing player: default to 'checked_in' (Holding list) per Issue 10
  const outgoingStatus = options.returnToHolding === false ? 'queued' : 'checked_in';
  await supabase
    .from('players')
    .update({ status: outgoingStatus, staged_match_id: null })
    .eq('id', outgoingPlayerId);

  // 5. Update incoming player: staged or summoned matching the target match stage
  const targetStatus = match.stage === 'summoning' ? 'summoned' : 'staged';
  await supabase
    .from('players')
    .update({ status: targetStatus, staged_match_id: matchId })
    .eq('id', incomingPlayerId);

  // 6. Update target match team arrays
  const { data: updatedMatch, error: updateError } = await supabase
    .from('matches')
    .update({
      team_a_ids: newTeamA,
      team_b_ids: newTeamB,
    })
    .eq('id', matchId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update match roster: ${updateError.message}`);
  }

  return updatedMatch;
}

export const replaceOnDeckPlayer = replaceMatchPlayer;
