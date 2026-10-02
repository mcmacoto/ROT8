import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH as correctMatchResult } from '@/app/api/admin/[sessionId]/matches/correct/route';
import { createClient } from '@/lib/supabase/server';
import { verifyHostAuthorization } from '@/lib/auth/require-host-auth';
import { calculateEloUpdates } from '@/lib/engine/matchmaking/elo-rated';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/auth/require-host-auth', () => ({
  verifyHostAuthorization: vi.fn(),
}));

describe('Match Result Correction API & Reversal Math', () => {
  const mockSessionId = 'sess-100';

  const mockSession = {
    id: mockSessionId,
    name: 'Correction Test Session',
    scoring_required: true,
  };

  const mockMatch = {
    id: 'match-1',
    session_id: mockSessionId,
    court_id: 'court-1',
    stage: 'completed',
    team_a_ids: ['p1', 'p2'],
    team_b_ids: ['p3', 'p4'],
    score_a: 11,
    score_b: 7,
    forfeited_by: null,
    elo_delta_team_a: 16,
    elo_delta_team_b: -16,
  };

  // Players in post-match state (reflecting the 11-7 Team A win)
  const mockTeamAPlayers = [
    {
      id: 'p1',
      name: 'Alice',
      current_elo: 1216, // 1200 + 16
      total_matches_played: 1,
      total_wins: 1,
      total_losses: 0,
      point_differential: 4, // 11 - 7
    },
    {
      id: 'p2',
      name: 'Bob',
      current_elo: 1216,
      total_matches_played: 1,
      total_wins: 1,
      total_losses: 0,
      point_differential: 4,
    },
  ];

  const mockTeamBPlayers = [
    {
      id: 'p3',
      name: 'Charlie',
      current_elo: 1184, // 1200 - 16
      total_matches_played: 1,
      total_wins: 0,
      total_losses: 1,
      point_differential: -4, // 7 - 11
    },
    {
      id: 'p4',
      name: 'David',
      current_elo: 1184,
      total_matches_played: 1,
      total_wins: 0,
      total_losses: 1,
      point_differential: -4,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthorized requests with 401', async () => {
    vi.mocked(verifyHostAuthorization).mockResolvedValue(false);

    const req = new NextRequest('http://localhost:3000/api/admin/sess-100/matches/correct', {
      method: 'PATCH',
      body: JSON.stringify({ matchId: 'match-1', scoreA: 9, scoreB: 11, winningTeam: 'B' }),
    });

    const res = await correctMatchResult(req, {
      params: Promise.resolve({ sessionId: mockSessionId }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized host');
  });

  it('rejects requests missing matchId with 400', async () => {
    vi.mocked(verifyHostAuthorization).mockResolvedValue(true);

    const req = new NextRequest('http://localhost:3000/api/admin/sess-100/matches/correct', {
      method: 'PATCH',
      body: JSON.stringify({ scoreA: 9, scoreB: 11 }),
    });

    const res = await correctMatchResult(req, {
      params: Promise.resolve({ sessionId: mockSessionId }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('matchId is required');
  });

  it('corrects match result and reverses previous player wins, losses, point diff and Elo', async () => {
    vi.mocked(verifyHostAuthorization).mockResolvedValue(true);

    const updatedPlayersMap = new Map<string, any>();
    let updatedMatchData: any = null;

    vi.mocked(createClient).mockResolvedValue({
      from: (table: string) => {
        let filterField: string | null = null;
        let filterValue: any = null;

        const builder: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation((f: string, v: any) => {
            filterField = f;
            filterValue = v;
            return builder;
          }),
          in: vi.fn().mockImplementation((f: string, ids: string[]) => {
            if (table === 'players') {
              const all = [...mockTeamAPlayers, ...mockTeamBPlayers];
              const found = all.filter((p) => ids.includes(p.id));
              return Promise.resolve({ data: found, error: null });
            }
            return Promise.resolve({ data: [], error: null });
          }),
          update: vi.fn().mockImplementation((updates: any) => {
            return {
              eq: vi.fn().mockImplementation((f: string, v: any) => {
                if (table === 'players') {
                  updatedPlayersMap.set(v, updates);
                } else if (table === 'matches') {
                  updatedMatchData = updates;
                }
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: { ...mockMatch, ...updates }, error: null }),
                  }),
                };
              }),
            };
          }),
          single: vi.fn().mockImplementation(async () => {
            if (table === 'matches') {
              return { data: mockMatch, error: null };
            }
            if (table === 'sessions') {
              return { data: mockSession, error: null };
            }
            return { data: null, error: { message: 'Not found' } };
          }),
        };
        return builder;
      },
    } as any);

    // Correct result: Team B actually won 11-9 (Team A got 9, Team B got 11)
    const req = new NextRequest('http://localhost:3000/api/admin/sess-100/matches/correct', {
      method: 'PATCH',
      body: JSON.stringify({
        matchId: 'match-1',
        scoreA: 9,
        scoreB: 11,
        winningTeam: 'B',
      }),
    });

    const res = await correctMatchResult(req, {
      params: Promise.resolve({ sessionId: mockSessionId }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.winner).toBe('B');

    // Verify Team A players were updated:
    // Base Elo was 1216 - 16 = 1200. With loss, their Elo decreases from 1200.
    const p1Update = updatedPlayersMap.get('p1');
    expect(p1Update).toBeDefined();
    expect(p1Update.total_wins).toBe(0); // Inverted from 1 to 0
    expect(p1Update.total_losses).toBe(1); // Inverted from 0 to 1
    expect(p1Update.point_differential).toBe(-2); // 9 - 11

    // Verify Team B players were updated:
    // Base Elo was 1184 - (-16) = 1200. With win, their Elo increases from 1200.
    const p3Update = updatedPlayersMap.get('p3');
    expect(p3Update).toBeDefined();
    expect(p3Update.total_wins).toBe(1); // Inverted from 0 to 1
    expect(p3Update.total_losses).toBe(0); // Inverted from 1 to 0
    expect(p3Update.point_differential).toBe(2); // 11 - 9

    // Verify Match was updated
    expect(updatedMatchData).toBeDefined();
    expect(updatedMatchData.score_a).toBe(9);
    expect(updatedMatchData.score_b).toBe(11);
  });
});
