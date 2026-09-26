import { StaticRating } from '@/types/database';

/**
 * Calculates initial Elo rating from a player's static star rating:
 * R_initial = 600 + (StaticStar - 1.0) * 350
 * Examples: 1.0 -> 600, 3.0 -> 1300, 3.5 -> 1475, 5.0 -> 2000
 */
export function calculateInitialElo(staticRating?: number | null): number {
  if (staticRating === undefined || staticRating === null || staticRating === 0) return 1200;
  return Math.round(600 + (staticRating - 1.0) * 350);
}

/**
 * Returns the effective rating of a player for matchmaking calculations.
 * If static_rating is defined and > 0, returns static_rating.
 * If unrated (null or 0.0), calculates baseline rating derived from current_elo (e.g. 1200 -> 2.7).
 */
export function getEffectiveRating(player: { static_rating?: number | null; current_elo?: number | null }): number {
  if (player.static_rating != null && player.static_rating > 0) {
    return player.static_rating;
  }
  const elo = player.current_elo || 1200;
  const derived = 1.0 + (elo - 600) / 350;
  return Math.max(1.0, Math.min(5.0, Number(derived.toFixed(1))));
}

export interface EloCalculationParams {
  teamAElos: [number, number] | [number]; // 1 or 2 players per team
  teamBElos: [number, number] | [number];
  teamAWon: boolean;
  teamAMatchCounts: [number, number] | [number]; // Total matches played in session
  teamBMatchCounts: [number, number] | [number];
}

export interface EloCalculationResult {
  expectedTeamA: number;
  expectedTeamB: number;
  teamADeltas: number[];
  teamBDeltas: number[];
  newTeamAElos: number[];
  newTeamBElos: number[];
}

/**
 * Calculates Elo rating changes using the logistic expected outcome curve.
 * Applies K=32 for accelerating convergence (< 5 session matches) and K=20 for established players (>= 5 matches).
 * Ensures exact integer rounding with zero floating point drift.
 */
export function calculateEloUpdates(params: EloCalculationParams): EloCalculationResult {
  const { teamAElos, teamBElos, teamAWon, teamAMatchCounts, teamBMatchCounts } = params;

  // Composite team Elo ratings
  const compositeA = teamAElos.reduce((sum, r) => sum + r, 0) / teamAElos.length;
  const compositeB = teamBElos.reduce((sum, r) => sum + r, 0) / teamBElos.length;

  // Expected outcome formula
  const expectedTeamA = 1 / (1 + Math.pow(10, (compositeB - compositeA) / 400));
  const expectedTeamB = 1 - expectedTeamA;

  const scoreA = teamAWon ? 1 : 0;
  const scoreB = teamAWon ? 0 : 1;

  // K-factor: K=32 for <5 session matches, K=20 for >= 5
  const teamADeltas = teamAElos.map((_, i) => {
    const k = teamAMatchCounts[i] < 5 ? 32 : 20;
    return Math.round(k * (scoreA - expectedTeamA));
  });

  const teamBDeltas = teamBElos.map((_, i) => {
    const k = teamBMatchCounts[i] < 5 ? 32 : 20;
    return Math.round(k * (scoreB - expectedTeamB));
  });

  const newTeamAElos = teamAElos.map((elo, i) => elo + teamADeltas[i]);
  const newTeamBElos = teamBElos.map((elo, i) => elo + teamBDeltas[i]);

  return {
    expectedTeamA,
    expectedTeamB,
    teamADeltas,
    teamBDeltas,
    newTeamAElos,
    newTeamBElos,
  };
}
