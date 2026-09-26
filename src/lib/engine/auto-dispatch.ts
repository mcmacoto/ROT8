import { createClient } from '@/lib/supabase/server';

/**
 * Checks if auto-dispatch is enabled for the session, and if an available court
 * and ready on-deck slot exist, auto-promotes the lowest-numbered on-deck slot to the available court.
 * Returns true if a match was auto-dispatched.
 */
export async function triggerAutoDispatchIfEligible(
  sessionId: string,
  availableCourtId: string
): Promise<boolean> {
  const supabase = await createClient();

  // 1. Check session setting
  const { data: session } = await supabase
    .from('sessions')
    .select('auto_dispatch_enabled')
    .eq('id', sessionId)
    .single();

  if (!session?.auto_dispatch_enabled) {
    return false; // Auto-dispatch disabled by default
  }

  // 2. Find lowest-numbered on-deck match
  const { data: onDeckMatch } = await supabase
    .from('matches')
    .select('*')
    .eq('session_id', sessionId)
    .eq('stage', 'on_deck')
    .order('on_deck_slot_number', { ascending: true })
    .limit(1)
    .single();

  if (!onDeckMatch) {
    return false; // No on-deck matchup ready
  }

  // 3. Promote to summoning on the available court
  const now = new Date().toISOString();
  await supabase
    .from('matches')
    .update({
      court_id: availableCourtId,
      stage: 'summoning',
      summoned_at: now,
      on_deck_slot_number: null,
    })
    .eq('id', onDeckMatch.id);

  // Update court status
  await supabase
    .from('courts')
    .update({
      status: 'summoning',
      current_match_id: onDeckMatch.id,
    })
    .eq('id', availableCourtId);

  // Update players to summoned
  const allPlayerIds = [...onDeckMatch.team_a_ids, ...onDeckMatch.team_b_ids];
  await supabase
    .from('players')
    .update({ status: 'summoned' })
    .in('id', allPlayerIds);

  return true;
}
