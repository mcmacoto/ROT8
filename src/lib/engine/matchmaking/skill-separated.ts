import { Player } from '@/types/database';
import { MatchCandidate, findBalancedMatch } from './balanced';
import { getEffectiveRating } from './elo-rated';

export type Tier = 'tier1_recreational' | 'tier2_intermediate' | 'tier3_advanced';

export function getPlayerTier(rating: number): Tier {
  if (rating <= 2.5) return 'tier1_recreational';
  if (rating <= 3.5) return 'tier2_intermediate';
  return 'tier3_advanced';
}

/**
 * Skill-Separated Mode (Tiered Play):
 * Partitions players into 3 strict tiers. Players NEVER cross tier boundaries.
 * If multiple tiers have >= 4 players, prioritizes tier with highest aggregate bench wait time.
 */
export function findSkillSeparatedMatch(
  eligiblePlayers: Player[],
  lockedPairs: { player1Id: string; player2Id: string }[] = []
): MatchCandidate | null {
  const tier1: Player[] = [];
  const tier2: Player[] = [];
  const tier3: Player[] = [];

  const now = Date.now();

  for (const player of eligiblePlayers) {
    const tier = getPlayerTier(getEffectiveRating(player));
    if (tier === 'tier1_recreational') tier1.push(player);
    else if (tier === 'tier2_intermediate') tier2.push(player);
    else tier3.push(player);
  }

  // Calculate aggregate bench wait time (in ms) for tiers with at least 4 players
  const candidates = [
    { tier: 'tier1', pool: tier1 },
    { tier: 'tier2', pool: tier2 },
    { tier: 'tier3', pool: tier3 },
  ]
    .filter((c) => c.pool.length >= 4)
    .map((c) => {
      const aggregateWait = c.pool.reduce(
        (sum, p) => sum + (now - new Date(p.wait_started_at).getTime()),
        0
      );
      return { ...c, aggregateWait };
    })
    .sort((a, b) => b.aggregateWait - a.aggregateWait); // Highest wait time first

  for (const candidate of candidates) {
    // Within the tier, use balanced team matching
    const match = findBalancedMatch(candidate.pool, lockedPairs, 1.5);
    if (match) return match;
  }

  return null;
}
