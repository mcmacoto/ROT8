'use client';

import React, { useState } from 'react';
import { Court } from '@/types/database';

interface CallToCourtModalProps {
  isOpen: boolean;
  slotNumber: number;
  availableCourts: Court[];
  onClose: () => void;
  onCall: (courtId: string) => Promise<void>;
}

export function CallToCourtModal({
  isOpen,
  slotNumber,
  availableCourts,
  onClose,
  onCall,
}: CallToCourtModalProps) {
  const [selectedCourtId, setSelectedCourtId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveCourtId = selectedCourtId || availableCourts[0]?.id || '';

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveCourtId) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await onCall(effectiveCourtId);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to summon matchup to court';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(62, 47, 35, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          width: '90%',
          maxWidth: '400px',
          padding: '24px',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid rgba(62, 47, 35, 0.1)',
        }}
      >
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-umber)', marginBottom: '8px' }}>
          Call On-Deck Slot #{slotNumber} to Court
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-umber-muted)', marginBottom: '20px' }}>
          Choose an available court. Calling begins the grace period countdown.
        </p>

        {error && (
          <div style={{ padding: '8px', backgroundColor: 'var(--color-alert-light)', color: 'var(--color-alert-dark)', marginBottom: '16px', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {availableCourts.length === 0 ? (
          <p style={{ fontSize: '0.9rem', color: 'var(--color-alert-dark)', marginBottom: '20px' }}>
            No courts are currently available. Finish or pause a match before calling.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-umber-muted)', marginBottom: '8px' }}>
                Select Destination Court:
              </label>
              <select
                value={selectedCourtId}
                onChange={(e) => setSelectedCourtId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(62, 47, 35, 0.2)',
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--color-umber)',
                }}
              >
                {availableCourts.map((court) => (
                  <option key={court.id} value={court.id}>
                    Court {court.court_number} ({court.name})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-cream-dark)',
                  color: 'var(--color-umber)',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || availableCourts.length === 0}
                style={{
                  padding: '8px 20px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-terracotta)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                }}
              >
                {isSubmitting ? 'Summoning...' : 'Call to Court'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
