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
