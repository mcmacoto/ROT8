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
 * Replaces a player in an on-deck match with a queued player.
 * SERVER-SIDE ENFORCEMENT: Strictly rejected if match stage is not 'on_deck'.
 * Active, summoning, in_match, result_pending, or completed matches cannot have players replaced (Elo-integrity guarantee).
 */
export async function replaceOnDeckPlayer(
  sessionId: string,
  matchId: string,
  outgoingPlayerId: string,
  incomingPlayerId: string
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

  if (match.stage !== 'on_deck') {
    throw new Error(
      `Player replacement is strictly forbidden on matches in stage '${match.stage}'. Full replacement is on-deck only for Elo integrity.`
    );
  }

  // 2. Determine team assignment
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

  // 3. Update matches and player statuses in place (no audit log)
  // Revert outgoing player to queued
  await supabase
    .from('players')
    .update({ status: 'queued', staged_match_id: null })
    .eq('id', outgoingPlayerId);

  // Claim incoming player to staged
  await supabase
    .from('players')
    .update({ status: 'staged', staged_match_id: matchId })
    .eq('id', incomingPlayerId);

  // Update match team arrays
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
