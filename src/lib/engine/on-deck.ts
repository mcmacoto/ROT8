import { MatchMode, Match } from '@/types/database';
import { findBalancedMatch } from './matchmaking/balanced';
import { findSkillSeparatedMatch } from './matchmaking/skill-separated';
import { findSocialMatch, PairingHistory } from './matchmaking/social';
import { createClient } from '@/lib/supabase/server';
import { claimPlayersForMatch, releaseStagedPlayers } from '@/lib/db/claim-players';
import { StalledSlot, computeOnDeckCap } from './cap';

export type { StalledSlot };
export { computeOnDeckCap };

/**
 * Composes a single on-deck slot for a session using the session's active matchmaking mode.
 * Claims players atomically via row locks.
 */
export async function composeOnDeckSlot(
  sessionId: string,
  slotNumber: number,
  mode: MatchMode,
  options: { maxSpread?: number; history?: PairingHistory } = {}
): Promise<{ match: Match | null; stalled: StalledSlot | null }> {
  const supabase = await createClient();

  // 1. Fetch queued players who are NOT currently staged
  const { data: players, error } = await supabase
    .from('players')
    .select('*')
    .eq('session_id', sessionId)
    .eq('status', 'queued')
    .is('staged_match_id', null)
    .order('wait_started_at', { ascending: true });

  if (error || !players || players.length < 4) {
    return {
      match: null,
      stalled: {
        isStalled: true,
        slotNumber,
        reason: 'Insufficient eligible queued players (minimum 4 required).',
        recoveryActions: ['relax_skill_bounds', 'shift_to_social'],
      },
    };
  }

  // 2. Fetch locked pairs for this session
  const { data: lockedPairsData } = await supabase
    .from('locked_pairs')
    .select('*')
    .eq('session_id', sessionId)
    .eq('is_active', true);

  const lockedPairs = (lockedPairsData || []).map((lp) => ({
    player1Id: lp.player_1_id,
    player2Id: lp.player_2_id,
  }));

  // 3. Match candidate according to mode
  let candidate = null;
  const spread = options.maxSpread ?? (mode === 'balanced' ? 1.0 : 1.5);

  if (mode === 'balanced' || mode === 'elo_rated') {
    candidate = findBalancedMatch(players, lockedPairs, spread);
  } else if (mode === 'skill_separated') {
    candidate = findSkillSeparatedMatch(players, lockedPairs);
  } else if (mode === 'social') {
    candidate = findSocialMatch(players, options.history || {}, lockedPairs);
  }

  if (!candidate) {
    return {
      match: null,
      stalled: {
        isStalled: true,
        slotNumber,
        reason: 'Unable to form valid matchup under current mode constraints.',
        recoveryActions: ['relax_skill_bounds', 'shift_to_social'],
      },
    };
  }

  const teamAIds = candidate.teamA.map((p) => p.id);
  const teamBIds = candidate.teamB.map((p) => p.id);
  const allPlayerIds = [...teamAIds, ...teamBIds];

  // 4. Create the match row in 'on_deck' stage
  const { data: createdMatch, error: matchError } = await supabase
    .from('matches')
    .insert({
      session_id: sessionId,
      court_id: null,
      stage: 'on_deck',
      on_deck_slot_number: slotNumber,
      match_mode_used: mode,
      match_type: 'doubles',
      team_a_ids: teamAIds,
      team_b_ids: teamBIds,
    })
    .select()
    .single();

  if (matchError || !createdMatch) {
    throw new Error(`Failed to create on-deck match: ${matchError?.message}`);
  }

  // 5. Atomically claim players
  const claimResult = await claimPlayersForMatch(
    sessionId,
    allPlayerIds,
    createdMatch.id,
    'staged'
  );

  if (!claimResult.allSucceeded) {
    // Rollback any successfully claimed players before deleting match to avoid orphan 'staged' status
    if (claimResult.claimedIds.length > 0) {
      await supabase
        .from('players')
        .update({
          status: 'queued',
          staged_match_id: null,
        })
        .in('id', claimResult.claimedIds);
    }
    await supabase.from('matches').delete().eq('id', createdMatch.id);
    return {
      match: null,
      stalled: {
        isStalled: true,
        slotNumber,
        reason: 'One or more players were claimed concurrently by another slot.',
        recoveryActions: ['relax_skill_bounds', 'shift_to_social'],
      },
    };
  }

  return { match: createdMatch, stalled: null };
}

/**
 * Manual Reroll for an on-deck slot:
 * Releases slot's players back to 'queued' and recomposes that slot only.
 */
export async function rerollSlot(sessionId: string, matchId: string) {
  const supabase = await createClient();

  const { data: match } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .eq('stage', 'on_deck')
    .single();

  if (!match) throw new Error('On-deck match not found');

  const slotNumber = match.on_deck_slot_number || 1;
  const mode = match.match_mode_used;

  // Release currently staged players
  await releaseStagedPlayers(sessionId, matchId);
  // Remove old match row
  await supabase.from('matches').delete().eq('id', matchId);

  // Re-compose for that slot
  return composeOnDeckSlot(sessionId, slotNumber, mode);
}

/**
 * Recovery Action 1: Relax Skill Bounds
 * Widens rating spread by 0.5 and recomposes for that slot only.
 */
export async function relaxSlotBounds(sessionId: string, matchId: string) {
  const supabase = await createClient();

  const { data: match } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .eq('stage', 'on_deck')
    .single();

  if (!match) throw new Error('On-deck match not found');

  const slotNumber = match.on_deck_slot_number || 1;
  await releaseStagedPlayers(sessionId, matchId);
  await supabase.from('matches').delete().eq('id', matchId);

  return composeOnDeckSlot(sessionId, slotNumber, match.match_mode_used, { maxSpread: 1.5 });
}

/**
 * Recovery Action 2: Shift to Social Mode
 * Recomposes that slot using Social Mode logic without affecting global session mode.
 */
export async function shiftSlotToSocial(sessionId: string, matchId: string) {
  const supabase = await createClient();

  const { data: match } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .eq('stage', 'on_deck')
    .single();

  if (!match) throw new Error('On-deck match not found');

  const slotNumber = match.on_deck_slot_number || 1;
  await releaseStagedPlayers(sessionId, matchId);
  await supabase.from('matches').delete().eq('id', matchId);

  return composeOnDeckSlot(sessionId, slotNumber, 'social');
}

/**
 * Automatically replenishes all empty on-deck slots up to on_deck_cap.
 * For each unfilled slot (1..cap), calls composeOnDeckSlot.
 * Stops if insufficient players (< 4) or matchmaking stalls.
 */
export async function fillAvailableOnDeckSlots(sessionId: string): Promise<number> {
  const supabase = await createClient();

  const [
    { data: session },
    { data: courts },
    { data: onDeckMatches }
  ] = await Promise.all([
    supabase.from('sessions').select('*').eq('id', sessionId).single(),
    supabase.from('courts').select('id').eq('session_id', sessionId),
    supabase.from('matches').select('id, on_deck_slot_number').eq('session_id', sessionId).eq('stage', 'on_deck'),
  ]);

  if (!session || !courts || courts.length === 0) return 0;

  const cap = computeOnDeckCap(courts.length, session.on_deck_cap_override);
  const occupiedSlots = new Set((onDeckMatches || []).map((m) => m.on_deck_slot_number).filter(Boolean));

  let createdCount = 0;
  for (let slot = 1; slot <= cap; slot++) {
    if (!occupiedSlots.has(slot)) {
      const { match, stalled } = await composeOnDeckSlot(sessionId, slot, session.match_mode);
      if (match) {
        createdCount++;
        occupiedSlots.add(slot);
      }
      if (stalled) {
        // Break early if we cannot form a match for the next slot
        break;
      }
    }
  }

  return createdCount;
}
