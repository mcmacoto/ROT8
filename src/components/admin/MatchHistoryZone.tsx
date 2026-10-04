'use client';

import React, { useState } from 'react';
import { Court, Match, Player } from '@/types/database';
import { formatRating } from '@/lib/utils/rating-labels';
import {
  IconHistory,
  IconChevronDown,
  IconChevronUp,
  IconPencil,
  IconCheck,
  IconX,
  IconTrophy,
  IconAlertTriangle,
  IconSearch,
  IconClock,
  IconPlus,
  IconMinus,
} from '@tabler/icons-react';

interface MatchHistoryZoneProps {
  sessionId: string;
  completedMatches: Match[];
  courts: Court[];
  playersMap: Map<string, Player>;
  scoringRequired: boolean;
  onCorrectionApplied: () => Promise<void> | void;
}

export function MatchHistoryZone({
  sessionId,
  completedMatches,
  courts,
  playersMap,
  scoringRequired,
  onCorrectionApplied,
}: MatchHistoryZoneProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCourtId, setSelectedCourtId] = useState<string>('all');
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [displayCount, setDisplayCount] = useState<number>(15);

  const courtsMap = new Map<string, Court>(courts.map((c) => [c.id, c]));

  // Sort matches by completed_at desc (most recent first)
  const sortedMatches = [...completedMatches].sort((a, b) => {
    const timeA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const timeB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    return timeB - timeA;
  });

  // Filter matches by court and search query
  const filteredMatches = sortedMatches.filter((m) => {
    if (selectedCourtId !== 'all' && m.court_id !== selectedCourtId) {
      return false;
    }
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    const teamANames = m.team_a_ids
      .map((id) => playersMap.get(id)?.name || '')
      .join(' ')
      .toLowerCase();
    const teamBNames = m.team_b_ids
      .map((id) => playersMap.get(id)?.name || '')
      .join(' ')
      .toLowerCase();

    return teamANames.includes(q) || teamBNames.includes(q);
  });

  const visibleMatches = filteredMatches.slice(0, displayCount);

  return (
    <section style={{ marginBottom: '32px' }}>
      {/* Zone Header with Collapsible Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-cream-light)',
              color: 'var(--color-terracotta)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(62, 47, 35, 0.1)',
            }}
          >
            <IconHistory size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-umber)', margin: 0 }}>
                Match History &amp; Results
              </h2>
              <span className="badge badge-olive" style={{ fontSize: '0.75rem' }}>
                {completedMatches.length} COMPLETED
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-umber-muted)', margin: 0 }}>
              Audit past matches, view scores and Elo deltas, and correct mis-recorded results.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            backgroundColor: 'var(--color-cream-light)',
            color: 'var(--color-umber)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(62, 47, 35, 0.12)',
            fontSize: '0.825rem',
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: '38px',
          }}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? (
            <>
              <span>Show Matches</span>
              <IconChevronDown size={16} />
            </>
          ) : (
            <>
              <span>Collapse</span>
              <IconChevronUp size={16} />
            </>
          )}
        </button>
      </div>

      {!isCollapsed && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(62, 47, 35, 0.12)',
            padding: '16px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Filter & Search Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '16px',
              paddingBottom: '14px',
              borderBottom: '1px solid rgba(62, 47, 35, 0.08)',
            }}
          >
            {/* Search Input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--color-cream-light)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(62, 47, 35, 0.15)',
                flex: '1 1 220px',
                maxWidth: '400px',
              }}
            >
              <IconSearch size={16} style={{ color: 'var(--color-umber-muted)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search by player name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  width: '100%',
                  fontSize: '0.85rem',
                  color: 'var(--color-umber)',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-umber-muted)',
                    padding: '2px',
                    display: 'flex',
                  }}
                >
                  <IconX size={14} />
                </button>
              )}
            </div>

            {/* Court Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-umber-muted)' }}>
                Court:
              </span>
              <select
                value={selectedCourtId}
                onChange={(e) => setSelectedCourtId(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(62, 47, 35, 0.15)',
                  backgroundColor: 'var(--color-cream-light)',
                  color: 'var(--color-umber)',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: '36px',
                }}
              >
                <option value="all">All Courts ({completedMatches.length})</option>
                {courts.map((c) => {
                  const courtMatchCount = completedMatches.filter((m) => m.court_id === c.id).length;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name || `Court ${c.court_number}`} ({courtMatchCount})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Matches List */}
          {filteredMatches.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '36px 16px',
                color: 'var(--color-umber-muted)',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-cream-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px',
                  color: 'var(--color-umber-subtle)',
                }}
              >
                <IconHistory size={22} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-umber)' }}>
                {completedMatches.length === 0 ? 'No completed matches yet' : 'No matches match your filter'}
              </div>
              <p style={{ fontSize: '0.8rem', marginTop: '4px', maxWidth: '360px', margin: '4px auto 0' }}>
                {completedMatches.length === 0
                  ? 'Matches will appear here as soon as courts complete their play.'
                  : 'Try changing your court filter or search query.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {visibleMatches.map((m) => {
                const court = m.court_id ? courtsMap.get(m.court_id) : null;
                const teamAPlayers = m.team_a_ids
                  .map((id) => playersMap.get(id))
                  .filter(Boolean) as Player[];
                const teamBPlayers = m.team_b_ids
                  .map((id) => playersMap.get(id))
                  .filter(Boolean) as Player[];

                // Determine winner
                let teamAWon = true;
                if (m.forfeited_by === 'A') {
                  teamAWon = false;
                } else if (m.forfeited_by === 'B') {
                  teamAWon = true;
                } else if (m.score_a !== null && m.score_b !== null) {
                  teamAWon = m.score_a > m.score_b;
                } else if (m.elo_delta_team_a !== null && m.elo_delta_team_a !== undefined) {
                  teamAWon = m.elo_delta_team_a > 0;
                }

                const durationMins = m.match_duration_seconds
                  ? Math.round(m.match_duration_seconds / 60)
                  : null;

                const completedTimeStr = m.completed_at
                  ? new Date(m.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : null;

                return (
                  <div
                    key={m.id}
                    className="match-history-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {/* Card Top: Court, Time, Duration & Status */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                        borderBottom: '1px solid rgba(62, 47, 35, 0.06)',
                        paddingBottom: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                          className="badge badge-terracotta"
                          style={{ fontSize: '0.75rem', fontWeight: 700 }}
                        >
                          {court ? (court.name || `COURT ${court.court_number}`) : 'COURT'}
                        </span>

                        {completedTimeStr && (
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.75rem',
                              color: 'var(--color-umber-muted)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            <IconClock size={12} /> {completedTimeStr}
                          </span>
                        )}

                        {durationMins !== null && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-umber-subtle)' }}>
                            • {durationMins} min{durationMins === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {m.forfeited_by ? (
                          <span className="badge badge-alert" style={{ fontSize: '0.7rem' }}>
                            FORFEIT (Team {m.forfeited_by})
                          </span>
                        ) : (
                          <span className="badge badge-olive" style={{ fontSize: '0.7rem' }}>
                            <IconCheck size={11} /> FINAL
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => setEditingMatch(m)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            backgroundColor: 'var(--color-cream-light)',
                            border: '1px solid rgba(62, 47, 35, 0.15)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--color-umber)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          title="Correct score or outcome"
                        >
                          <IconPencil size={12} style={{ color: 'var(--color-terracotta)' }} />
                          <span>Correct Result</span>
                        </button>
                      </div>
                    </div>

                    {/* Card Middle: Match Teams & Score */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      {/* Team A */}
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: teamAWon ? 'var(--color-olive-light)' : 'var(--color-cream-light)',
                          border: teamAWon
                            ? '1px solid rgba(138, 154, 91, 0.35)'
                            : '1px solid rgba(62, 47, 35, 0.08)',
                          position: 'relative',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '4px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              color: teamAWon ? 'var(--color-olive-dark)' : 'var(--color-umber-muted)',
                              letterSpacing: '0.04em',
                            }}
                          >
                            TEAM A
                          </span>
                          {teamAWon && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                color: 'var(--color-olive-dark)',
                                textTransform: 'uppercase',
                              }}
                            >
                              <IconTrophy size={11} /> WIN
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-umber)' }}>
                          {teamAPlayers.map((p, idx) => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{p.name}</span>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  color: 'var(--color-umber-muted)',
                                  fontWeight: 500,
                                }}
                              >
                                ({p.current_elo || formatRating(p.static_rating)})
                              </span>
                            </div>
                          ))}
                        </div>
                        {m.elo_delta_team_a !== null && m.elo_delta_team_a !== undefined && (
                          <div
                            style={{
                              marginTop: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              color: m.elo_delta_team_a >= 0 ? 'var(--color-olive-dark)' : 'var(--color-alert-dark)',
                            }}
                          >
                            {m.elo_delta_team_a >= 0 ? `+${m.elo_delta_team_a}` : m.elo_delta_team_a} Elo
                          </div>
                        )}
                      </div>

                      {/* Center Score Display */}
                      <div
                        style={{
                          textAlign: 'center',
                          padding: '6px 12px',
                        }}
                      >
                        {m.score_a !== null && m.score_b !== null ? (
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '1.4rem',
                              fontWeight: 900,
                              color: 'var(--color-umber)',
                              letterSpacing: '0.05em',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {m.score_a} <span style={{ color: 'var(--color-umber-subtle)', fontWeight: 400 }}>—</span> {m.score_b}
                          </div>
                        ) : (
                          <div
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              color: 'var(--color-umber-muted)',
                              textTransform: 'uppercase',
                            }}
                          >
                            {teamAWon ? 'Team A Won' : 'Team B Won'}
                          </div>
                        )}
                      </div>

                      {/* Team B */}
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: !teamAWon ? 'var(--color-olive-light)' : 'var(--color-cream-light)',
                          border: !teamAWon
                            ? '1px solid rgba(138, 154, 91, 0.35)'
                            : '1px solid rgba(62, 47, 35, 0.08)',
                          position: 'relative',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '4px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              color: !teamAWon ? 'var(--color-olive-dark)' : 'var(--color-umber-muted)',
                              letterSpacing: '0.04em',
                            }}
                          >
                            TEAM B
                          </span>
                          {!teamAWon && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                color: 'var(--color-olive-dark)',
                                textTransform: 'uppercase',
                              }}
                            >
                              <IconTrophy size={11} /> WIN
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-umber)' }}>
                          {teamBPlayers.map((p, idx) => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{p.name}</span>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  color: 'var(--color-umber-muted)',
                                  fontWeight: 500,
                                }}
                              >
                                ({p.current_elo || formatRating(p.static_rating)})
                              </span>
                            </div>
                          ))}
                        </div>
                        {m.elo_delta_team_b !== null && m.elo_delta_team_b !== undefined && (
                          <div
                            style={{
                              marginTop: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              color: m.elo_delta_team_b >= 0 ? 'var(--color-olive-dark)' : 'var(--color-alert-dark)',
                            }}
                          >
                            {m.elo_delta_team_b >= 0 ? `+${m.elo_delta_team_b}` : m.elo_delta_team_b} Elo
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredMatches.length > displayCount && (
                <div style={{ textAlign: 'center', paddingTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setDisplayCount((prev) => prev + 15)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-cream-light)',
                      border: '1px solid rgba(62, 47, 35, 0.15)',
                      color: 'var(--color-umber)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>Load More Matches</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)', fontWeight: 500 }}>
                      ({filteredMatches.length - displayCount} remaining)
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Result Correction Modal Dialog */}
      {editingMatch && (
        <ResultCorrectionModal
          match={editingMatch}
          sessionId={sessionId}
          court={editingMatch.court_id ? courtsMap.get(editingMatch.court_id) || null : null}
          playersMap={playersMap}
          scoringRequired={scoringRequired}
          onClose={() => setEditingMatch(null)}
          onSuccess={async () => {
            setEditingMatch(null);
            await onCorrectionApplied();
          }}
        />
      )}
    </section>
  );
}

interface ResultCorrectionModalProps {
  match: Match;
  sessionId: string;
  court: Court | null;
  playersMap: Map<string, Player>;
  scoringRequired: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

function ResultCorrectionModal({
  match,
  sessionId,
  court,
  playersMap,
  scoringRequired,
  onClose,
  onSuccess,
}: ResultCorrectionModalProps) {
  const teamAPlayers = match.team_a_ids.map((id) => playersMap.get(id)).filter(Boolean) as Player[];
  const teamBPlayers = match.team_b_ids.map((id) => playersMap.get(id)).filter(Boolean) as Player[];

  // Determine initial state from match
  const initialWinner: 'A' | 'B' =
    match.forfeited_by === 'A'
      ? 'B'
      : match.forfeited_by === 'B'
      ? 'A'
      : match.score_a !== null && match.score_b !== null
      ? match.score_a > match.score_b
        ? 'A'
        : 'B'
      : match.elo_delta_team_a && match.elo_delta_team_a > 0
      ? 'A'
      : 'B';

  const [scoreA, setScoreA] = useState<number>(match.score_a ?? 11);
  const [scoreB, setScoreB] = useState<number>(match.score_b ?? 9);
  const [winningTeam, setWinningTeam] = useState<'A' | 'B'>(initialWinner);
  const [forfeitedBy, setForfeitedBy] = useState<'none' | 'A' | 'B'>(match.forfeited_by || 'none');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Score Steppers
  const handleScoreChange = (team: 'A' | 'B', delta: number) => {
    if (team === 'A') {
      const nextA = Math.max(0, scoreA + delta);
      setScoreA(nextA);
      if (forfeitedBy === 'none') {
        if (nextA > scoreB) setWinningTeam('A');
        else if (scoreB > nextA) setWinningTeam('B');
      }
    } else {
      const nextB = Math.max(0, scoreB + delta);
      setScoreB(nextB);
      if (forfeitedBy === 'none') {
        if (nextB > scoreA) setWinningTeam('B');
        else if (scoreA > nextB) setWinningTeam('A');
      }
    }
  };

  const handleSelectWinner = (team: 'A' | 'B') => {
    setWinningTeam(team);
    if (forfeitedBy !== 'none') {
      setForfeitedBy('none'); // Selecting winner overrides forfeit
    }
    if (scoringRequired) {
      if (team === 'A' && scoreA <= scoreB) {
        setScoreA(Math.max(11, scoreB + 1));
      } else if (team === 'B' && scoreB <= scoreA) {
        setScoreB(Math.max(11, scoreA + 1));
      }
    }
  };

  const handleForfeitChange = (val: 'none' | 'A' | 'B') => {
    setForfeitedBy(val);
    if (val === 'A') {
      setWinningTeam('B');
    } else if (val === 'B') {
      setWinningTeam('A');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);

      const res = await fetch(`/api/admin/${sessionId}/matches/correct`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: match.id,
          scoreA: scoringRequired ? scoreA : null,
          scoreB: scoringRequired ? scoreB : null,
          winningTeam,
          forfeitedByTeam: forfeitedBy === 'none' ? null : forfeitedBy,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to correct match result');
      }

      await onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Correction failed';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(62, 47, 35, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        backdropFilter: 'blur(4px)',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '500px',
          maxHeight: '90vh',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid rgba(62, 47, 35, 0.12)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(62, 47, 35, 0.08)',
            backgroundColor: 'var(--color-cream-light)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--color-terracotta)' }}>
              <IconPencil size={20} />
            </span>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-umber)', margin: 0 }}>
                Correct Match Result
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)' }}>
                {court ? `Court ${court.court_number} • ` : ''} Match ID: {match.id.slice(0, 8)}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-umber-muted)',
              padding: '6px',
              minHeight: '36px',
              minWidth: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', overflowY: 'auto' }}>
          {/* Important Cascading Reversal Alert */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              backgroundColor: 'var(--color-terracotta-light)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(195, 111, 66, 0.25)',
              marginBottom: '16px',
            }}
          >
            <IconAlertTriangle size={20} style={{ color: 'var(--color-terracotta-dark)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.8rem', color: 'var(--color-terracotta-dark)', lineHeight: 1.4 }}>
              <strong>Automatic Stat &amp; Elo Reversal:</strong> Updating this match will automatically undo the previously recorded wins, losses, point differential, and Elo changes for both teams, then recalculate them using your corrected values.
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: 'var(--color-alert-light)',
                color: 'var(--color-alert-dark)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.825rem',
                fontWeight: 600,
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          {/* Winner Selector Cards */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-umber)', marginBottom: '8px' }}>
              Select Correct Winner:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {/* Team A */}
              <div
                onClick={() => handleSelectWinner('A')}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: winningTeam === 'A' ? '2px solid var(--color-olive)' : '1px solid rgba(62, 47, 35, 0.15)',
                  backgroundColor: winningTeam === 'A' ? 'var(--color-olive-light)' : '#FFFFFF',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                  minHeight: '70px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: winningTeam === 'A' ? 'var(--color-olive-dark)' : 'var(--color-umber-muted)' }}>
                    TEAM A
                  </span>
                  {winningTeam === 'A' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-olive-dark)' }}>
                      <IconCheck size={12} /> WINNER
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-umber)', marginTop: '4px' }}>
                  {teamAPlayers.map((p) => p.name).join(' & ')}
                </div>
              </div>

              {/* Team B */}
              <div
                onClick={() => handleSelectWinner('B')}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: winningTeam === 'B' ? '2px solid var(--color-olive)' : '1px solid rgba(62, 47, 35, 0.15)',
                  backgroundColor: winningTeam === 'B' ? 'var(--color-olive-light)' : '#FFFFFF',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                  minHeight: '70px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: winningTeam === 'B' ? 'var(--color-olive-dark)' : 'var(--color-umber-muted)' }}>
                    TEAM B
                  </span>
                  {winningTeam === 'B' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-olive-dark)' }}>
                      <IconCheck size={12} /> WINNER
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-umber)', marginTop: '4px' }}>
                  {teamBPlayers.map((p) => p.name).join(' & ')}
                </div>
              </div>
            </div>
          </div>

          {/* Scores Adjustment (with +/- steppers) */}
          {scoringRequired && (
            <div
              style={{
                padding: '16px',
                backgroundColor: 'var(--color-cream-light)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(62, 47, 35, 0.1)',
                marginBottom: '16px',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-umber)', marginBottom: '12px', textAlign: 'center' }}>
                Correct Match Scores
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                {/* Team A Stepper */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)', marginBottom: '6px', fontWeight: 600 }}>
                    Team A
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleScoreChange('A', -1)}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid rgba(62, 47, 35, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--color-umber)',
                      }}
                    >
                      <IconMinus size={16} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={scoreA}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) setScoreA(Math.max(0, val));
                      }}
                      style={{
                        width: '64px',
                        height: '44px',
                        fontSize: '1.4rem',
                        fontWeight: 800,
                        textAlign: 'center',
                        borderRadius: 'var(--radius-sm)',
                        border: winningTeam === 'A' ? '2px solid var(--color-olive)' : '1px solid rgba(62, 47, 35, 0.2)',
                        backgroundColor: '#FFFFFF',
                        fontFamily: 'var(--font-mono)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleScoreChange('A', 1)}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid rgba(62, 47, 35, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--color-umber)',
                      }}
                    >
                      <IconPlus size={16} />
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-umber-subtle)', marginTop: '20px' }}>
                  —
                </div>

                {/* Team B Stepper */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)', marginBottom: '6px', fontWeight: 600 }}>
                    Team B
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleScoreChange('B', -1)}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid rgba(62, 47, 35, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--color-umber)',
                      }}
                    >
                      <IconMinus size={16} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={scoreB}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) setScoreB(Math.max(0, val));
                      }}
                      style={{
                        width: '64px',
                        height: '44px',
                        fontSize: '1.4rem',
                        fontWeight: 800,
                        textAlign: 'center',
                        borderRadius: 'var(--radius-sm)',
                        border: winningTeam === 'B' ? '2px solid var(--color-olive)' : '1px solid rgba(62, 47, 35, 0.2)',
                        backgroundColor: '#FFFFFF',
                        fontFamily: 'var(--font-mono)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleScoreChange('B', 1)}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid rgba(62, 47, 35, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--color-umber)',
                      }}
                    >
                      <IconPlus size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Forfeit State Dropdown / Selector */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-umber)', marginBottom: '6px' }}>
              Forfeit / Retirement Status:
            </label>
            <select
              value={forfeitedBy}
              onChange={(e) => handleForfeitChange(e.target.value as 'none' | 'A' | 'B')}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(62, 47, 35, 0.15)',
                backgroundColor: '#FFFFFF',
                fontSize: '0.85rem',
                color: 'var(--color-umber)',
                fontWeight: 600,
              }}
            >
              <option value="none">Normal Completion (No Forfeit)</option>
              <option value="A">Team A Forfeited (Team B Awarded Win)</option>
              <option value="B">Team B Forfeited (Team A Awarded Win)</option>
            </select>
          </div>

          {/* Diff Summary Box */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-cream-light)',
              border: '1px solid rgba(62, 47, 35, 0.08)',
              marginBottom: '20px',
              fontSize: '0.8rem',
            }}
          >
            <div style={{ color: 'var(--color-umber-muted)', marginBottom: '4px' }}>
              <strong>Correction Summary:</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--color-umber-muted)' }}>
                Originally: {match.score_a !== null && match.score_b !== null ? `${match.score_a} - ${match.score_b}` : 'Unscored'} (
                {initialWinner === 'A' ? 'Team A won' : 'Team B won'}
                {match.forfeited_by ? `, Forfeit by Team ${match.forfeited_by}` : ''})
              </span>
              <span>➔</span>
              <strong style={{ color: 'var(--color-olive-dark)' }}>
                New: {scoringRequired ? `${scoreA} - ${scoreB}` : 'Unscored'} (
                {winningTeam === 'A' ? 'Team A wins' : 'Team B wins'}
                {forfeitedBy !== 'none' ? `, Forfeit by Team ${forfeitedBy}` : ''})
              </strong>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '10px 18px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-cream-dark)',
                color: 'var(--color-umber)',
                fontWeight: 600,
                fontSize: '0.875rem',
                border: 'none',
                cursor: 'pointer',
                minHeight: '44px',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '10px 22px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-terracotta)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.875rem',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                minHeight: '44px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <IconCheck size={18} />
              {isSubmitting ? 'Applying Reversal & Saving...' : 'Apply Correction & Recalculate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
