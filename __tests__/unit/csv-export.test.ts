import { describe, it, expect } from 'vitest';
import { generateMatchesCSV } from '@/lib/export/csv';
import { Match, Player, Court, StaticRating } from '@/types/database';

describe('Module 7: CSV Match History Export', () => {
  it('formats court number as "Court N" when courtsMap is provided (Issue #15)', () => {
    const mockMatch: Match = {
      id: 'match-uuid-1',
      session_id: 'session-1',
      court_id: 'court-uuid-1',
      stage: 'completed',
      on_deck_slot_number: null,
      match_mode_used: 'balanced',
      match_type: 'doubles',
      team_a_ids: ['p1', 'p2'],
      team_b_ids: ['p3', 'p4'],
      score_a: 11,
      score_b: 9,
      elo_delta_team_a: 16,
      elo_delta_team_b: -16,
      forfeited_by: null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      summoned_at: null,
      staged_at: new Date().toISOString(),
      match_duration_seconds: 600,
    };

    const mockPlayer = (id: string, name: string): Player => ({
      id,
      session_id: 'session-1',
      name,
      static_rating: 3.5 as StaticRating,
      current_elo: 1200,
      status: 'queued',
      staged_match_id: null,
      wait_started_at: new Date().toISOString(),
      total_matches_played: 1,
      total_wins: 1,
      total_losses: 0,
      point_differential: 2,
      created_at: new Date().toISOString(),
    });

    const playersMap = new Map<string, Player>([
      ['p1', mockPlayer('p1', 'Alice')],
      ['p2', mockPlayer('p2', 'Bob')],
      ['p3', mockPlayer('p3', 'Charlie')],
      ['p4', mockPlayer('p4', 'Diana')],
    ]);

    const court1: Court = {
      id: 'court-uuid-1',
      session_id: 'session-1',
      court_number: 3,
      name: 'Court 3',
      assigned_match_type: 'doubles',
      status: 'available',
      current_match_id: null,
    };

    const courtsMap = new Map<string, Court>([['court-uuid-1', court1]]);

    const csv = generateMatchesCSV([mockMatch], playersMap, courtsMap);

    // Verify CSV contains readable court label "Court 3", NOT raw UUID "court-uuid-1"
    expect(csv).toContain('Court 3');
    expect(csv).not.toContain('court-uuid-1');
    expect(csv).toContain('"Alice & Bob"');
    expect(csv).toContain('"Charlie & Diana"');
  });
});
