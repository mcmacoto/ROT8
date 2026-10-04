import { describe, it, expect } from 'vitest';
import { findBalancedMatch } from '@/lib/engine/matchmaking/balanced';
import { findSocialMatch, makePairKey, PairingHistory } from '@/lib/engine/matchmaking/social';
import { Player, StaticRating } from '@/types/database';

function createMockPlayer(id: string, name: string, rating: number, waitMinutesAgo: number): Player {
  const waitDate = new Date(Date.now() - waitMinutesAgo * 60 * 1000);
  return {
    id,
    session_id: 'sess-1',
    name,
    static_rating: rating as StaticRating,
    current_elo: rating * 400,
    status: 'queued',
    staged_match_id: null,
    wait_started_at: waitDate.toISOString(),
    total_matches_played: 0,
    total_wins: 0,
    total_losses: 0,
    point_differential: 0,
    created_at: waitDate.toISOString(),
  };
}

describe('Matchmaking Engine Enhancements (Issue 8 & Deduplication)', () => {
  it('findBalancedMatch safely handles duplicate player records in eligiblePlayers pool', () => {
    const p1 = createMockPlayer('p1', 'Player 1', 3.0, 10);
    const p2 = createMockPlayer('p2', 'Player 2', 3.0, 8);
    const p3 = createMockPlayer('p3', 'Player 3', 3.0, 6);
    const p4 = createMockPlayer('p4', 'Player 4', 3.0, 4);

    // Duplicate p1 in pool
    const pool = [p1, p1, p2, p3, p4];

    const match = findBalancedMatch(pool);
    expect(match).not.toBeNull();
    if (match) {
      const allIds = [...match.teamA.map((p) => p.id), ...match.teamB.map((p) => p.id)];
      expect(allIds.length).toBe(4);
      expect(new Set(allIds).size).toBe(4);
    }
  });

  it('findSocialMatch safely handles duplicate player records in eligiblePlayers pool', () => {
    const p1 = createMockPlayer('p1', 'Player 1', 3.0, 15);
    const p2 = createMockPlayer('p2', 'Player 2', 3.0, 12);
    const p3 = createMockPlayer('p3', 'Player 3', 3.0, 10);
    const p4 = createMockPlayer('p4', 'Player 4', 3.0, 5);

    // Duplicate p2 in pool
    const pool = [p1, p2, p2, p3, p4];

    const match = findSocialMatch(pool);
    expect(match).not.toBeNull();
    if (match) {
      const allIds = [...match.teamA.map((p) => p.id), ...match.teamB.map((p) => p.id)];
      expect(allIds.length).toBe(4);
      expect(new Set(allIds).size).toBe(4);
    }
  });

  it('findSocialMatch applies repeat partner penalty based on pairing history', () => {
    const p1 = createMockPlayer('p1', 'Player 1', 3.0, 20);
    const p2 = createMockPlayer('p2', 'Player 2', 3.0, 19);
    const p3 = createMockPlayer('p3', 'Player 3', 3.0, 18);
    const p4 = createMockPlayer('p4', 'Player 4', 3.0, 17);
    const p5 = createMockPlayer('p5', 'Player 5', 3.0, 16);

    // History: p1 and p2 have paired 5 times before!
    const history: PairingHistory = {
      [makePairKey('p1', 'p2')]: 5,
    };

    const match = findSocialMatch([p1, p2, p3, p4, p5], history);
    expect(match).not.toBeNull();
    if (match) {
      // Check that team A and team B are not [p1, p2]
      const teamAIds = match.teamA.map((p) => p.id);
      const teamBIds = match.teamB.map((p) => p.id);

      const p1p2InTeamA = teamAIds.includes('p1') && teamAIds.includes('p2');
      const p1p2InTeamB = teamBIds.includes('p1') && teamBIds.includes('p2');

      expect(p1p2InTeamA).toBe(false);
      expect(p1p2InTeamB).toBe(false);
    }
  });
});
