import { Player } from '@/types/database';
import { getEffectiveRating } from './elo-rated';

export interface MatchCandidate {
  teamA: Player[];
  teamB: Player[];
  ratingSpread: number;
  teamDisparity: number;
}

/**
 * Finds the optimal 4-player balanced doubles match from the eligible pool.
 * Constraint: max(R_i) - min(R_i) <= maxSpread (default 1.0)
 * Objective: minimize |(R_A1 + R_A2) - (R_B1 + R_B2)|, target <= 0.5
 * Respects locked pairs as indivisible units.
 */
export function findBalancedMatch(
  eligiblePlayers: Player[],
  lockedPairs: { player1Id: string; player2Id: string }[] = [],
  maxSpread = 1.0
): MatchCandidate | null {
  if (eligiblePlayers.length < 4) return null;

  // Build lookup of locked pairs
  const pairMap = new Map<string, string>();
  for (const lp of lockedPairs) {
    pairMap.set(lp.player1Id, lp.player2Id);
    pairMap.set(lp.player2Id, lp.player1Id);
  }

  // Sort candidate players by wait time descending (longest waiting first)
  const pool = [...eligiblePlayers].sort(
    (a, b) => new Date(a.wait_started_at).getTime() - new Date(b.wait_started_at).getTime()
  );

  let bestMatch: MatchCandidate | null = null;
  let minDisparity = Infinity;

  // Try candidate groups of 4 starting from highest wait time
  for (let i = 0; i < pool.length - 3; i++) {
    for (let j = i + 1; j < pool.length - 2; j++) {
      for (let k = j + 1; k < pool.length - 1; k++) {
        for (let l = k + 1; l < pool.length; l++) {
          const group = [pool[i], pool[j], pool[k], pool[l]];

          // Verify pair lock integrity: if a player is in the group, their partner must be in the group
          const isValidPairGrouping = group.every((player) => {
            const partnerId = pairMap.get(player.id);
            return !partnerId || group.some((p) => p.id === partnerId);
          });

          if (!isValidPairGrouping) continue;

          // Check rating spread
          const ratings = group.map((p) => getEffectiveRating(p));
          const maxR = Math.max(...ratings);
          const minR = Math.min(...ratings);
          const spread = Number((maxR - minR).toFixed(1));

          if (spread > maxSpread) continue;

          // Try all valid team split permutations (keeping pairs together)
          const permutations = getValidTeamPermutations(group, pairMap);

          for (const perm of permutations) {
            const sumA = getEffectiveRating(perm.teamA[0]) + getEffectiveRating(perm.teamA[1]);
            const sumB = getEffectiveRating(perm.teamB[0]) + getEffectiveRating(perm.teamB[1]);
            const disparity = Number(Math.abs(sumA - sumB).toFixed(2));

            if (disparity < minDisparity) {
              minDisparity = disparity;
              bestMatch = {
                teamA: perm.teamA,
                teamB: perm.teamB,
                ratingSpread: spread,
                teamDisparity: disparity,
              };

              // Target satisfied
              if (disparity <= 0.5) {
                return bestMatch;
              }
            }
          }
        }
      }
    }
  }

  return bestMatch;
}

function getValidTeamPermutations(
  group: Player[],
  pairMap: Map<string, string>
): { teamA: Player[]; teamB: Player[] }[] {
  const result: { teamA: Player[]; teamB: Player[] }[] = [];

  // Pair partitions
  const splits = [
    { teamA: [group[0], group[1]], teamB: [group[2], group[3]] },
    { teamA: [group[0], group[2]], teamB: [group[1], group[3]] },
    { teamA: [group[0], group[3]], teamB: [group[1], group[2]] },
  ];

  for (const split of splits) {
    // Verify that neither team breaks a pair
    const p0Partner = pairMap.get(group[0].id);
    if (p0Partner) {
      const p0PartnerInTeamA = split.teamA.some((p) => p.id === p0Partner);
      if (!p0PartnerInTeamA && split.teamA.some((p) => p.id === group[0].id)) {
        continue;
      }
    }

    result.push(split);
  }

  return result;
}
