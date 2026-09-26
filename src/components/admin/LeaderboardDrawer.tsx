'use client';

import React from 'react';
import { Match, Player, Session } from '@/types/database';
import { computeLeaderboard } from '@/lib/engine/leaderboard';
import { formatRating } from '@/lib/utils/rating-labels';
import { IconX, IconTrophy, IconAward } from '@tabler/icons-react';

interface LeaderboardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session;
  players: Player[];
  matches: Match[];
}

export function LeaderboardDrawer({
  isOpen,
  onClose,
  session,
  players,
  matches,
}: LeaderboardDrawerProps) {
  if (!isOpen) return null;

  const leaderboard = computeLeaderboard(
    players,
    matches,
    session.match_mode,
    session.scoring_required
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(62, 47, 35, 0.45)',
        zIndex: 1100,
        display: 'flex',
        justifyContent: 'flex-end',
        backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          height: '100%',
          backgroundColor: '#FFFFFF',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid rgba(62, 47, 35, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid rgba(62, 47, 35, 0.1)',
            backgroundColor: 'var(--color-cream-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--color-terracotta)' }}>
              <IconTrophy size={24} />
            </span>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-umber)', margin: 0 }}>
                Live Leaderboard
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)', margin: '2px 0 0' }}>
                Mode: {session.match_mode.replace('_', ' ').toUpperCase()} • {leaderboard.length} Players
              </p>
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
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Content list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {leaderboard.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-umber-muted)' }}>
              No completed matches recorded yet. Standings will populate as matches finish.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {leaderboard.map((entry) => {
                const isTop3 = entry.rank <= 3;
                const badgeColor =
                  entry.rank === 1
                    ? '#D4AF37'
                    : entry.rank === 2
                    ? '#A8A9AD'
                    : entry.rank === 3
                    ? '#CD7F32'
                    : 'var(--color-cream-dark)';

                return (
                  <div
                    key={entry.player.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      backgroundColor: isTop3 ? 'var(--color-cream-light)' : '#FFFFFF',
                      borderRadius: 'var(--radius-sm)',
                      border: isTop3
                        ? `1px solid ${entry.rank === 1 ? '#D4AF37' : 'rgba(62, 47, 35, 0.2)'}`
                        : '1px solid rgba(62, 47, 35, 0.1)',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* Rank badge */}
                      <span
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: badgeColor,
                          color: isTop3 ? '#FFFFFF' : 'var(--color-umber)',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {entry.rank}
                      </span>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-umber)' }}>
                            {entry.player.name}
                          </span>
                          {entry.rank === 1 && (
                            <IconAward size={16} style={{ color: '#D4AF37' }} />
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)' }}>
                          {formatRating(entry.player.static_rating)}{' '}
                          • Elo {entry.player.current_elo} • SOS {entry.strengthOfSchedule.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-umber)' }}>
                        {entry.player.total_wins}W - {entry.player.total_losses}L
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)' }}>
                        {(entry.winRate * 100).toFixed(0)}% • Diff {entry.player.point_differential > 0 ? `+${entry.player.point_differential}` : entry.player.point_differential}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
