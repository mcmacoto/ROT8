'use client';

import React from 'react';
import { Match, Player } from '@/types/database';

interface OnDeckPreviewProps {
  onDeckMatches: Match[];
  playersMap: Map<string, Player>;
}

export function OnDeckPreview({ onDeckMatches, playersMap }: OnDeckPreviewProps) {
  if (onDeckMatches.length === 0) return null;

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#C36F42', letterSpacing: '0.02em' }}>
            UP NEXT — ON-DECK
          </h3>
          <span
            style={{
              backgroundColor: 'rgba(195, 111, 66, 0.2)',
              color: '#E2895B',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: '1px solid rgba(195, 111, 66, 0.4)',
            }}
          >
            {onDeckMatches.length} MATCHUP{onDeckMatches.length > 1 ? 'S' : ''} STAGED
          </span>
        </div>

        {/* Spec Requirement Persistent Disclaimer */}
        <span style={{ fontSize: '0.8rem', color: 'rgba(245, 240, 232, 0.5)', fontStyle: 'italic' }}>
          &ldquo;Matchups subject to change until called.&rdquo;
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '14px',
        }}
      >
        {onDeckMatches.map((m, idx) => {
          const teamAPlayers = m.team_a_ids.map((id) => playersMap.get(id)).filter(Boolean) as Player[];
          const teamBPlayers = m.team_b_ids.map((id) => playersMap.get(id)).filter(Boolean) as Player[];

          return (
            <div
              key={m.id}
              style={{
                backgroundColor: '#161614',
                borderRadius: 'var(--radius-md)',
                border: '2px dashed rgba(195, 111, 66, 0.6)',
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#E2895B' }}>
                  SLOT #{idx + 1}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'rgba(245, 240, 232, 0.5)', textTransform: 'capitalize' }}>
                  {m.match_mode_used} mode
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#F5F0E8', fontWeight: 600 }}>
                  {teamAPlayers.map((p) => p.name).join(' & ')}
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(245, 240, 232, 0.3)' }}>
                  vs
                </div>
                <div style={{ fontSize: '0.85rem', color: '#F5F0E8', fontWeight: 600 }}>
                  {teamBPlayers.map((p) => p.name).join(' & ')}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
