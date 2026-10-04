'use client';

import React from 'react';
import { Court, Match, Player } from '@/types/database';
import { formatRating } from '@/lib/utils/rating-labels';
import { calculateGraceTimer, calculateMatchDuration } from '@/lib/engine/state-machine/grace-timer';
import {
  IconPlayerPlay,
  IconClock,
  IconAlertTriangle,
  IconSquareOff,
} from '@tabler/icons-react';

interface CourtCardProps {
  court: Court;
  match: Match | null;
  playersMap: Map<string, Player>;
  nowMs: number;
}

export function CourtCard({ court, match, playersMap, nowMs }: CourtCardProps) {
  const isSummoning = court.status === 'summoning';
  const isInMatch = court.status === 'in_match';
  const isNeedsAttention = court.status === 'needs_attention';
  const isMaintenance = court.status === 'maintenance';

  const teamAPlayers = match
    ? (match.team_a_ids.map((id) => playersMap.get(id)).filter(Boolean) as Player[])
    : [];
  const teamBPlayers = match
    ? (match.team_b_ids.map((id) => playersMap.get(id)).filter(Boolean) as Player[])
    : [];

  const graceState = isSummoning && nowMs ? calculateGraceTimer(match?.summoned_at || null, 90, nowMs) : null;
  const matchDuration = isInMatch && nowMs ? calculateMatchDuration(match?.started_at || null, nowMs) : null;

  // Distinct border & icon pair for each state (Accessibility hard requirement)
  let borderColor = 'rgba(245, 240, 232, 0.15)';
  let StatusIcon = IconSquareOff;
  let statusText = 'AVAILABLE';
  let iconColor = 'var(--text-secondary)';

  if (isInMatch) {
    borderColor = '#8A9A5B'; // Olive
    StatusIcon = IconPlayerPlay;
    statusText = `ACTIVE • ${matchDuration?.formattedTime || '00:00'}`;
    iconColor = '#8A9A5B';
  } else if (isSummoning) {
    borderColor = '#C36F42'; // Terracotta
    StatusIcon = IconClock;
    statusText = `SUMMONING • ${graceState?.formattedTime || '01:30'}`;
    iconColor = '#C36F42';
  } else if (isNeedsAttention) {
    borderColor = '#F09595'; // Alert Red
    StatusIcon = IconAlertTriangle;
    statusText = 'WAITING ON PLAYERS';
    iconColor = '#F09595';
  } else if (isMaintenance) {
    borderColor = 'rgba(245, 240, 232, 0.1)';
    StatusIcon = IconSquareOff;
    statusText = 'CLOSED / MAINTENANCE';
    iconColor = 'rgba(245, 240, 232, 0.3)';
  }

  return (
    <div
      style={{
        backgroundColor: '#161614',
        borderRadius: 'var(--radius-md)',
        border: `2px solid ${borderColor}`,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: '220px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          backgroundColor: '#1E1E1B',
          borderBottom: '1px solid rgba(245, 240, 232, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <span
            style={{
              fontSize: '1.2rem',
              fontWeight: 800,
              color: '#F5F0E8',
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={court.name || `COURT ${court.court_number}`}
          >
            {court.name || `COURT ${court.court_number}`}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'rgba(245, 240, 232, 0.6)', textTransform: 'uppercase', flexShrink: 0 }}>
            {court.assigned_match_type}
          </span>
        </div>

        {/* Status indicator with ICON + COLOR */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: iconColor,
            backgroundColor: '#0D0D0C',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            border: `1px solid ${borderColor}`,
          }}
        >
          <StatusIcon size={18} />
          <span>{statusText}</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {match && (isInMatch || isSummoning || isNeedsAttention) ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '14px', alignItems: 'center' }}>
            {/* Team A */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8A9A5B', letterSpacing: '0.05em' }}>
                TEAM A
              </div>
              {teamAPlayers.map((p) => (
                <div
                  key={p.id}
                  style={{
                    backgroundColor: '#0D0D0C',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(245, 240, 232, 0.1)',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      color: '#F5F0E8',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={p.name}
                  >
                    {p.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(245, 240, 232, 0.6)' }}>
                    {formatRating(p.static_rating)} • Elo {p.current_elo}
                  </div>
                </div>
              ))}
            </div>

            {/* vs */}
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'rgba(245, 240, 232, 0.3)', flexShrink: 0 }}>
              VS
            </div>

            {/* Team B */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8A9A5B', letterSpacing: '0.05em' }}>
                TEAM B
              </div>
              {teamBPlayers.map((p) => (
                <div
                  key={p.id}
                  style={{
                    backgroundColor: '#0D0D0C',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(245, 240, 232, 0.1)',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      color: '#F5F0E8',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={p.name}
                  >
                    {p.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(245, 240, 232, 0.6)' }}>
                    {formatRating(p.static_rating)} • Elo {p.current_elo}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : isMaintenance ? (
          <div style={{ textAlign: 'center', color: 'rgba(245, 240, 232, 0.4)', padding: '20px 0' }}>
            <IconSquareOff size={36} style={{ margin: '0 auto 8px', display: 'block' }} />
            <span style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '0.1em' }}>
              COURT UNDER MAINTENANCE
            </span>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'rgba(245, 240, 232, 0.5)', padding: '20px 0' }}>
            <span style={{ fontSize: '1rem', fontWeight: 600 }}>COURT AVAILABLE</span>
          </div>
        )}
      </div>
    </div>
  );
}
