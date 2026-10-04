import { describe, it, expect } from 'vitest';
import { auditMatchup } from '@/lib/engine/matchmaking/matchup-audit';
import { Match, Player } from '@/types/database';

function createMockPlayer(id: string, name: string): Player {
  return {
    id,
    session_id: 'sess-1',
    name,
    static_rating: 3,
    current_elo: 1200,
    status: 'queued',
    staged_match_id: null,
    wait_started_at: new Date().toISOString(),
    total_matches_played: 1,
    total_wins: 1,
    total_losses: 0,
    point_differential: 5,
    created_at: new Date().toISOString(),
  };
}

describe('Matchup Audit & Warning Utility (Issue 11)', () => {
  const p1 = createMockPlayer('p1', 'Alice');
  const p2 = createMockPlayer('p2', 'Bob');
  const p3 = createMockPlayer('p3', 'Charlie');
  const p4 = createMockPlayer('p4', 'Dave');
  const p5 = createMockPlayer('p5', 'Eve');
  const playersMap = new Map<string, Player>([
    ['p1', p1],
    ['p2', p2],
    ['p3', p3],
    ['p4', p4],
    ['p5', p5],
  ]);

  it('detects duplicate player inside the same matchup', () => {
    const match: Match = {
      id: 'm1',
      session_id: 'sess-1',
      court_id: null,
      stage: 'on_deck',
      on_deck_slot_number: 1,
      match_mode_used: 'social',
      match_type: 'doubles',
      team_a_ids: ['p1', 'p2'],
      team_b_ids: ['p1', 'p3'], // p1 is repeated!
      score_a: null,
      score_b: null,
      forfeited_by: null,
      elo_delta_team_a: null,
      elo_delta_team_b: null,
      staged_at: new Date().toISOString(),
      summoned_at: null,
      started_at: null,
      completed_at: null,
      match_duration_seconds: 0,
    };

    const warnings = auditMatchup(match, [], [], playersMap);
    expect(warnings.some((w) => w.type === 'duplicate_player')).toBe(true);
    expect(warnings[0].message).toContain('Alice');
  });

  it('detects recent rematches (A vs B or B vs A)', () => {
    const pastMatch: Match = {
      id: 'm-past',
      session_id: 'sess-1',
      court_id: 'c1',
      stage: 'completed',
      on_deck_slot_number: null,
      match_mode_used: 'social',
      match_type: 'doubles',
      team_a_ids: ['p1', 'p2'],
      team_b_ids: ['p3', 'p4'],
      score_a: 11,
      score_b: 9,
      forfeited_by: null,
      elo_delta_team_a: null,
      elo_delta_team_b: null,
      staged_at: new Date().toISOString(),
      summoned_at: null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      match_duration_seconds: 600,
    };

    // Reversed rematch: Team B vs Team A
    const newMatch: Match = {
      id: 'm-new',
      session_id: 'sess-1',
      court_id: null,
      stage: 'on_deck',
      on_deck_slot_number: 1,
      match_mode_used: 'social',
      match_type: 'doubles',
      team_a_ids: ['p4', 'p3'],
      team_b_ids: ['p2', 'p1'],
      score_a: null,
      score_b: null,
      forfeited_by: null,
      elo_delta_team_a: null,
      elo_delta_team_b: null,
      staged_at: new Date().toISOString(),
      summoned_at: null,
      started_at: null,
      completed_at: null,
      match_duration_seconds: 0,
    };

    const warnings = auditMatchup(newMatch, [pastMatch], [], playersMap);
    expect(warnings.some((w) => w.type === 'rematch')).toBe(true);
  });

  it('detects repeat partnerships in recent matches', () => {
    const pastMatch: Match = {
      id: 'm-past',
      session_id: 'sess-1',
      court_id: 'c1',
      stage: 'completed',
      on_deck_slot_number: null,
      match_mode_used: 'social',
      match_type: 'doubles',
      team_a_ids: ['p1', 'p2'],
      team_b_ids: ['p4', 'p5'],
      score_a: 11,
      score_b: 9,
      forfeited_by: null,
      elo_delta_team_a: null,
      elo_delta_team_b: null,
      staged_at: new Date().toISOString(),
      summoned_at: null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      match_duration_seconds: 600,
    };

    // New match has p1 & p2 partnered again against different opponents
    const newMatch: Match = {
      id: 'm-new',
      session_id: 'sess-1',
      court_id: null,
      stage: 'on_deck',
      on_deck_slot_number: 1,
      match_mode_used: 'social',
      match_type: 'doubles',
      team_a_ids: ['p2', 'p1'],
      team_b_ids: ['p3', 'p5'],
      score_a: null,
      score_b: null,
      forfeited_by: null,
      elo_delta_team_a: null,
      elo_delta_team_b: null,
      staged_at: new Date().toISOString(),
      summoned_at: null,
      started_at: null,
      completed_at: null,
      match_duration_seconds: 0,
    };

    const warnings = auditMatchup(newMatch, [pastMatch], [], playersMap);
    expect(warnings.some((w) => w.type === 'repeat_partner')).toBe(true);
    expect(warnings[0].message).toContain('Alice & Bob');
  });
});
