import { describe, it, expect } from 'vitest';
import { calculateInitialElo, getEffectiveRating } from '@/lib/engine/matchmaking/elo-rated';
import { findBalancedMatch } from '@/lib/engine/matchmaking/balanced';
import { evaluateLockedPair } from '@/lib/engine/matchmaking/locked-pairs';
import { Player } from '@/types/database';

describe('Player Rating & Effective Rating Calculation', () => {
  it('calculates initial Elo 1200 for unrated players (0.0, null, or undefined)', () => {
    expect(calculateInitialElo(0.0)).toBe(1200);
    expect(calculateInitialElo(null)).toBe(1200);
    expect(calculateInitialElo(undefined)).toBe(1200);
    expect(calculateInitialElo(3.5)).toBe(1475);
  });

  it('derives effective rating 2.7 for unrated players with baseline Elo 1200', () => {
    const unratedPlayer: Partial<Player> = {
      name: 'New Player',
      static_rating: null,
      current_elo: 1200,
    };
    expect(getEffectiveRating(unratedPlayer)).toBe(2.7);

    const zeroRatingPlayer: Partial<Player> = {
      name: 'Zero Player',
      static_rating: 0.0,
      current_elo: 1200,
    };
    expect(getEffectiveRating(zeroRatingPlayer)).toBe(2.7);
  });

  it('preserves static_rating when player has a non-zero rating', () => {
    const ratedPlayer: Partial<Player> = {
      name: 'Rated Player',
      static_rating: 4.0,
      current_elo: 1650,
    };
    expect(getEffectiveRating(ratedPlayer)).toBe(4.0);
  });
});

describe('Matchmaking with Unrated Players', () => {
  const createMockPlayer = (id: string, name: string, rating: number | null, waitMin: number): Player => ({
    id,
    session_id: 'sess-1',
    name,
    static_rating: rating as any,
    current_elo: 1200,
    status: 'queued',
    staged_match_id: null,
    wait_started_at: new Date(Date.now() - waitMin * 60 * 1000).toISOString(),
    total_matches_played: 0,
    total_wins: 0,
    total_losses: 0,
    point_differential: 0,
    created_at: new Date().toISOString(),
  });

  it('successfully forms balanced match with unrated players without stalling due to spread', () => {
    // 4 players: 2 unrated (effective 2.7) and 2 rated 3.0 players
    const p1 = createMockPlayer('p1', 'Unrated 1', 0.0, 10);
    const p2 = createMockPlayer('p2', 'Unrated 2', null, 8);
    const p3 = createMockPlayer('p3', 'Rated 3.0 A', 3.0, 6);
    const p4 = createMockPlayer('p4', 'Rated 3.0 B', 3.0, 4);

    const match = findBalancedMatch([p1, p2, p3, p4], [], 1.0);
    expect(match).not.toBeNull();
    expect(match?.teamA).toHaveLength(2);
    expect(match?.teamB).toHaveLength(2);
    // Rating spread between 2.7 and 3.0 is 0.3 <= 1.0
    expect(match?.ratingSpread).toBeLessThanOrEqual(1.0);
  });

  it('evaluates locked pair with unrated player without false severe imbalance', () => {
    const unrated = createMockPlayer('p1', 'Unrated', 0.0, 5);
    const partner = createMockPlayer('p2', 'Rated 3.0', 3.0, 5);

    const pair = evaluateLockedPair(unrated, partner);
    // Effective ratings are 2.7 and 3.0; diff is 0.3, not imbalanced
    expect(pair.isImbalanced).toBe(false);
    expect(pair.compositeStaticRating).toBe(2.9);
  });
});
