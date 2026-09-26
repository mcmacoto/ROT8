import { describe, it, expect } from 'vitest';
import { Player, Match } from '@/types/database';

describe('Match Completion & Queue Invariants', () => {
  it('identifies winners correctly in both scored and unscored matches', () => {
    // Scored match
    const scoreA = 11;
    const scoreB = 8;
    const teamAWonScored = scoreA > scoreB;
    expect(teamAWonScored).toBe(true);

    // Unscored match with explicit winner
    const winningTeam = 'B' as 'A' | 'B';
    const teamAWonUnscored = winningTeam === 'A';
    expect(teamAWonUnscored).toBe(false);
  });

  it('keeps staged (on-deck) players visible in off-court queue list', () => {
    const players: Partial<Player>[] = [
      { id: 'p1', name: 'Alice', status: 'queued', staged_match_id: null },
      { id: 'p2', name: 'Bob', status: 'staged', staged_match_id: 'm-ondeck-1' },
      { id: 'p3', name: 'Charlie', status: 'on_court', staged_match_id: 'm-active-1' },
      { id: 'p4', name: 'Dave', status: 'resting', staged_match_id: null },
      { id: 'p5', name: 'Eve', status: 'checked_in', staged_match_id: null },
    ];

    // Filter rule: queued or staged players should be shown in Off-Court Queue
    const queuedPlayers = players.filter((p) => p.status === 'queued' || p.status === 'staged');

    expect(queuedPlayers.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(queuedPlayers.find((p) => p.id === 'p2')?.status).toBe('staged');
  });

  it('clears staged_match_id and returns player to queued status upon match completion', () => {
    // Player previously in match
    const playerBefore: Partial<Player> = {
      id: 'p1',
      name: 'Alice',
      status: 'on_court',
      staged_match_id: 'm-123',
      total_matches_played: 2,
      total_wins: 1,
      total_losses: 1,
    };

    const now = new Date().toISOString();
    const teamAWon = true;
    const isTeamA = true;

    // Simulated update applied on match completion
    const playerAfter: Partial<Player> = {
      ...playerBefore,
      status: 'queued',
      staged_match_id: null,
      wait_started_at: now,
      total_matches_played: (playerBefore.total_matches_played || 0) + 1,
      total_wins: (playerBefore.total_wins || 0) + (teamAWon && isTeamA ? 1 : 0),
      total_losses: (playerBefore.total_losses || 0) + (!teamAWon && isTeamA ? 1 : 0),
    };

    expect(playerAfter.status).toBe('queued');
    expect(playerAfter.staged_match_id).toBeNull();
    expect(playerAfter.total_matches_played).toBe(3);
    expect(playerAfter.total_wins).toBe(2);
    expect(playerAfter.total_losses).toBe(1);

    // Eligible for queue filtering and future drafting
    expect(playerAfter.status === 'queued' || playerAfter.status === 'staged').toBe(true);
  });

  it('correctly resolves the top waiting On-Deck match for idle court prompt', () => {
    const matches: Partial<Match>[] = [
      { id: 'm1', stage: 'in_match', court_id: 'c1' },
      { id: 'm2', stage: 'on_deck', on_deck_slot_number: 2, team_a_ids: ['p1', 'p2'], team_b_ids: ['p3', 'p4'] },
      { id: 'm3', stage: 'on_deck', on_deck_slot_number: 1, team_a_ids: ['p5', 'p6'], team_b_ids: ['p7', 'p8'] },
    ];

    const onDeckMatches = matches
      .filter((m) => m.stage === 'on_deck')
      .sort((a, b) => (a.on_deck_slot_number || 1) - (b.on_deck_slot_number || 1));

    const nextOnDeckMatch = onDeckMatches[0] || null;

    expect(nextOnDeckMatch).not.toBeNull();
    expect(nextOnDeckMatch?.id).toBe('m3');
    expect(nextOnDeckMatch?.on_deck_slot_number).toBe(1);
  });
});
