'use client';

import React, { useState } from 'react';
import { Player, PairLockRequest } from '@/types/database';
import { formatRating } from '@/lib/utils/rating-labels';
import { IconLink, IconClock, IconCheck } from '@tabler/icons-react';

interface PairLockRequestFormProps {
  currentPlayerId: string;
  allPlayers: Player[];
  myRequests: PairLockRequest[];
  isLocked: boolean;
  onRequestPair: (targetPlayerId: string) => Promise<void>;
}

export function PairLockRequestForm({
  currentPlayerId,
  allPlayers,
  myRequests,
  isLocked,
  onRequestPair,
}: PairLockRequestFormProps) {
  const [targetId, setTargetId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter available partners (exclude self and already locked players)
  const availablePartners = allPlayers.filter(
    (p) => p.id !== currentPlayerId && p.status !== 'checked_out'
  );

  const pendingRequest = myRequests.find((r) => r.status === 'pending');
  const latestResolved = myRequests.find((r) => r.status !== 'pending');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) return;
    try {
      setIsSubmitting(true);
      await onRequestPair(targetId);
      setTargetId('');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLocked) {
    return (
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          border: '1px solid var(--color-olive)',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <IconCheck size={20} color="var(--color-olive-dark)" />
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-umber)' }}>
            Locked as a Pair
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-umber-muted)' }}>
            You and your partner will be drafted onto the same team in upcoming rotations.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 'var(--radius-md)',
        padding: '20px',
        border: '1px solid rgba(62, 47, 35, 0.12)',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: '24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <IconLink size={18} color="var(--color-terracotta)" />
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-umber)' }}>
          Request Pair Lock
        </h3>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-umber-muted)', marginBottom: '16px' }}>
        Want to play doubles alongside a specific partner? Submit a request for host approval.
      </p>

      {pendingRequest ? (
        <div
          style={{
            padding: '12px 14px',
            backgroundColor: 'var(--color-cream-light)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(62, 47, 35, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <IconClock size={16} color="var(--color-terracotta)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-umber)' }}>
            Pending host approval for pair lock...
          </span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {latestResolved && (
            <div style={{ fontSize: '0.75rem', color: latestResolved.status === 'approved' ? 'var(--color-olive-dark)' : 'var(--color-alert-dark)' }}>
              {latestResolved.status === 'approved' ? 'Previous request approved!' : 'Previous request dismissed.'}
            </div>
          )}

          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            required
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(62, 47, 35, 0.2)',
              fontSize: '0.9rem',
              color: 'var(--color-umber)',
            }}
          >
            <option value="">-- Select your preferred partner --</option>
            {availablePartners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({formatRating(p.static_rating)})
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={!targetId || isSubmitting}
            style={{
              padding: '10px 16px',
              backgroundColor: 'var(--color-terracotta)',
              color: '#FFFFFF',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: '0.9rem',
              opacity: !targetId || isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Send Request to Host'}
          </button>
        </form>
      )}
    </div>
  );
}
