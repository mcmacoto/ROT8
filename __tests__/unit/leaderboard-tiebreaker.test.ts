import { describe, it, expect } from 'vitest';
import { computeLeaderboard, calculateStrengthOfSchedule } from '@/lib/engine/leaderboard';
import { Player, Match, StaticRating } from '@/types/database';

function createPlayerRecord(
  id: string,
  name: string,
  elo: number,
  wins: number,
  losses: number,
  diff: number,
  createdMinutesAgo = 10,
  staticRating: StaticRating = 3
): Player {
  return {
    id,
    session_id: 'sess-1',
    name,
    static_rating: staticRating,
    current_elo: elo,
    status: 'queued',
    staged_match_id: null,
    wait_started_at: new Date().toISOString(),
    total_matches_played: wins + losses,
    total_wins: wins,
    total_losses: losses,
    point_differential: diff,
    created_at: new Date(Date.now() - createdMinutesAgo * 60 * 1000).toISOString(),
  };
}

describe('Module 7: Strict Hierarchical Leaderboard Tie-Breaking', () => {
  it('breaks ties in Dynamic Elo Mode strictly: Elo -> diff -> volume -> FIFO', () => {
    // Two players with same Elo (1300), but p1 has higher diff (+5 vs +2)
    const p1 = createPlayerRecord('p1', 'Zachary (Z)', 1300, 2, 0, 5, 20); // Alphabetically Z, but higher diff
    const p2 = createPlayerRecord('p2', 'Aaron (A)', 1300, 2, 0, 2, 15);   // Alphabetically A

    const leaderboard = computeLeaderboard([p2, p1], [], 'elo_rated', true);
    // p1 must rank #1 because diff (+5) > (+2), NOT alphabetically!
    expect(leaderboard[0].player.id).toBe('p1');
    expect(leaderboard[1].player.id).toBe('p2');
  });

  it('breaks ties in Elo Mode using match volume when Elo and diff tie', () => {
    // Both 1250 Elo, +0 diff. p1 played 4 matches, p2 played 2 matches.
    const p1 = createPlayerRecord('p1', 'P1', 1250, 2, 2, 0, 20);
    const p2 = createPlayerRecord('p2', 'P2', 1250, 1, 1, 0, 15);

    const leaderboard = computeLeaderboard([p2, p1], [], 'elo_rated', true);
    expect(leaderboard[0].player.id).toBe('p1');
    expect(leaderboard[1].player.id).toBe('p2');
  });

  it('breaks ties in Standard Mode (Scoring ON): Win% -> games played -> diff -> SOS -> FIFO', () => {
    // p1: 3-1 (75%), p2: 2-0 (100%)
    const p1 = createPlayerRecord('p1', 'P1', 1200, 3, 1, 10, 30);
    const p2 = createPlayerRecord('p2', 'P2', 1200, 2, 0, 8, 20);

    const leaderboard = computeLeaderboard([p1, p2], [], 'balanced', true);
    // p2 has 100% win rate vs 75%
    expect(leaderboard[0].player.id).toBe('p2');
    expect(leaderboard[1].player.id).toBe('p1');
  });

  it('ranks player with 100% win rate over 5 games higher than 100% win rate over 1 game (Issue 3)', () => {
    // p1 has 5-0 (100%), point differential +12
    // p2 has 1-0 (100%), point differential +18 (higher differential, but only 1 game)
    const p1 = createPlayerRecord('p1', 'Veteran Winner', 1200, 5, 0, 12, 30);
    const p2 = createPlayerRecord('p2', 'Single Game Winner', 1200, 1, 0, 18, 20);

    const leaderboard = computeLeaderboard([p2, p1], [], 'balanced', true);
    // p1 must rank higher because of 5 games played vs 1 game played!
    expect(leaderboard[0].player.id).toBe('p1');
    expect(leaderboard[1].player.id).toBe('p2');
  });

  it('breaks ties using point differential when players have identical W-L records and games played', () => {
    // Both 3-1 (75% win rate, 4 matches played), but p1 has +12 point diff vs p2 with +4 point diff
    const p1 = createPlayerRecord('p1', 'Player Alpha', 1200, 3, 1, 12, 30);
    const p2 = createPlayerRecord('p2', 'Player Beta', 1200, 3, 1, 4, 20);

    const leaderboard = computeLeaderboard([p2, p1], [], 'balanced', true);
    expect(leaderboard[0].player.id).toBe('p1');
    expect(leaderboard[1].player.id).toBe('p2');
  });

  it('breaks ties in Standard Mode (Scoring OFF): Win% -> games played -> diff -> SOS -> FIFO', () => {
    // In unscored sessions, wins/losses are still tracked:
    // p1: 2-1 (66.7%), p2: 3-0 (100%)
    const p1 = createPlayerRecord('p1', 'P1', 1200, 2, 1, 0, 30);
    const p2 = createPlayerRecord('p2', 'P2', 1200, 3, 0, 0, 20);

    const leaderboard = computeLeaderboard([p1, p2], [], 'balanced', false);
    expect(leaderboard[0].player.id).toBe('p2');
    expect(leaderboard[1].player.id).toBe('p1');
  });

  it('calculates Strength of Schedule (SOS) accurately from opponent static ratings', () => {
    const p1 = createPlayerRecord('p1', 'P1', 1200, 1, 0, 4);
    const op1 = createPlayerRecord('op1', 'OP1', 1200, 0, 1, -2, 10, 4);
    const op2 = createPlayerRecord('op2', 'OP2', 1200, 0, 1, -2, 10, 3);

    const mockMatch: Match = {
      id: 'm1',
      session_id: 'sess-1',
      court_id: 'c1',
      stage: 'completed',
      on_deck_slot_number: null,
      match_mode_used: 'balanced',
      match_type: 'doubles',
      team_a_ids: ['p1', 'partner'],
      team_b_ids: ['op1', 'op2'],
      score_a: 11,
      score_b: 7,
      forfeited_by: null,
      elo_delta_team_a: 10,
      elo_delta_team_b: -10,
      staged_at: new Date().toISOString(),
      summoned_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      match_duration_seconds: 600,
    };

    const playersMap = new Map<string, Player>([
      ['p1', p1],
      ['op1', op1],
      ['op2', op2],
    ]);

    // Opponents are 4 and 3 -> average SOS = 3.5
    const sos = calculateStrengthOfSchedule('p1', [mockMatch], playersMap);
    expect(sos).toBe(3.5);
  });
});
