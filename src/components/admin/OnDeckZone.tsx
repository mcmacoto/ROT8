'use client';

import React from 'react';
import { Match, Player } from '@/types/database';
import { PlayerCard } from './PlayerCard';
import { StalledSlot } from '@/lib/engine/on-deck';
import { IconRefresh, IconArrowUpRight, IconAlertTriangle } from '@tabler/icons-react';

interface OnDeckZoneProps {
  slots: (Match | null)[];
  stalledSlots: Map<number, StalledSlot>;
  onDeckCap: number;
  capFormula: string;
  playersMap: Map<string, Player>;
  lockedPairIds: Set<string>;
  onTapPlayer: (player: Player, isOnDeck: boolean) => void;
  onCallToCourt: (slotNumber: number, matchId: string) => void;
  onReroll: (matchId: string) => Promise<void>;
  onRelaxBounds: (matchId: string) => Promise<void>;
  onShiftToSocial: (matchId: string) => Promise<void>;
}

export function OnDeckZone({
  slots,
  stalledSlots,
  onDeckCap,
  capFormula,
  playersMap,
  lockedPairIds,
  onTapPlayer,
  onCallToCourt,
  onReroll,
  onRelaxBounds,
  onShiftToSocial,
}: OnDeckZoneProps) {
  const populatedCount = slots.filter(Boolean).length;

  return (
    <section style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-umber)' }}>
              On-Deck Matchups
            </h2>
            <span className="badge badge-terracotta">
              {populatedCount} of {onDeckCap} slots used
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-umber-muted)' }}>
            Formula: {capFormula} • Pre-staged matchups ready to summon.
          </p>
        </div>
      </div>

      <div className="responsive-grid-ondeck">
        {Array.from({ length: onDeckCap }).map((_, idx) => {
          const slotNumber = idx + 1;
          const match = slots[idx] || null;
          const stalled = stalledSlots.get(slotNumber);

          const teamAPlayers = match
            ? (match.team_a_ids.map((id) => playersMap.get(id)).filter(Boolean) as Player[])
            : [];
          const teamBPlayers = match
            ? (match.team_b_ids.map((id) => playersMap.get(id)).filter(Boolean) as Player[])
            : [];

          return (
            <div
              key={slotNumber}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 'var(--radius-md)',
                border: '2px dashed var(--color-terracotta)', // Distinctive on-deck dashed terracotta border
                boxShadow: 'var(--shadow-sm)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Slot Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-terracotta-light)',
                  borderBottom: '1px dashed var(--color-terracotta)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-terracotta-dark)' }}>
                    ON-DECK SLOT #{slotNumber}
                  </span>
                  {match && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)', textTransform: 'capitalize' }}>
                      ({match.match_mode_used})
                    </span>
                  )}
                </div>

                {match && (
                  <button
                    type="button"
                    onClick={() => onReroll(match.id)}
                    title="Reroll this slot only"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--color-umber)',
                      padding: '4px 8px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <IconRefresh size={14} /> Reroll
                  </button>
                )}
              </div>

              {/* Slot Body */}
              <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {stalled ? (
                  /* Stalled Slot Recovery View */
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ display: 'inline-flex', color: 'var(--color-alert-dark)', marginBottom: '6px' }}>
                      <IconAlertTriangle size={24} />
                    </div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-alert-dark)' }}>
                      Slot Stalled
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)', margin: '4px 0 12px' }}>
                      {stalled.reason}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => onRelaxBounds(match?.id || String(slotNumber))}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--color-cream-dark)',
                          color: 'var(--color-umber)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: '1px solid rgba(62, 47, 35, 0.15)',
                        }}
                      >
                        Relax Bounds (+0.5)
                      </button>
                      <button
                        type="button"
                        onClick={() => onShiftToSocial(match?.id || String(slotNumber))}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--color-olive-light)',
                          color: 'var(--color-olive-dark)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: '1px solid rgba(85, 107, 47, 0.2)',
                        }}
                      >
                        Shift to Social
                      </button>
                    </div>
                  </div>
                ) : match ? (
                  /* Normal Composed Match */
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '10px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-olive-dark)', textTransform: 'uppercase' }}>
                        Team A
                      </div>
                      {teamAPlayers.map((p) => (
                        <PlayerCard
                          key={p.id}
                          player={p}
                          isLockedPair={lockedPairIds.has(p.id)}
                          isOnDeck={true}
                          onTap={(player) => onTapPlayer(player, true)}
                        />
                      ))}
                    </div>

                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-umber-subtle)' }}>
                      vs
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-olive-dark)', textTransform: 'uppercase' }}>
                        Team B
                      </div>
                      {teamBPlayers.map((p) => (
                        <PlayerCard
                          key={p.id}
                          player={p}
                          isLockedPair={lockedPairIds.has(p.id)}
                          isOnDeck={true}
                          onTap={(player) => onTapPlayer(player, true)}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-umber-muted)', fontSize: '0.85rem' }}>
                    Waiting for eligible queued players...
                  </div>
                )}
              </div>

              {/* Primary "Call to court" Footer */}
              {match && (
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: 'var(--color-cream-light)',
                    borderTop: '1px dashed var(--color-terracotta)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onCallToCourt(slotNumber, match.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 18px',
                      backgroundColor: 'var(--color-terracotta)',
                      color: '#FFFFFF',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <IconArrowUpRight size={16} /> Call to Court
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
