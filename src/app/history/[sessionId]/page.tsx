'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Court, Match, Player, Session } from '@/types/database';
import { computeLeaderboard } from '@/lib/engine/leaderboard';
import { generateMatchesCSV } from '@/lib/export/csv';
import { formatRating } from '@/lib/utils/rating-labels';
import { createClient } from '@/lib/supabase/client';
import {
  IconArrowLeft,
  IconDownload,
  IconTrophy,
  IconChartBar,
  IconAlertCircle,
  IconCheck,
  IconLoader2,
} from '@tabler/icons-react';

export default function SessionAuditDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);

  const [session, setSession] = useState<Session | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAudit = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/history/${sessionId}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Session audit not found (HTTP ${res.status})`);
      }

      const data = await res.json();
      if (data.session) setSession(data.session);
      if (data.courts) setCourts(data.courts);
      if (data.matches) setMatches(data.matches);
      if (data.players) setPlayers(data.players);
    } catch (err: unknown) {
      console.error('Failed to load session audit', err);
      const msg = err instanceof Error ? err.message : 'Failed to load session audit';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--color-cream)',
          gap: '12px',
        }}
      >
        <IconLoader2 size={32} className="animate-spin" style={{ color: 'var(--color-terracotta)' }} />
        <p style={{ fontWeight: 700, color: 'var(--color-umber)' }}>Loading Session Audit...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--color-cream)',
          padding: '24px',
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--radius-lg)',
            padding: '36px 32px',
            maxWidth: '460px',
            width: '100%',
            textAlign: 'center',
            boxShadow: 'var(--shadow-md)',
            border: '1px solid rgba(62, 47, 35, 0.12)',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'rgba(217, 83, 79, 0.1)',
              color: '#D9534F',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <IconAlertCircle size={28} />
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-umber)', marginBottom: '8px' }}>
            Session Audit Unavailable
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-umber-muted)', marginBottom: '24px', lineHeight: 1.5 }}>
            {error || 'The requested session could not be found or has not generated an audit archive yet.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link
              href="/history"
              style={{
                padding: '10px 18px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-cream-light)',
                color: 'var(--color-umber)',
                fontWeight: 600,
                fontSize: '0.875rem',
                textDecoration: 'none',
                border: '1px solid rgba(62, 47, 35, 0.1)',
              }}
            >
              Back to Archive
            </Link>
            <button
              type="button"
              onClick={loadAudit}
              style={{
                padding: '10px 18px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-terracotta)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.875rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const playersMap = new Map<string, Player>(players.map((p) => [p.id, p]));
  const completedMatches = matches.filter((m) => m.stage === 'completed');

  // Compute final leaderboard with strict tie-breaking
  const leaderboard = computeLeaderboard(
    players,
    matches,
    session.match_mode,
    session.scoring_required
  );

  // Court Utilization Audit Math: total active match duration vs session duration
  const courtUtilization = courts.map((court) => {
    const courtMatches = completedMatches.filter((m) => m.court_id === court.id);
    const activeSeconds = courtMatches.reduce((acc, m) => acc + (m.match_duration_seconds || 0), 0);
    const activeMinutes = Math.round(activeSeconds / 60);

    return {
      courtNumber: court.court_number,
      name: court.name,
      matchCount: courtMatches.length,
      activeMinutes,
      activeSeconds,
    };
  });

  // Handle CSV Download
  const handleDownloadCSV = () => {
    const courtsMap = new Map<string, Court>(courts.map((c) => [c.id, c]));
    const csvContent = generateMatchesCSV(completedMatches, playersMap, courtsMap);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rot8_session_${session.name.replace(/\s+/g, '_')}_matches.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-cream)', color: 'var(--color-umber)' }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid rgba(62, 47, 35, 0.12)',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link
            href="/history"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--color-umber)',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            <IconArrowLeft size={18} /> Archive
          </Link>
          <span style={{ color: 'var(--color-umber-muted)' }}>|</span>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Audit: {session.name}</h1>
        </div>

        <button
          type="button"
          onClick={handleDownloadCSV}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            backgroundColor: 'var(--color-terracotta)',
            color: '#FFFFFF',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 700,
            fontSize: '0.85rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <IconDownload size={16} /> Export Match Logs (CSV)
        </button>
      </header>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 20px 80px' }}>
        {/* Court Utilization Audit Section */}
        <section
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid rgba(62, 47, 35, 0.12)',
            marginBottom: '32px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <IconChartBar size={22} color="var(--color-olive-dark)" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-umber)' }}>
              Court Utilization Audit
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
            }}
          >
            {courtUtilization.map((cu) => (
              <div
                key={cu.courtNumber}
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--color-cream-light)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(62, 47, 35, 0.08)',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-olive-dark)' }}>
                  COURT {cu.courtNumber}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--color-umber)', margin: '4px 0' }}>
                  {cu.activeMinutes} mins
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-umber-muted)' }}>
                  {cu.matchCount} completed matches ({cu.activeSeconds}s total)
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Final Standings Leaderboard */}
        <section
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid rgba(62, 47, 35, 0.12)',
            marginBottom: '32px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconTrophy size={22} color="var(--color-terracotta)" />
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-umber)' }}>
                Final Standings Leaderboard
              </h2>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-umber-muted)', fontStyle: 'italic' }}>
              Strict Hierarchical Tie-Breakers Applied
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(62, 47, 35, 0.1)', textAlign: 'left', color: 'var(--color-umber-muted)' }}>
                  <th style={{ padding: '10px 8px' }}>Rank</th>
                  <th style={{ padding: '10px 8px' }}>Player</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Elo / Rating</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Matches</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Record (W - L)</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Win %</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Diff (±)</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>SOS</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr key={entry.player.id} style={{ borderBottom: '1px solid rgba(62, 47, 35, 0.08)' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--color-terracotta)' }}>
                      #{entry.rank}
                    </td>
                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>{entry.player.name}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                      {session.match_mode === 'elo_rated'
                        ? entry.player.current_elo
                        : formatRating(entry.player.static_rating)}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>{entry.player.total_matches_played}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      {entry.player.total_wins} - {entry.player.total_losses}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      {(entry.winRate * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700 }}>
                      {entry.player.point_differential > 0 ? `+${entry.player.point_differential}` : entry.player.point_differential}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--color-umber-muted)' }}>
                      ★ {entry.strengthOfSchedule.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Completed Match Logs */}
        <section
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid rgba(62, 47, 35, 0.12)',
          }}
        >
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-umber)', marginBottom: '6px' }}>
            Completed Match Logs ({completedMatches.length})
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-umber-muted)', marginBottom: '16px' }}>
            Historical match records. Forfeits reflect live departure score.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {completedMatches.map((m) => {
              const teamANames = m.team_a_ids.map((id) => playersMap.get(id)?.name || 'Unknown').join(' & ');
              const teamBNames = m.team_b_ids.map((id) => playersMap.get(id)?.name || 'Unknown').join(' & ');

              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    padding: '12px 16px',
                    backgroundColor: 'var(--color-cream-light)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(62, 47, 35, 0.08)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {m.forfeited_by ? (
                      <span className="badge badge-alert" style={{ fontSize: '0.75rem' }}>
                        FORFEIT (Team {m.forfeited_by})
                      </span>
                    ) : (
                      <span className="badge badge-olive" style={{ fontSize: '0.75rem' }}>
                        <IconCheck size={12} /> FINAL
                      </span>
                    )}

                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                      {teamANames} <span style={{ color: 'var(--color-umber-muted)' }}>vs</span> {teamBNames}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {m.score_a !== null && m.score_b !== null && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1rem', color: 'var(--color-umber)' }}>
                        {m.score_a} - {m.score_b}
                      </span>
                    )}
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-umber-muted)' }}>
                      {Math.round((m.match_duration_seconds || 0) / 60)} mins
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Module 7 Section 4 Footnote on Non-Logging Policy */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(62, 47, 35, 0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconAlertCircle size={16} color="var(--color-umber-muted)" />
            <p style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)' }}>
              Rosters reflect final player composition at match completion due to host edit/substitution policy. Forfeited matches display real score entered by host at departure.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
