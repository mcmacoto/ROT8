'use client';

import React from 'react';
import { PairLockRequest, Player } from '@/types/database';
import { formatRating } from '@/lib/utils/rating-labels';
import { IconBell, IconCheck, IconX, IconLink } from '@tabler/icons-react';

interface PairLockNotificationsProps {
  requests: PairLockRequest[];
  playersMap: Map<string, Player>;
  onApprove: (requestId: string) => Promise<void>;
  onDismiss: (requestId: string) => Promise<void>;
}

export function PairLockNotifications({
  requests,
  playersMap,
  onApprove,
  onDismiss,
}: PairLockNotificationsProps) {
  const pendingRequests = requests.filter((r) => r.status === 'pending');

  if (pendingRequests.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-olive)',
        padding: '16px',
        marginBottom: '20px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <IconBell size={20} color="var(--color-olive-dark)" />
        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-umber)' }}>
          Pending Pair-Lock Requests ({pendingRequests.length})
        </h4>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {pendingRequests.map((req) => {
          const requester = playersMap.get(req.requester_id);
          const target = playersMap.get(req.target_id);

          return (
            <div
              key={req.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                backgroundColor: 'var(--color-cream-light)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(62, 47, 35, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconLink size={16} color="var(--color-olive-dark)" />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-umber)' }}>
                  {requester?.name || 'Unknown'} ({formatRating(requester?.static_rating)}) &amp;{' '}
                  {target?.name || 'Unknown'} ({formatRating(target?.static_rating)})
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => onApprove(req.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    backgroundColor: 'var(--color-olive)',
                    color: '#FFFFFF',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  <IconCheck size={14} /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => onDismiss(req.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    backgroundColor: 'var(--color-cream-dark)',
                    color: 'var(--color-umber)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  <IconX size={14} /> Dismiss
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
