'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { IconLock, IconKey, IconArrowRight, IconAlertCircle } from '@tabler/icons-react';
import Link from 'next/link';

export default function HostLoginPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const res = await fetch('/api/sessions/host-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          pin: pin.trim().toUpperCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate');
      }

      router.push(`/admin/${sessionId}`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid Session PIN');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-cream)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          padding: '32px 28px',
          maxWidth: '420px',
          width: '100%',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid rgba(62, 47, 35, 0.12)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-terracotta-light)',
            color: 'var(--color-terracotta)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <IconLock size={28} />
        </div>

        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 800,
            color: 'var(--color-terracotta)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Co-Host Authentication
        </span>
        <h1
          style={{
            fontSize: '1.4rem',
            fontWeight: 900,
            color: 'var(--color-umber)',
            marginTop: '4px',
            marginBottom: '8px',
          }}
        >
          Access Host Console
        </h1>
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--color-umber-muted)',
            lineHeight: 1.45,
            marginBottom: '24px',
          }}
        >
          Enter the 6-character Session PIN to manage courts, queue, and scoring on this device.
        </p>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--color-alert-light)',
              color: 'var(--color-alert-dark)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '18px',
              textAlign: 'left',
            }}
          >
            <IconAlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <input
                type="text"
                placeholder="PIN (e.g. 48J7K2)"
                value={pin}
                onChange={(e) => setPin(e.target.value.toUpperCase())}
                maxLength={6}
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid rgba(62, 47, 35, 0.2)',
                  fontSize: '1.25rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  letterSpacing: '0.2em',
                  textAlign: 'center',
                  outline: 'none',
                  textTransform: 'uppercase',
                  color: 'var(--color-umber)',
                  backgroundColor: 'var(--color-cream-light)',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || pin.trim().length < 4}
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-terracotta)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting || pin.trim().length < 4 ? 0.7 : 1,
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <IconKey size={18} />
            {isSubmitting ? 'Verifying PIN...' : 'Unlock Host Console'}
            <IconArrowRight size={18} />
          </button>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(62, 47, 35, 0.08)' }}>
          <Link
            href={`/live/${sessionId}`}
            style={{
              fontSize: '0.85rem',
              color: 'var(--color-umber-muted)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            ← Back to Player Live Queue
          </Link>
        </div>
      </div>
    </div>
  );
}
