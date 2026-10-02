import { describe, it, expect } from 'vitest';
import { calculateInitialElo, calculateEloUpdates } from '@/lib/engine/matchmaking/elo-rated';
import { evaluateLockedPair, canPairPlayBalancedMode } from '@/lib/engine/matchmaking/locked-pairs';
import { findBalancedMatch } from '@/lib/engine/matchmaking/balanced';
import { findSkillSeparatedMatch, getPlayerTier } from '@/lib/engine/matchmaking/skill-separated';
import { computeOnDeckCap } from '@/lib/engine/on-deck';
import { Player, StaticRating } from '@/types/database';

function createMockPlayer(id: string, name: string, rating: number, waitMinutesAgo = 10, currentElo = 1200): Player {
  return {
    id,
    session_id: 'session-1',
    name,
    static_rating: rating as StaticRating,
    current_elo: currentElo,
    status: 'queued',
    staged_match_id: null,
    wait_started_at: new Date(Date.now() - waitMinutesAgo * 60 * 1000).toISOString(),
    total_matches_played: 0,
    total_wins: 0,
    total_losses: 0,
    point_differential: 0,
    created_at: new Date().toISOString(),
  };
}

describe('Module 2: On-Deck Cap Formula & 1-Court Regression Test', () => {
  it('CRITICAL: 1-court venue must yield on_deck_cap = 1, never 0', () => {
    expect(computeOnDeckCap(1)).toBe(1);
    expect(computeOnDeckCap(1, null)).toBe(1);
  });

  it('computes max(1, active_courts - 1) for multi-court venues', () => {
    expect(computeOnDeckCap(2)).toBe(1);
    expect(computeOnDeckCap(3)).toBe(2);
    expect(computeOnDeckCap(4)).toBe(3);
    expect(computeOnDeckCap(6)).toBe(5);
  });

  it('honors on_deck_cap_override when provided', () => {
    expect(computeOnDeckCap(3, 4)).toBe(4);
    expect(computeOnDeckCap(1, 2)).toBe(2);
  });
});

describe('Module 2: Dynamic Elo-Rated Mode', () => {
  it('seeds initial Elo correctly from static stars', () => {
    // 600 + (StaticStar - 1.0) * 350
    expect(calculateInitialElo(1.0)).toBe(600);
    expect(calculateInitialElo(3.0)).toBe(1300);
    expect(calculateInitialElo(3.5)).toBe(1475);
    expect(calculateInitialElo(5.0)).toBe(2000);
  });

  it('computes symmetric Elo delta with integer rounding and K-factor acceleration', () => {
    const resultNewPlayers = calculateEloUpdates({
      teamAElos: [1200, 1200],
      teamBElos: [1200, 1200],
      teamAWon: true,
      teamAMatchCounts: [1, 2], // < 5 matches -> K = 32
      teamBMatchCounts: [0, 3],
    });

    // Both teams equal: expected outcome = 0.5
    // Delta = round(32 * (1 - 0.5)) = round(16) = +16 for A, -16 for B
    expect(resultNewPlayers.expectedTeamA).toBeCloseTo(0.5, 4);
    expect(resultNewPlayers.teamADeltas).toEqual([16, 16]);
    expect(resultNewPlayers.teamBDeltas).toEqual([-16, -16]);
    expect(resultNewPlayers.newTeamAElos).toEqual([1216, 1216]);
    expect(resultNewPlayers.newTeamBElos).toEqual([1184, 1184]);
  });

  it('uses K=20 for established players with >= 5 session matches', () => {
    const resultEstablished = calculateEloUpdates({
      teamAElos: [1200, 1200],
      teamBElos: [1200, 1200],
      teamAWon: true,
      teamAMatchCounts: [5, 6], // >= 5 matches -> K = 20
      teamBMatchCounts: [5, 7],
    });

    // Delta = round(20 * (1 - 0.5)) = +10 for A, -10 for B
    expect(resultEstablished.teamADeltas).toEqual([10, 10]);
    expect(resultEstablished.teamBDeltas).toEqual([-10, -10]);
  });
});

describe('Module 2: Locked-Pair Calculus & Imbalance Clamp', () => {
  it('evaluates composite metrics and detects imbalance when diff >= 1.5', () => {
    const p1 = createMockPlayer('p1', 'Alice', 3.5);
    const p2 = createMockPlayer('p2', 'Bob', 3.5);
    const balancedPair = evaluateLockedPair(p1, p2);
    expect(balancedPair.compositeStaticRating).toBe(3.5);
    expect(balancedPair.isImbalanced).toBe(false);

    const p3 = createMockPlayer('p3', 'Charlie', 4.5);
    const p4 = createMockPlayer('p4', 'David', 2.0); // diff = 2.5 >= 1.5
    const imbalancedPair = evaluateLockedPair(p3, p4);
    expect(imbalancedPair.ratingDifferential).toBe(2.5);
    expect(imbalancedPair.isImbalanced).toBe(true);
  });

  it('bars imbalanced pair from Balanced mode unless matched against equivalent opposing pair', () => {
    const imbalanced = evaluateLockedPair(
      createMockPlayer('p1', 'P1', 4.5),
      createMockPlayer('p2', 'P2', 2.0) // composite = 3.25 ~ 3.3
    );

    // No opposing pair -> barred
    expect(canPairPlayBalancedMode(imbalanced)).toBe(false);

    // Opposing pair with equivalent rating (+- 0.5) -> allowed
    const opposing = evaluateLockedPair(
      createMockPlayer('p3', 'P3', 3.5),
      createMockPlayer('p4', 'P4', 3.0) // composite = 3.25
    );
    expect(canPairPlayBalancedMode(imbalanced, opposing)).toBe(true);
  });
});

describe('Module 2: Balanced Mode Team Assignment', () => {
  it('enforces rating spread envelope <= 1.0 and minimizes team disparity', () => {
    const players = [
      createMockPlayer('p1', 'P1', 3.5, 30),
      createMockPlayer('p2', 'P2', 3.0, 25),
      createMockPlayer('p3', 'P3', 3.5, 20),
      createMockPlayer('p4', 'P4', 4.0, 15),
    ];

    const match = findBalancedMatch(players);
    expect(match).not.toBeNull();
    expect(match!.ratingSpread).toBeLessThanOrEqual(1.0);
    expect(match!.teamDisparity).toBeLessThanOrEqual(0.5);
  });

  it('keeps locked pair on the same team', () => {
    const players = [
      createMockPlayer('p1', 'P1', 3.5, 30),
      createMockPlayer('p2', 'P2', 3.5, 25),
      createMockPlayer('p3', 'P3', 3.5, 20),
      createMockPlayer('p4', 'P4', 3.5, 15),
    ];

    const lockedPairs = [{ player1Id: 'p1', player2Id: 'p2' }];
    const match = findBalancedMatch(players, lockedPairs);
    expect(match).not.toBeNull();

    const teamAHasP1 = match!.teamA.some((p) => p.id === 'p1');
    const teamAHasP2 = match!.teamA.some((p) => p.id === 'p2');
    const teamBHasP1 = match!.teamB.some((p) => p.id === 'p1');
    const teamBHasP2 = match!.teamB.some((p) => p.id === 'p2');

    // p1 and p2 must either both be on Team A, or both on Team B
    expect((teamAHasP1 && teamAHasP2) || (teamBHasP1 && teamBHasP2)).toBe(true);
  });

  it('keeps locked pair together when solo player is at index 0 (Issue #6)', () => {
    // p_solo is index 0; p_pair1 and p_pair2 are at indices 1 and 2
    const players = [
      createMockPlayer('p_solo1', 'Solo 1', 3.0, 50),
      createMockPlayer('p_pair1', 'Pair 1', 3.0, 40),
      createMockPlayer('p_pair2', 'Pair 2', 3.0, 30),
      createMockPlayer('p_solo2', 'Solo 2', 3.0, 20),
    ];

    const lockedPairs = [{ player1Id: 'p_pair1', player2Id: 'p_pair2' }];
    const match = findBalancedMatch(players, lockedPairs);
    expect(match).not.toBeNull();

    const teamAHasP1 = match!.teamA.some((p) => p.id === 'p_pair1');
    const teamAHasP2 = match!.teamA.some((p) => p.id === 'p_pair2');
    const teamBHasP1 = match!.teamB.some((p) => p.id === 'p_pair1');
    const teamBHasP2 = match!.teamB.some((p) => p.id === 'p_pair2');

    expect((teamAHasP1 && teamAHasP2) || (teamBHasP1 && teamBHasP2)).toBe(true);
  });

  it('permits imbalanced locked pair (|R1 - R2| >= 1.5) when matched against counterbalancing opposing pair (Issue #10)', () => {
    // Pair 1: 2.0 and 3.5 (diff 1.5, composite 2.8)
    // Pair 2: 2.0 and 3.5 (diff 1.5, composite 2.8)
    // Individual spread is 1.5, which exceeds default maxSpread of 1.0
    const players = [
      createMockPlayer('p1_a', 'P1A', 2.0, 50),
      createMockPlayer('p1_b', 'P1B', 3.5, 45),
      createMockPlayer('p2_a', 'P2A', 2.0, 40),
      createMockPlayer('p2_b', 'P2B', 3.5, 35),
    ];

    const lockedPairs = [
      { player1Id: 'p1_a', player2Id: 'p1_b' },
      { player1Id: 'p2_a', player2Id: 'p2_b' },
    ];

    const match = findBalancedMatch(players, lockedPairs, 1.0);
    expect(match).not.toBeNull();
    expect(match!.teamDisparity).toBeLessThanOrEqual(0.5);
  });
});

describe('Module 2: Skill-Separated Tiered Play', () => {
  it('partitions players into hard tiers and never mixes tiers', () => {
    expect(getPlayerTier(2.0)).toBe('tier1_recreational');
    expect(getPlayerTier(3.0)).toBe('tier2_intermediate');
    expect(getPlayerTier(4.5)).toBe('tier3_advanced');

    const players = [
      createMockPlayer('t1_1', 'R1', 2.0, 50),
      createMockPlayer('t1_2', 'R2', 2.5, 45),
      createMockPlayer('t1_3', 'R3', 2.0, 40),
      createMockPlayer('t1_4', 'R4', 2.5, 35),
      createMockPlayer('t2_1', 'I1', 3.5, 10),
      createMockPlayer('t2_2', 'I2', 3.0, 5),
    ];

    const match = findSkillSeparatedMatch(players);
    expect(match).not.toBeNull();
    // All 4 players must be from Tier 1
    const allTier1 = [...match!.teamA, ...match!.teamB].every((p) => (p.static_rating ?? 0) <= 2.5);
    expect(allTier1).toBe(true);
  });

  it('assigns cross-tier locked pair to tier based on composite rating (Issue #11)', () => {
    // Player A is 2.5 (Tier 1 threshold), Player B is 3.1 (Tier 2)
    // Composite: 2.8 -> Tier 2
    // Along with two other Tier 2 players (3.0, 3.0), they form a valid Tier 2 match
    const players = [
      createMockPlayer('p_a', 'Player A', 2.5, 60),
      createMockPlayer('p_b', 'Player B', 3.1, 55),
      createMockPlayer('p_c', 'Player C', 3.0, 50),
      createMockPlayer('p_d', 'Player D', 3.0, 45),
    ];

    const lockedPairs = [{ player1Id: 'p_a', player2Id: 'p_b' }];
    const match = findSkillSeparatedMatch(players, lockedPairs);

    expect(match).not.toBeNull();
    const allMatchPlayerIds = [...match!.teamA, ...match!.teamB].map((p) => p.id);
    expect(allMatchPlayerIds).toContain('p_a');
    expect(allMatchPlayerIds).toContain('p_b');

    // Both partners must be co-located on either Team A or Team B
    const onTeamA = match!.teamA.some((p) => p.id === 'p_a') && match!.teamA.some((p) => p.id === 'p_b');
    const onTeamB = match!.teamB.some((p) => p.id === 'p_a') && match!.teamB.some((p) => p.id === 'p_b');
    expect(onTeamA || onTeamB).toBe(true);
  });
});
