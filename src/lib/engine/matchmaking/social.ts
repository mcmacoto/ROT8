import { Player } from '@/types/database';
import { MatchCandidate } from './balanced';
import { getEffectiveRating } from './elo-rated';

export interface PairingHistory {
  [playerPairKey: string]: number; // key: `${min(id1, id2)}_${max(id1, id2)}` => count
}

export function makePairKey(id1: string, id2: string): string {
  return id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
}

/**
 * Social Mode (Club Mixer):
 * Objective: maximize wait-time priority while penalizing repeat partner pairings.
 * Cost(i, j) = (w_wait * T_wait) - (w_repeat * H_ij^2)
 */
export function findSocialMatch(
  eligiblePlayers: Player[],
  history: PairingHistory = {},
  lockedPairs: { player1Id: string; player2Id: string }[] = [],
  wWait = 1.0,
  wRepeat = 50.0
): MatchCandidate | null {
  // Deduplicate candidate players by id
  const seenIds = new Set<string>();
  const uniqueEligible = eligiblePlayers.filter((p) => {
    if (seenIds.has(p.id)) return false;
    seenIds.add(p.id);
    return true;
  });
  if (uniqueEligible.length < 4) return null;

  // Build lookup of locked pairs
  const pairMap = new Map<string, string>();
  for (const lp of lockedPairs) {
    pairMap.set(lp.player1Id, lp.player2Id);
    pairMap.set(lp.player2Id, lp.player1Id);
  }

  // Sort candidates by wait time (longest waiting first)
  const now = Date.now();
  const pool = [...uniqueEligible].sort(
    (a, b) => new Date(a.wait_started_at).getTime() - new Date(b.wait_started_at).getTime()
  );

  let bestMatch: MatchCandidate | null = null;
  let bestScore = -Infinity;

  // Pick top players by wait time
  const candidatePool = pool.slice(0, Math.min(pool.length, 12));

  for (let i = 0; i < candidatePool.length - 3; i++) {
    for (let j = i + 1; j < candidatePool.length - 2; j++) {
      for (let k = j + 1; k < candidatePool.length - 1; k++) {
        for (let l = k + 1; l < candidatePool.length; l++) {
          const group = [candidatePool[i], candidatePool[j], candidatePool[k], candidatePool[l]];
          if (new Set(group.map((p) => p.id)).size !== 4) continue;

          // Verify pair lock integrity
          const isValidPairGrouping = group.every((player) => {
            const partnerId = pairMap.get(player.id);
            return !partnerId || group.some((p) => p.id === partnerId);
          });
          if (!isValidPairGrouping) continue;

          // Try splits
          const splits = [
            { teamA: [group[0], group[1]], teamB: [group[2], group[3]] },
            { teamA: [group[0], group[2]], teamB: [group[1], group[3]] },
            { teamA: [group[0], group[3]], teamB: [group[1], group[2]] },
          ];

          for (const split of splits) {
            // Verify pair not split across teams
            const isPairIntact = split.teamA.every((player) => {
              const partnerId = pairMap.get(player.id);
              if (!partnerId) return true;
              return split.teamA.some((teammate) => teammate.id === partnerId);
            });
            if (!isPairIntact) continue;

            // Calculate wait score (minutes)
            const totalWaitMinutes = group.reduce(
              (sum, p) => sum + (now - new Date(p.wait_started_at).getTime()) / (60 * 1000),
              0
            );

            // Repeat penalty
            const repeatA = history[makePairKey(split.teamA[0].id, split.teamA[1].id)] || 0;
            const repeatB = history[makePairKey(split.teamB[0].id, split.teamB[1].id)] || 0;
            const penalty = Math.pow(repeatA, 2) + Math.pow(repeatB, 2);

            const score = wWait * totalWaitMinutes - wRepeat * penalty;

            if (score > bestScore) {
              bestScore = score;
              bestMatch = {
                teamA: split.teamA,
                teamB: split.teamB,
                ratingSpread: Math.abs(
                  Math.max(...group.map((p) => getEffectiveRating(p))) -
                    Math.min(...group.map((p) => getEffectiveRating(p)))
                ),
                teamDisparity: Math.abs(
                  getEffectiveRating(split.teamA[0]) +
                    getEffectiveRating(split.teamA[1]) -
                    (getEffectiveRating(split.teamB[0]) + getEffectiveRating(split.teamB[1]))
                ),
              };
            }
          }
        }
      }
    }
  }

  return bestMatch;
}
