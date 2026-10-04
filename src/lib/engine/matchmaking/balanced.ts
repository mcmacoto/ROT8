import { Player } from '@/types/database';
import { getEffectiveRating } from './elo-rated';
import { evaluateLockedPair, canPairPlayBalancedMode } from './locked-pairs';

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

  // Sort candidate players by wait time descending (longest waiting first)
  const pool = [...uniqueEligible].sort(
    (a, b) => new Date(a.wait_started_at).getTime() - new Date(b.wait_started_at).getTime()
  );

  let bestMatch: MatchCandidate | null = null;
  let minDisparity = Infinity;

  // Search through top candidate pool (capped at 20 to prevent combination explosion)
  const candidatePool = pool.slice(0, Math.min(pool.length, 20));

  // Try candidate groups of 4 starting from highest wait time
  for (let i = 0; i < candidatePool.length - 3; i++) {
    for (let j = i + 1; j < candidatePool.length - 2; j++) {
      for (let k = j + 1; k < candidatePool.length - 1; k++) {
        for (let l = k + 1; l < candidatePool.length; l++) {
          const group = [candidatePool[i], candidatePool[j], candidatePool[k], candidatePool[l]];
          if (new Set(group.map((p) => p.id)).size !== 4) continue;

          // Verify pair lock integrity: if a player is in the group, their partner must be in the group
          const isValidPairGrouping = group.every((player) => {
            const partnerId = pairMap.get(player.id);
            return !partnerId || group.some((p) => p.id === partnerId);
          });

          if (!isValidPairGrouping) continue;

          // Check rating spread & imbalanced locked pair handling
          const ratings = group.map((p) => getEffectiveRating(p));
          const maxR = Math.max(...ratings);
          const minR = Math.min(...ratings);
          const spread = Number((maxR - minR).toFixed(1));

          const hasLockedPair = group.some((p) => pairMap.has(p.id));

          if (hasLockedPair) {
            const p0PartnerId = pairMap.get(group[0].id);
            const p0Partner = p0PartnerId ? group.find((p) => p.id === p0PartnerId) : null;
            const pair1 = p0Partner ? evaluateLockedPair(group[0], p0Partner) : null;

            const remaining = group.filter((p) => p.id !== group[0].id && p.id !== p0PartnerId);
            const rem0PartnerId = remaining.length === 2 ? pairMap.get(remaining[0].id) : null;
            const remPartner = rem0PartnerId && remaining[1].id === rem0PartnerId ? remaining[1] : null;
            const pair2 = remPartner ? evaluateLockedPair(remaining[0], remaining[1]) : null;

            const anyImbalanced = Boolean(pair1?.isImbalanced || pair2?.isImbalanced);

            if (anyImbalanced) {
              if (pair1 && pair2 && canPairPlayBalancedMode(pair1, pair2)) {
                // Counterbalanced opposing locked pairs permitted
              } else {
                continue; // Imbalanced pair without counterbalancing opposing pair rejected
              }
            } else if (spread > maxSpread) {
              continue;
            }
          } else if (spread > maxSpread) {
            continue;
          }

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
    const isPairIntact = split.teamA.every((player) => {
      const partnerId = pairMap.get(player.id);
      if (!partnerId) return true;
      return split.teamA.some((teammate) => teammate.id === partnerId);
    });

    if (!isPairIntact) continue;

    result.push(split);
  }

  return result;
}
