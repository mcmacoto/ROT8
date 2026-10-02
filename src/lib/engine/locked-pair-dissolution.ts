import { createClient } from '@/lib/supabase/server';

export interface DissolutionResult {
  dissolved: boolean;
  pairId?: string;
  player1Id?: string;
  player2Id?: string;
}

/**
 * Dissolves a locked pair for a session upon explicit host two-sided confirmation.
 * Deactivates the locked_pairs record.
 */
export async function dissolveLockedPair(
  sessionId: string,
  playerId: string
): Promise<DissolutionResult> {
  const supabase = await createClient();

  // Find active locked pair containing this player
  const { data: pair, error } = await supabase
    .from('locked_pairs')
    .select('*')
    .eq('session_id', sessionId)
    .eq('is_active', true)
    .or(`player_1_id.eq.${playerId},player_2_id.eq.${playerId}`)
    .single();

  if (error || !pair) {
    return { dissolved: false };
  }

  // Deactivate the pair
  await supabase
    .from('locked_pairs')
    .update({ is_active: false })
    .eq('id', pair.id);

  return {
    dissolved: true,
    pairId: pair.id,
    player1Id: pair.player_1_id,
    player2Id: pair.player_2_id,
  };
}

/**
 * Recalculates and updates composite_elo for active locked pairs containing any of the given players.
 */
export async function syncLockedPairsElo(
  sessionId: string,
  playerIds: string[]
): Promise<void> {
  if (!playerIds || playerIds.length === 0) return;

  const supabase = await createClient();

  const { data: activePairs } = await supabase
    .from('locked_pairs')
    .select('id, player_1_id, player_2_id')
    .eq('session_id', sessionId)
    .eq('is_active', true);

  if (!activePairs || activePairs.length === 0) return;

  const relevantPairs = activePairs.filter(
    (p) => playerIds.includes(p.player_1_id) || playerIds.includes(p.player_2_id)
  );

  if (relevantPairs.length === 0) return;

  const neededPlayerIds = new Set<string>();
  relevantPairs.forEach((p) => {
    neededPlayerIds.add(p.player_1_id);
    neededPlayerIds.add(p.player_2_id);
  });

  const { data: players } = await supabase
    .from('players')
    .select('id, current_elo')
    .in('id', Array.from(neededPlayerIds));

  const eloMap = new Map<string, number>((players || []).map((p) => [p.id, p.current_elo]));

  for (const pair of relevantPairs) {
    const elo1 = eloMap.get(pair.player_1_id);
    const elo2 = eloMap.get(pair.player_2_id);
    if (elo1 !== undefined && elo2 !== undefined) {
      const newComposite = Math.round((elo1 + elo2) / 2);
      await supabase
        .from('locked_pairs')
        .update({ composite_elo: newComposite })
        .eq('id', pair.id);
    }
  }
}

