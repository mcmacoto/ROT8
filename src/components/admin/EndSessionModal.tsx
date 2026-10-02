'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconAlertTriangle, IconLoader2, IconX } from '@tabler/icons-react';

interface EndSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  sessionName: string;
  activeMatchCount?: number;
  completedMatchCount?: number;
}

export function EndSessionModal({
  isOpen,
  onClose,
  sessionId,
  sessionName,
  activeMatchCount = 0,
  completedMatchCount = 0,
}: EndSessionModalProps) {
  const router = useRouter();
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleEndSession = async () => {
    setIsEnding(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/${sessionId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to end session');
      }

      router.push(`/history/${sessionId}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred while ending the session');
      setIsEnding(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(62, 47, 35, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isEnding) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '440px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          boxShadow: '0 20px 40px -8px rgba(62, 47, 35, 0.25)',
          border: '1px solid #EFEAE3',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(217, 83, 79, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D9534F',
              }}
            >
              <IconAlertTriangle size={22} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#3E2F23' }}>
              End Session?
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isEnding}
            style={{
              background: 'none',
              border: 'none',
              cursor: isEnding ? 'not-allowed' : 'pointer',
              color: '#8C7E72',
              padding: '4px',
              display: 'flex',
            }}
          >
            <IconX size={20} />
          </button>
        </div>

        <p style={{ color: '#6A5E53', fontSize: '0.925rem', lineHeight: '1.5', margin: '0 0 16px 0' }}>
          Are you sure you want to end <strong>{sessionName || 'this session'}</strong>? This will conclude all remaining court matches, close the queue, and move the session to Session History.
        </p>

        <div
          style={{
            backgroundColor: '#FAF8F5',
            borderRadius: '12px',
            padding: '14px 16px',
            marginBottom: '20px',
            border: '1px solid #EFEAE3',
            display: 'flex',
            justifyContent: 'space-around',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3E2F23' }}>{completedMatchCount}</div>
            <div style={{ fontSize: '0.75rem', color: '#8C7E72', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Completed</div>
          </div>
          <div style={{ width: '1px', backgroundColor: '#EFEAE3' }} />
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: activeMatchCount > 0 ? '#D9534F' : '#3E2F23' }}>
              {activeMatchCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#8C7E72', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active On Court</div>
          </div>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: 'rgba(217, 83, 79, 0.08)',
              border: '1px solid rgba(217, 83, 79, 0.25)',
              borderRadius: '8px',
              padding: '10px 12px',
              marginBottom: '16px',
              fontSize: '0.85rem',
              color: '#D9534F',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isEnding}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: '1px solid #D6C7B2',
              backgroundColor: '#FFFFFF',
              color: '#3E2F23',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: isEnding ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleEndSession}
            disabled={isEnding}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#D9534F',
              color: '#FFFFFF',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: isEnding ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isEnding && <IconLoader2 size={16} className="animate-spin" />}
            {isEnding ? 'Ending Session...' : 'End Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
