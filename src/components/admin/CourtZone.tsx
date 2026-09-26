'use client';

import React from 'react';
import { Court, Match, Player } from '@/types/database';
import { PlayerCard } from './PlayerCard';
import { calculateGraceTimer, calculateMatchDuration } from '@/lib/engine/state-machine/grace-timer';
import { useNow } from '@/lib/hooks/useNow';
import { IconPlayerPlay, IconClock, IconAlertTriangle, IconCheck, IconUserX } from '@tabler/icons-react';

interface CourtZoneProps {
  courts: Court[];
  matches: Match[];
  playersMap: Map<string, Player>;
  lockedPairIds: Set<string>;
  hasOnDeckSlots: boolean;
  onTapPlayer: (player: Player, isOnDeck: boolean) => void;
  onStartMatch: (courtId: string, matchId: string) => Promise<void>;
  onCompleteMatch: (courtId: string, matchId: string) => void; // opens score modal or completes
  onNoShow: (courtId: string, matchId: string, playerId: string) => void;
  onDirectDispatch: (courtId: string) => Promise<void>;
  onCallOnDeckToCourt?: (courtId: string, matchId: string) => Promise<void> | void;
}

export function CourtZone({
  courts,
  matches,
  playersMap,
  lockedPairIds,
  hasOnDeckSlots,
  onTapPlayer,
  onStartMatch,
  onCompleteMatch,
  onNoShow,
  onDirectDispatch,
  onCallOnDeckToCourt,
}: CourtZoneProps) {
  const nowMs = useNow();

  const matchMap = new Map<string, Match>();
  for (const m of matches) {
    if (m.court_id) matchMap.set(m.court_id, m);
  }

  const onDeckMatches = matches
    .filter((m) => m.stage === 'on_deck')
    .sort((a, b) => (a.on_deck_slot_number || 1) - (b.on_deck_slot_number || 1));
  const nextOnDeckMatch = onDeckMatches[0] || null;

  return (
    <section style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-umber)' }}>
            Active Courts ({courts.length})
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-umber-muted)' }}>
            Live rotations, grace countdowns, and match stopwatches.
          </p>
        </div>
      </div>

      <div className="responsive-grid-courts">
        {courts.map((court) => {
          const match = court.current_match_id ? matchMap.get(court.id) : null;
          const isSummoning = court.status === 'summoning';
          const isInMatch = court.status === 'in_match';
          const isNeedsAttention = court.status === 'needs_attention';
          const isAvailable = court.status === 'available';

          const teamAPlayers = match ? match.team_a_ids.map((id) => playersMap.get(id)).filter(Boolean) as Player[] : [];
          const teamBPlayers = match ? match.team_b_ids.map((id) => playersMap.get(id)).filter(Boolean) as Player[] : [];

          // Timer math
          const graceState = isSummoning && nowMs ? calculateGraceTimer(match?.summoned_at || null, 90, nowMs) : null;
          const matchDuration = isInMatch && nowMs ? calculateMatchDuration(match?.started_at || null, nowMs) : null;

          return (
            <div
              key={court.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 'var(--radius-md)',
                border: isNeedsAttention
                  ? '2px solid var(--color-alert)'
                  : isInMatch
                  ? '2px solid var(--color-olive)'
                  : isSummoning
                  ? '2px solid var(--color-terracotta)'
                  : '1px solid rgba(62, 47, 35, 0.12)',
                boxShadow: 'var(--shadow-sm)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Card Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-cream-light)',
                  borderBottom: '1px solid rgba(62, 47, 35, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-umber)' }}>
                    COURT {court.court_number}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)' }}>
                    ({court.assigned_match_type})
                  </span>
                </div>

                {/* Status Badge & Timer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isInMatch && (
                    <span className="badge badge-olive" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <IconPlayerPlay size={14} /> {matchDuration?.formattedTime}
                    </span>
                  )}

                  {isSummoning && (
                    <span className="badge badge-terracotta" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <IconClock size={14} /> {graceState?.formattedTime}
                    </span>
                  )}

                  {isNeedsAttention && (
                    <span className="badge badge-alert" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <IconAlertTriangle size={14} /> NEEDS ATTENTION
                    </span>
                  )}

                  {isAvailable && (
                    <span className="badge" style={{ backgroundColor: 'var(--color-cream-dark)', color: 'var(--color-umber-muted)' }}>
                      AVAILABLE
                    </span>
                  )}
                </div>
              </div>

              {/* Card Body: 2x2 Team Grid */}
              <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {match ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '10px', alignItems: 'center' }}>
                      {/* Team A Column */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-olive-dark)', textTransform: 'uppercase' }}>
                          Team A
                        </div>
                        {teamAPlayers.map((player) => (
                          <PlayerCard
                            key={player.id}
                            player={player}
                            isLockedPair={lockedPairIds.has(player.id)}
                            isOnDeck={false}
                            onTap={(p) => onTapPlayer(p, false)}
                          />
                        ))}
                      </div>

                      {/* vs Divider */}
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-umber-subtle)' }}>
                        vs
                      </div>

                      {/* Team B Column */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-olive-dark)', textTransform: 'uppercase' }}>
                          Team B
                        </div>
                        {teamBPlayers.map((player) => (
                          <PlayerCard
                            key={player.id}
                            player={player}
                            isLockedPair={lockedPairIds.has(player.id)}
                            isOnDeck={false}
                            onTap={(p) => onTapPlayer(p, false)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* No-show selector when summoning or needs_attention */}
                    {(isSummoning || isNeedsAttention) && (
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed rgba(62, 47, 35, 0.1)' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-umber-muted)', marginBottom: '4px' }}>
                          Flag absent player:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {[...teamAPlayers, ...teamBPlayers].map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => onNoShow(court.id, match.id, p.id)}
                              style={{
                                fontSize: '0.7rem',
                                padding: '4px 8px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--color-alert-light)',
                                color: 'var(--color-alert-dark)',
                                fontWeight: 600,
                              }}
                            >
                              <IconUserX size={12} /> {p.name.split(' ')[0]} No-Show
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : nextOnDeckMatch ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '18px 14px',
                      backgroundColor: 'rgba(85, 107, 47, 0.04)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px dashed rgba(85, 107, 47, 0.3)',
                    }}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-olive-dark)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        🟢 Court {court.court_number} is Ready
                      </span>
                    </div>
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)', marginBottom: '3px' }}>
                        Waiting On-Deck (Slot #{nextOnDeckMatch.on_deck_slot_number || 1}):
                      </div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-umber)' }}>
                        {nextOnDeckMatch.team_a_ids.map((id) => playersMap.get(id)?.name.split(' ')[0] || 'Unknown').join(' & ')}
                        <span style={{ margin: '0 6px', color: 'var(--color-terracotta)', fontWeight: 800 }}>vs</span>
                        {nextOnDeckMatch.team_b_ids.map((id) => playersMap.get(id)?.name.split(' ')[0] || 'Unknown').join(' & ')}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '260px', margin: '0 auto' }}>
                      {onCallOnDeckToCourt && (
                        <button
                          type="button"
                          onClick={() => onCallOnDeckToCourt(court.id, nextOnDeckMatch.id)}
                          style={{
                            padding: '10px 16px',
                            backgroundColor: 'var(--color-terracotta)',
                            color: '#FFFFFF',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: 'var(--shadow-sm)',
                          }}
                        >
                          <IconPlayerPlay size={16} /> Call On-Deck to Court {court.court_number}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDirectDispatch(court.id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: 'transparent',
                          color: 'var(--color-umber-muted)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Or direct dispatch fresh match
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-umber-muted)' }}>
                    <p style={{ fontSize: '0.9rem', marginBottom: '8px' }}>Court is currently idle</p>
                    <button
                      type="button"
                      onClick={() => onDirectDispatch(court.id)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: hasOnDeckSlots ? 'var(--color-cream-dark)' : 'var(--color-terracotta)',
                        color: hasOnDeckSlots ? 'var(--color-umber)' : '#FFFFFF',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        opacity: hasOnDeckSlots ? 0.7 : 1,
                      }}
                    >
                      Direct Dispatch Match
                    </button>
                  </div>
                )}
              </div>

              {/* Card Actions Footer */}
              {match && (
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: 'var(--color-cream-light)',
                    borderTop: '1px solid rgba(62, 47, 35, 0.08)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '8px',
                  }}
                >
                  {(isSummoning || isNeedsAttention) && (
                    <button
                      type="button"
                      onClick={() => onStartMatch(court.id, match.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        backgroundColor: 'var(--color-olive)',
                        color: '#FFFFFF',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                      }}
                    >
                      <IconPlayerPlay size={16} /> Start Match
                    </button>
                  )}

                  {isInMatch && (
                    <button
                      type="button"
                      onClick={() => onCompleteMatch(court.id, match.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        backgroundColor: 'var(--color-terracotta)',
                        color: '#FFFFFF',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                      }}
                    >
                      <IconCheck size={16} /> Complete Match
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
