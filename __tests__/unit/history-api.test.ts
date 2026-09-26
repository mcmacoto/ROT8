import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GET as getHistoryList } from '@/app/api/history/route';
import { GET as getHistorySession } from '@/app/api/history/[sessionId]/route';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

describe('Session History & Audit API Routes', () => {
  const mockSessions = [
    { id: 'sess-1', name: 'Active Session', is_active: true, match_mode: 'doubles', created_at: '2026-01-01T00:00:00Z' },
    { id: 'sess-2', name: 'Ended Session', is_active: false, match_mode: 'singles', created_at: '2026-01-02T00:00:00Z' },
  ];

  const mockCourts = [
    { id: 'court-1', session_id: 'sess-2', court_number: 1, is_active: true },
  ];

  const mockMatches = [
    { id: 'match-1', session_id: 'sess-2', court_id: 'court-1', status: 'completed' },
  ];

  const mockPlayers = [
    { id: 'player-1', session_id: 'sess-2', name: 'Player One', status: 'checked_in' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(createClient).mockImplementation(async () => {
      return {
        from: (table: string) => {
          let filterField: string | null = null;
          let filterValue: any = null;

          const queryBuilder: any = {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((field: string, val: any) => {
              filterField = field;
              filterValue = val;
              return queryBuilder;
            }),
            single: vi.fn().mockImplementation(async () => {
              if (table === 'sessions') {
                const found = mockSessions.find((s) => s.id === filterValue);
                if (found) {
                  return { data: found, error: null };
                }
                return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
              }
              return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
            }),
            then: (resolve: any) => {
              if (table === 'sessions') {
                let result = [...mockSessions];
                if (filterField === 'is_active') {
                  result = result.filter((s) => s.is_active === filterValue);
                }
                resolve({ data: result, error: null });
              } else if (table === 'courts') {
                resolve({ data: mockCourts.filter((c) => c.session_id === filterValue), error: null });
              } else if (table === 'matches') {
                resolve({ data: mockMatches.filter((m) => m.session_id === filterValue), error: null });
              } else if (table === 'players') {
                resolve({ data: mockPlayers.filter((p) => p.session_id === filterValue), error: null });
              } else {
                resolve({ data: [], error: null });
              }
            },
          };

          return queryBuilder;
        },
      } as any;
    });
  });

  it('GET /api/history returns sessions array', async () => {
    const req = new NextRequest('http://localhost:3000/api/history');
    const res = await getHistoryList(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.sessions)).toBe(true);
    expect(body.sessions.length).toBe(2);
  });

  it('GET /api/history?status=completed filters completed sessions', async () => {
    const req = new NextRequest('http://localhost:3000/api/history?status=completed');
    const res = await getHistoryList(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.sessions.length).toBe(1);
    expect(body.sessions[0].id).toBe('sess-2');
  });

  it('GET /api/history/[sessionId] returns 404 for non-existent session', async () => {
    const nonExistentId = 'non-existent-session-id';
    const req = new NextRequest(`http://localhost:3000/api/history/${nonExistentId}`);
    const res = await getHistorySession(req, {
      params: Promise.resolve({ sessionId: nonExistentId }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Session not found');
  });

  it('GET /api/history/[sessionId] returns full audit package for existing session', async () => {
    const req = new NextRequest('http://localhost:3000/api/history/sess-2');
    const res = await getHistorySession(req, {
      params: Promise.resolve({ sessionId: 'sess-2' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.session).toBeDefined();
    expect(data.session.id).toBe('sess-2');
    expect(data.session.name).toBe('Ended Session');
    expect(Array.isArray(data.courts)).toBe(true);
    expect(data.courts.length).toBe(1);
    expect(Array.isArray(data.matches)).toBe(true);
    expect(data.matches.length).toBe(1);
    expect(Array.isArray(data.players)).toBe(true);
    expect(data.players.length).toBe(1);
  });
});
