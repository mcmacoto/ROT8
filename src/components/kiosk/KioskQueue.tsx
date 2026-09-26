'use client';

import React from 'react';
import { Player } from '@/types/database';

interface KioskQueueProps {
  queuedPlayers: Player[];
  nowMs: number;
}

export function KioskQueue({ queuedPlayers, nowMs }: KioskQueueProps) {
  if (queuedPlayers.length === 0) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'rgba(245, 240, 232, 0.7)' }}>
          OFF-COURT QUEUE ({queuedPlayers.length})
        </h4>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {queuedPlayers.map((player) => {
          const waitMinutes = nowMs
            ? Math.floor((nowMs - new Date(player.wait_started_at).getTime()) / (60 * 1000))
            : 0;

          return (
            <div
              key={player.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#161614',
                border: '1px solid rgba(245, 240, 232, 0.15)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F5F0E8' }}>
                {player.name}
              </span>
              {player.status === 'staged' && (
                <span
                  style={{
                    backgroundColor: 'rgba(217, 83, 79, 0.25)',
                    color: '#E06D53',
                    border: '1px solid rgba(224, 109, 83, 0.4)',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                  }}
                >
                  On-Deck
                </span>
              )}
              <span style={{ fontSize: '0.75rem', color: 'rgba(245, 240, 232, 0.5)' }}>
                {waitMinutes}m wait
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
