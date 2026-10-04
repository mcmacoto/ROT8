'use client';

import React from 'react';
import { Player } from '@/types/database';
import { formatRating } from '@/lib/utils/rating-labels';
import { IconLink, IconDotsVertical } from '@tabler/icons-react';

interface PlayerCardProps {
  player: Player;
  isLockedPair?: boolean;
  isOnDeck?: boolean;
  onTap: (player: Player) => void;
}

export function PlayerCard({
  player,
  isLockedPair = false,
  isOnDeck = false,
  onTap,
}: PlayerCardProps) {
  return (
    <div
      onClick={() => onTap(player)}
      className="player-card"
      title={isOnDeck ? 'On-Deck Matchup Player' : 'Active Court Player'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        backgroundColor: '#FFFFFF',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid rgba(62, 47, 35, 0.1)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-terracotta)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(62, 47, 35, 0.1)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <span
            title={player.name}
            style={{
              fontWeight: 600,
              fontSize: '0.875rem',
              color: 'var(--color-umber)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {player.name}
          </span>
          {isLockedPair && (
            <span
              title="Locked Pair"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                color: 'var(--color-olive-dark)',
              }}
            >
              <IconLink size={14} />
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-umber-muted)' }}>
          <span>{formatRating(player.static_rating)}</span>
          <span>•</span>
          <span>Elo {player.current_elo}</span>
        </div>
      </div>

      <div style={{ color: 'var(--color-umber-subtle)' }}>
        <IconDotsVertical size={16} />
      </div>
    </div>
  );
}
