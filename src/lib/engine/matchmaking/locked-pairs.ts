import { Player } from '@/types/database';
import { getEffectiveRating } from './elo-rated';

export interface EvaluatedPair {
  player1: Player;
  player2: Player;
  compositeStaticRating: number;
  compositeElo: number;
  ratingDifferential: number;
  isImbalanced: boolean; // |R1 - R2| >= 1.5
}

/**
 * Calculates metrics for a locked pair.
 */
export function evaluateLockedPair(player1: Player, player2: Player): EvaluatedPair {
  const r1 = getEffectiveRating(player1);
  const r2 = getEffectiveRating(player2);
  const compositeStaticRating = Number(((r1 + r2) / 2).toFixed(1));
  const compositeElo = Math.round((player1.current_elo + player2.current_elo) / 2);
  const ratingDifferential = Math.abs(r1 - r2);
  const isImbalanced = ratingDifferential >= 1.5;

  return {
    player1,
    player2,
    compositeStaticRating,
    compositeElo,
    ratingDifferential,
    isImbalanced,
  };
}

/**
 * Validates if an imbalanced pair (|R1 - R2| >= 1.5) can be admitted to Balanced mode.
 * Permitted only if matched against an opposing locked pair with equivalent composite rating (+- 1.0).
 */
export function canPairPlayBalancedMode(
  pair: EvaluatedPair,
  opposingPair?: EvaluatedPair
): boolean {
  if (!pair.isImbalanced) {
    return true; // Balanced rating spread within pair
  }

  // If imbalanced, requires opposing locked pair with composite rating within +- 1.0
  if (!opposingPair) {
    return false;
  }

  return Math.abs(pair.compositeStaticRating - opposingPair.compositeStaticRating) <= 1.0;
}
