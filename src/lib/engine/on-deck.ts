import { MatchMode, Match } from '@/types/database';
import { findBalancedMatch } from './matchmaking/balanced';
import { findSkillSeparatedMatch } from './matchmaking/skill-separated';
import { findSocialMatch, PairingHistory, makePairKey } from './matchmaking/social';
import { createClient } from '@/lib/supabase/server';
import { claimPlayersForMatch, releaseStagedPlayers } from '@/lib/db/claim-players';
import { StalledSlot, computeOnDeckCap } from './cap';

export type { StalledSlot };
export { computeOnDeckCap, buildPairingHistory };

/**
 * Builds pairing frequency history from completed matches to penalize repeat partnerships in social mode.
 */
function buildPairingHistory(completedMatches: Partial<Match>[]): PairingHistory {
  const history: PairingHistory = {};
  for (const m of completedMatches) {
    if (m.team_a_ids && m.team_a_ids.length === 2) {
      const keyA = makePairKey(m.team_a_ids[0], m.team_a_ids[1]);
      history[keyA] = (history[keyA] || 0) + 1;
    }
    if (m.team_b_ids && m.team_b_ids.length === 2) {
      const keyB = makePairKey(m.team_b_ids[0], m.team_b_ids[1]);
      history[keyB] = (history[keyB] || 0) + 1;
    }
  }
  return history;
}

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

  // Automatically construct pairing history for social mode if not supplied
  let history = options.history;
  if (!history && mode === 'social') {
    const { data: pastMatches } = await supabase
      .from('matches')
      .select('team_a_ids, team_b_ids, stage')
      .eq('session_id', sessionId)
      .eq('stage', 'completed')
      .order('completed_at', { ascending: false })
      .limit(50);

    history = buildPairingHistory(pastMatches || []);
  }

  // 3. Match candidate according to mode
  let candidate = null;
  const spread = options.maxSpread ?? (mode === 'balanced' ? 1.0 : 1.5);

  if (mode === 'balanced' || mode === 'elo_rated') {
    candidate = findBalancedMatch(players, lockedPairs, spread);
  } else if (mode === 'skill_separated') {
    candidate = findSkillSeparatedMatch(players, lockedPairs);
  } else if (mode === 'social') {
    candidate = findSocialMatch(players, history || {}, lockedPairs);
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

  // Enforce strict player uniqueness: no duplicate player IDs in a match
  if (new Set(allPlayerIds).size !== 4) {
    return {
      match: null,
      stalled: {
        isStalled: true,
        slotNumber,
        reason: 'Match candidate contained duplicate player assignments.',
        recoveryActions: ['relax_skill_bounds', 'shift_to_social'],
      },
    };
  }

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
 * Supports either an active matchId or a slotNumber for stalled slots.
 */
export async function relaxSlotBounds(sessionId: string, slotOrMatchId: string | number) {
  const supabase = await createClient();

  let slotNumber = 1;
  let mode: MatchMode = 'balanced';

  if (typeof slotOrMatchId === 'string' && isNaN(Number(slotOrMatchId))) {
    const { data: match } = await supabase
      .from('matches')
      .select('*')
      .eq('id', slotOrMatchId)
      .eq('stage', 'on_deck')
      .single();

    if (match) {
      slotNumber = match.on_deck_slot_number || 1;
      mode = match.match_mode_used;
      await releaseStagedPlayers(sessionId, match.id);
      await supabase.from('matches').delete().eq('id', match.id);
    }
  } else {
    slotNumber = Number(slotOrMatchId);
    const { data: existingMatch } = await supabase
      .from('matches')
      .select('*')
      .eq('session_id', sessionId)
      .eq('stage', 'on_deck')
      .eq('on_deck_slot_number', slotNumber)
      .single();

    if (existingMatch) {
      mode = existingMatch.match_mode_used;
      await releaseStagedPlayers(sessionId, existingMatch.id);
      await supabase.from('matches').delete().eq('id', existingMatch.id);
    } else {
      const { data: session } = await supabase
        .from('sessions')
        .select('match_mode')
        .eq('id', sessionId)
        .single();
      mode = session?.match_mode || 'balanced';
    }
  }

  return composeOnDeckSlot(sessionId, slotNumber, mode, { maxSpread: 1.5 });
}

/**
 * Recovery Action 2: Shift to Social Mode
 * Recomposes that slot using Social Mode logic without affecting global session mode.
 * Supports either an active matchId or a slotNumber for stalled slots.
 */
export async function shiftSlotToSocial(sessionId: string, slotOrMatchId: string | number) {
  const supabase = await createClient();

  let slotNumber = 1;

  if (typeof slotOrMatchId === 'string' && isNaN(Number(slotOrMatchId))) {
    const { data: match } = await supabase
      .from('matches')
      .select('*')
      .eq('id', slotOrMatchId)
      .eq('stage', 'on_deck')
      .single();

    if (match) {
      slotNumber = match.on_deck_slot_number || 1;
      await releaseStagedPlayers(sessionId, match.id);
      await supabase.from('matches').delete().eq('id', match.id);
    }
  } else {
    slotNumber = Number(slotOrMatchId);
    const { data: existingMatch } = await supabase
      .from('matches')
      .select('*')
      .eq('session_id', sessionId)
      .eq('stage', 'on_deck')
      .eq('on_deck_slot_number', slotNumber)
      .single();

    if (existingMatch) {
      await releaseStagedPlayers(sessionId, existingMatch.id);
      await supabase.from('matches').delete().eq('id', existingMatch.id);
    }
  }

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

/**
 * Synchronizes on-deck slots with the effective cap.
 * - Prunes any excess on-deck slots beyond cap and releases their players back to queued.
 * - Replenishes any empty slots up to the cap.
 */
export async function syncOnDeckSlotsToCap(
  sessionId: string
): Promise<{ prunedCount: number; createdCount: number }> {
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

  if (!session || !courts || courts.length === 0) return { prunedCount: 0, createdCount: 0 };

  const cap = computeOnDeckCap(courts.length, session.on_deck_cap_override);
  const excessMatches = (onDeckMatches || []).filter((m) => (m.on_deck_slot_number || 0) > cap);

  let prunedCount = 0;
  for (const match of excessMatches) {
    await releaseStagedPlayers(sessionId, match.id);
    await supabase.from('matches').delete().eq('id', match.id);
    prunedCount++;
  }

  const createdCount = await fillAvailableOnDeckSlots(sessionId);
  return { prunedCount, createdCount };
}
