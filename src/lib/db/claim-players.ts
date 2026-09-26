import { createClient } from '@/lib/supabase/server';
import { PlayerStatus } from '@/types/database';

export interface ClaimResult {
  claimedIds: string[];
  failedIds: string[];
  allSucceeded: boolean;
}

/**
 * Claims players for a match row using PostgreSQL row locking (FOR UPDATE SKIP LOCKED).
 * Ensures no player can ever be double-drafted into two on-deck slots or direct dispatch.
 */
export async function claimPlayersForMatch(
  sessionId: string,
  playerIds: string[],
  matchId: string,
  targetStatus: PlayerStatus = 'staged'
): Promise<ClaimResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('claim_players_for_match', {
    p_session_id: sessionId,
    p_player_ids: playerIds,
    p_match_id: matchId,
    p_target_status: targetStatus,
  });

  if (error) {
    throw new Error(`claimPlayersForMatch failed: ${error.message}`);
  }

  const results = (data || []) as { claimed_id: string; success: boolean }[];
  const claimedIds = results.filter((r) => r.success).map((r) => r.claimed_id);
  const failedIds = results.filter((r) => !r.success).map((r) => r.claimed_id);

  return {
    claimedIds,
    failedIds,
    allSucceeded: failedIds.length === 0 && claimedIds.length === playerIds.length,
  };
}

/**
 * Releases staged players of a match back to 'queued' status.
 */
export async function releaseStagedPlayers(
  sessionId: string,
  matchId: string
): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('release_staged_players', {
    p_session_id: sessionId,
    p_match_id: matchId,
  });

  if (error) {
    throw new Error(`releaseStagedPlayers failed: ${error.message}`);
  }

  return Number(data || 0);
}
