import { createClient } from '@/lib/supabase/server';
import { Player } from '@/types/database';

/**
 * Flags an absent player as a no-show during summoning or needs_attention:
 * 1. Offending player is moved to status = 'resting' (and staged_match_id cleared).
 * 2. Next eligible player from queue is drafted to replace them in the match without dropping remaining 3 players.
 * 3. Grace countdown restarts (summoned_at reset to NOW()).
 */
export async function handleNoShowRedraft(
  sessionId: string,
  matchId: string,
  noShowPlayerId: string
): Promise<{ success: boolean; replacementPlayerId: string }> {
  const supabase = await createClient();

  // 1. Fetch match
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .eq('session_id', sessionId)
    .single();

  if (matchError || !match) {
    throw new Error('Match not found');
  }

  // 2. Move offending player to resting and dissolve any active locked pair
  await supabase
    .from('players')
    .update({ status: 'resting', staged_match_id: null })
    .eq('id', noShowPlayerId);

  await supabase
    .from('locked_pairs')
    .update({ is_active: false })
    .eq('session_id', sessionId)
    .eq('is_active', true)
    .or(`player_1_id.eq.${noShowPlayerId},player_2_id.eq.${noShowPlayerId}`);

  // 3. Find next eligible queued solo player (must not break an active locked pair)
  const [{ data: availableQueue }, { data: activePairs }] = await Promise.all([
    supabase
      .from('players')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'queued')
      .is('staged_match_id', null)
      .order('wait_started_at', { ascending: true }),
    supabase
      .from('locked_pairs')
      .select('player_1_id, player_2_id')
      .eq('session_id', sessionId)
      .eq('is_active', true),
  ]);

  const lockedPlayerIds = new Set<string>();
  if (activePairs) {
    for (const p of activePairs) {
      lockedPlayerIds.add(p.player_1_id);
      lockedPlayerIds.add(p.player_2_id);
    }
  }

  const eligibleCandidates = (availableQueue || []).filter((p) => !lockedPlayerIds.has(p.id));

  if (eligibleCandidates.length === 0) {
    throw new Error('No eligible queued player available to replace no-show without breaking a locked pair.');
  }

  const replacementPlayer: Player = eligibleCandidates[0];

  // 4. Update team rosters
  let newTeamA = [...match.team_a_ids];
  let newTeamB = [...match.team_b_ids];

  if (newTeamA.includes(noShowPlayerId)) {
    newTeamA = newTeamA.map((id) => (id === noShowPlayerId ? replacementPlayer.id : id));
  } else if (newTeamB.includes(noShowPlayerId)) {
    newTeamB = newTeamB.map((id) => (id === noShowPlayerId ? replacementPlayer.id : id));
  }

  // Claim replacement player
  await supabase
    .from('players')
    .update({ status: 'summoned' })
    .eq('id', replacementPlayer.id);

  // 5. Update match and restart grace timer
  const now = new Date().toISOString();
  await supabase
    .from('matches')
    .update({
      team_a_ids: newTeamA,
      team_b_ids: newTeamB,
      summoned_at: now, // Restarts grace countdown
      stage: 'summoning',
    })
    .eq('id', matchId);

  // Ensure court is in summoning state
  if (match.court_id) {
    await supabase
      .from('courts')
      .update({ status: 'summoning' })
      .eq('id', match.court_id);
  }

  return { success: true, replacementPlayerId: replacementPlayer.id };
}
