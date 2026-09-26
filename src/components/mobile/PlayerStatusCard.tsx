'use client';

import React from 'react';
import { Court, Player } from '@/types/database';
import { formatRating } from '@/lib/utils/rating-labels';
import {
  IconClock,
  IconMoon,
  IconPlayerPlay,
  IconAlertCircle,
  IconChecks,
} from '@tabler/icons-react';

interface PlayerStatusCardProps {
  player: Player;
  assignedCourt: Court | null;
  nowMs: number;
  onToggleRest: () => Promise<void>;
  onUntrack?: () => void;
}

export function PlayerStatusCard({
  player,
  assignedCourt,
  nowMs,
  onToggleRest,
  onUntrack,
}: PlayerStatusCardProps) {
  const waitMinutes = nowMs
    ? Math.floor((nowMs - new Date(player.wait_started_at).getTime()) / (60 * 1000))
    : 0;

  // Status visual configs
  let statusTitle = 'IN QUEUE';
  let statusDesc = `You are queued and ready for rotation. (${waitMinutes}m off-court)`;
  let badgeClass = 'badge-olive';
  let StatusIcon = IconClock;

  if (player.status === 'checked_in') {
    statusTitle = 'AWAITING HOST APPROVAL';
    statusDesc = 'Your join request was submitted! You are in the holding list awaiting host check-in approval.';
    badgeClass = 'badge-terracotta';
    StatusIcon = IconClock;
  } else if (player.status === 'staged') {
    statusTitle = 'ON-DECK (UP NEXT)';
    statusDesc = `You are pre-matched in an on-deck slot (${waitMinutes}m off-court). Stay close to the courts!`;
    badgeClass = 'badge-terracotta';
    StatusIcon = IconChecks;
  } else if (player.status === 'summoned') {
    statusTitle = `PROCEED TO COURT ${assignedCourt?.court_number || ''}`;
    statusDesc = 'Your match has been called! Grace period countdown is active.';
    badgeClass = 'badge-alert';
    StatusIcon = IconAlertCircle;
  } else if (player.status === 'on_court') {
    statusTitle = `PLAYING ON COURT ${assignedCourt?.court_number || ''}`;
    statusDesc = 'Your match is live. Good luck!';
    badgeClass = 'badge-olive';
    StatusIcon = IconPlayerPlay;
  } else if (player.status === 'resting') {
    statusTitle = 'TAKING A BREAK';
    statusDesc = 'You are temporarily resting and will not be drafted into new matches.';
    badgeClass = 'badge';
    StatusIcon = IconMoon;
  }

  const isResting = player.status === 'resting';
  const canToggle = player.status === 'queued' || player.status === 'resting';

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        border: '1px solid rgba(62, 47, 35, 0.12)',
        boxShadow: 'var(--shadow-md)',
        marginBottom: '24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-umber-muted)', fontWeight: 600 }}>
            CURRENT STATUS
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span className={`badge ${badgeClass}`} style={{ fontSize: '0.9rem', padding: '4px 10px' }}>
              <StatusIcon size={16} /> {statusTitle}
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)' }}>RATING / ELO</span>
            {onUntrack && (
              <button
                type="button"
                onClick={onUntrack}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-terracotta)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Untrack
              </button>
            )}
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-umber)', marginTop: '2px' }}>
            {player.name} • Elo {player.current_elo}
          </div>
        </div>
      </div>

      <p style={{ fontSize: '0.9rem', color: 'var(--color-umber)', marginBottom: '20px', lineHeight: 1.4 }}>
        {statusDesc}
      </p>

      {/* Self-Service Controls */}
      {canToggle && (
        <button
          type="button"
          onClick={onToggleRest}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: isResting ? 'var(--color-olive)' : 'var(--color-cream-dark)',
            color: isResting ? '#FFFFFF' : 'var(--color-umber)',
            fontWeight: 700,
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {isResting ? (
            <>
              <IconPlayerPlay size={18} /> Resume Play
            </>
          ) : (
            <>
              <IconMoon size={18} /> Take a Break (Rest Mode)
            </>
          )}
        </button>
      )}
    </div>
  );
}
