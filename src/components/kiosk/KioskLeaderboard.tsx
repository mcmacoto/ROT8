'use client';

import React from 'react';
import { Match, Player, Session } from '@/types/database';
import { computeLeaderboard } from '@/lib/engine/leaderboard';
import { IconTrophy, IconAward } from '@tabler/icons-react';

interface KioskLeaderboardProps {
  session: Session;
  players: Player[];
  matches: Match[];
  maxEntries?: number;
}

export function KioskLeaderboard({
  session,
  players,
  matches,
  maxEntries = 10,
}: KioskLeaderboardProps) {
  const leaderboard = computeLeaderboard(
    players,
    matches,
    session.match_mode,
    session.scoring_required
  ).slice(0, maxEntries);

  if (leaderboard.length === 0) return null;

  return (
    <div
      style={{
        backgroundColor: '#161614',
        border: '1px solid rgba(245, 240, 232, 0.12)',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconTrophy size={18} color="#C36F42" />
          <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'rgba(245, 240, 232, 0.9)', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Live Standings
          </h4>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'rgba(245, 240, 232, 0.45)', textTransform: 'uppercase' }}>
          {session.scoring_required ? 'Elo & Win Rate' : 'Matches & Activity'}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(245, 240, 232, 0.1)', textAlign: 'left', color: 'rgba(245, 240, 232, 0.5)', fontSize: '0.725rem' }}>
              <th style={{ padding: '6px 8px', width: '36px' }}>#</th>
              <th style={{ padding: '6px 8px' }}>PLAYER</th>
              <th style={{ padding: '6px 8px', textAlign: 'center' }}>RECORD</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>ELO</th>
              {session.scoring_required && (
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>DIFF</th>
              )}
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry) => {
              const isTop3 = entry.rank <= 3;
              const rankColor =
                entry.rank === 1 ? '#F59E0B' : entry.rank === 2 ? '#94A3B8' : entry.rank === 3 ? '#B45309' : 'rgba(245, 240, 232, 0.6)';

              return (
                <tr
                  key={entry.player.id}
                  style={{
                    borderBottom: '1px solid rgba(245, 240, 232, 0.05)',
                    backgroundColor: entry.rank % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '8px', fontWeight: 800, color: rankColor }}>
                    {isTop3 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        <IconAward size={14} /> {entry.rank}
                      </span>
                    ) : (
                      entry.rank
                    )}
                  </td>
                  <td style={{ padding: '8px', fontWeight: 600, color: '#F5F0E8' }}>
                    {entry.player.name}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', color: 'rgba(245, 240, 232, 0.8)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                    {entry.player.total_wins}W - {entry.player.total_losses}L
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#F5F0E8', fontFamily: 'var(--font-mono)' }}>
                    {entry.player.current_elo}
                  </td>
                  {session.scoring_required && (
                    <td
                      style={{
                        padding: '8px',
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                        color:
                          entry.player.point_differential > 0
                            ? '#34D399'
                            : entry.player.point_differential < 0
                            ? '#F87171'
                            : 'rgba(245, 240, 232, 0.5)',
                      }}
                    >
                      {entry.player.point_differential > 0 ? `+${entry.player.point_differential}` : entry.player.point_differential}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
