'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MatchMode } from '@/types/database';
import {
  IconDeviceTablet,
  IconUsers,
  IconArrowRight,
  IconPlus,
  IconHistory,
  IconBook,
  IconCheck,
} from '@tabler/icons-react';
import Link from 'next/link';

import { useLocalStorage } from '@/lib/hooks/useLocalStorage';

export default function HomePage() {
  const router = useRouter();

  // Player PIN input state
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  // Host Setup Modal state
  const [isHostModalOpen, setIsHostModalOpen] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [courtCount, setCourtCount] = useState<number>(4);
  const [matchMode, setMatchMode] = useState<MatchMode>('balanced');
  const [scoringRequired, setScoringRequired] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Auto-Resume State via useLocalStorage
  const rawHostSession = useLocalStorage('rot8_last_host_session');
  const rawPlayerSession = useLocalStorage('rot8_last_player_session');

  let savedHostSession: { id: string; name: string } | null = null;
  let savedPlayerSession: { id: string; name?: string } | null = null;

  if (rawHostSession) {
    try {
      savedHostSession = JSON.parse(rawHostSession);
    } catch {
      savedHostSession = null;
    }
  }

  if (rawPlayerSession) {
    try {
      savedPlayerSession = JSON.parse(rawPlayerSession);
    } catch {
      savedPlayerSession = null;
    }
  }

  // Handle Player Join by PIN
  const handleJoinByPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim().toUpperCase();
    if (cleanPin.length !== 6) {
      setPinError('PIN must be 6 characters');
      return;
    }

    try {
      setIsJoining(true);
      setPinError(null);
      // Query session by PIN
      const res = await fetch(`/api/sessions/find?pin=${cleanPin}`);
      const data = await res.json();

      if (!res.ok || !data.sessionId) {
        setPinError(data.error || 'Session not found. Please verify the PIN.');
        return;
      }

      localStorage.setItem('rot8_last_player_session', JSON.stringify({ id: data.sessionId, name: data.name }));
      router.push(`/live/${data.sessionId}`);
    } catch {
      setPinError('Network error connecting to session');
    } finally {
      setIsJoining(false);
    }
  };

  // Handle Host Session Creation
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionName.trim()) return;

    try {
      setIsCreating(true);
      setCreateError(null);

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sessionName.trim(),
          courtCount,
          matchMode,
          scoringRequired,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.sessionId) {
        setCreateError(data.error || 'Failed to initialize session');
        return;
      }

      localStorage.setItem('rot8_last_host_session', JSON.stringify({ id: data.sessionId, name: data.name }));
      router.push(`/admin/${data.sessionId}`);
    } catch {
      setCreateError('Network error creating session');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-cream)', color: 'var(--color-umber)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <header
        style={{
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(62, 47, 35, 0.1)',
          backgroundColor: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--color-terracotta)', letterSpacing: '-0.03em' }}>
            ROT8
          </span>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-umber-muted)' }}>
            Pickleball Rotation Engine
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/history" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-umber)' }}>
            <IconHistory size={16} /> History
          </Link>
          <Link href="/how-to-use" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-umber)' }}>
            <IconBook size={16} /> Guide
          </Link>
        </div>
      </header>

      {/* Main Hub Content */}
      <main style={{ flex: 1, maxWidth: '680px', margin: '0 auto', width: '100%', padding: '40px 20px 80px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--color-umber)', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: '12px' }}>
            Court Rotations &amp; Queue Management
          </h1>
          <p style={{ fontSize: '1.05rem', color: 'var(--color-umber-muted)', maxWidth: '480px', margin: '0 auto' }}>
            Fair wait times, skill-matched doubles games, and instant court turnaround for clubs &amp; venues.
          </p>
        </div>

        {/* Auto-Resume Chips */}
        {(savedHostSession || savedPlayerSession) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginBottom: '28px' }}>
            {savedHostSession && (
              <Link
                href={`/admin/${savedHostSession.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--color-terracotta)',
                  color: 'var(--color-terracotta-dark)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <IconDeviceTablet size={16} /> Resume Host Console: {savedHostSession.name}
              </Link>
            )}

            {savedPlayerSession && (
              <Link
                href={`/live/${savedPlayerSession.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--color-olive)',
                  color: 'var(--color-olive-dark)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <IconUsers size={16} /> Open Player Queue: {savedPlayerSession.name || 'Active Session'}
              </Link>
            )}
          </div>
        )}

        {/* Dual Primary Action Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card 1: Player PIN Access */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              border: '1px solid rgba(62, 47, 35, 0.12)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ padding: '8px', backgroundColor: 'var(--color-olive-light)', borderRadius: 'var(--radius-sm)', color: 'var(--color-olive-dark)' }}>
                <IconUsers size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-umber)' }}>
                  Players: Join Session
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-umber-muted)' }}>
                  Enter the 6-character PIN shown on the TV kiosk or venue board.
                </p>
              </div>
            </div>

            {pinError && (
              <div style={{ padding: '8px 12px', backgroundColor: 'var(--color-alert-light)', color: 'var(--color-alert-dark)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', margin: '12px 0' }}>
                {pinError}
              </div>
            )}

            <form onSubmit={handleJoinByPin} style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <input
                type="text"
                placeholder="ENTER PIN"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.toUpperCase())}
                required
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid rgba(62, 47, 35, 0.2)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  letterSpacing: '0.2em',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                }}
              />

              <button
                type="submit"
                disabled={isJoining || pin.length < 6}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'var(--color-olive)',
                  color: '#FFFFFF',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: pin.length < 6 ? 0.6 : 1,
                }}
              >
                {isJoining ? 'Joining...' : 'Join'} <IconArrowRight size={18} />
              </button>
            </form>
          </div>

          {/* Card 2: Host Session Creator */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              border: '1px solid rgba(62, 47, 35, 0.12)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', backgroundColor: 'var(--color-terracotta-light)', borderRadius: 'var(--radius-sm)', color: 'var(--color-terracotta-dark)' }}>
                  <IconDeviceTablet size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-umber)' }}>
                    Session Organizers &amp; Hosts
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-umber-muted)' }}>
                    Launch a new session, configure 1–6 courts, and control rotations.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsHostModalOpen(true)}
                style={{
                  padding: '12px 20px',
                  backgroundColor: 'var(--color-terracotta)',
                  color: '#FFFFFF',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                <IconPlus size={18} /> Start Session
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Host Setup Modal */}
      {isHostModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(62, 47, 35, 0.4)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              width: '90%',
              maxWidth: '460px',
              padding: '28px',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid rgba(62, 47, 35, 0.1)',
            }}
          >
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-umber)', marginBottom: '6px' }}>
              Create New Pickleball Session
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-umber-muted)', marginBottom: '20px' }}>
              Configure your venue courts and matchmaking mode.
            </p>

            {createError && (
              <div style={{ padding: '8px 12px', backgroundColor: 'var(--color-alert-light)', color: 'var(--color-alert-dark)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '16px' }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-umber)', marginBottom: '6px' }}>
                  Session Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Wednesday Night Open Play"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(62, 47, 35, 0.2)',
                    fontSize: '0.95rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-umber)', marginBottom: '6px' }}>
                  Number of Active Courts (1 – 6)
                </label>
                <select
                  value={courtCount}
                  onChange={(e) => setCourtCount(parseInt(e.target.value, 10))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(62, 47, 35, 0.2)',
                    fontSize: '0.95rem',
                  }}
                >
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? 'Court (On-Deck Cap = 1)' : `Courts (On-Deck Cap = ${num - 1})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-umber)', marginBottom: '6px' }}>
                  Matchmaking Algorithm Mode
                </label>
                <select
                  value={matchMode}
                  onChange={(e) => setMatchMode(e.target.value as MatchMode)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(62, 47, 35, 0.2)',
                    fontSize: '0.95rem',
                  }}
                >
                  <option value="balanced">Balanced Mode (ΔR ≤ 1.0)</option>
                  <option value="skill_separated">Skill-Separated (Hard Tier Partitions)</option>
                  <option value="social">Social Mode (Mixer with Repeat Penalties)</option>
                  <option value="elo_rated">Dynamic Elo-Rated Mode</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={scoringRequired}
                    onChange={(e) => setScoringRequired(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--color-terracotta)' }}
                  />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-umber)' }}>
                    Require Match Score Entry
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsHostModalOpen(false)}
                  style={{
                    padding: '10px 16px',
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
                  disabled={isCreating || !sessionName.trim()}
                  style={{
                    padding: '10px 22px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-terracotta)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <IconCheck size={18} /> {isCreating ? 'Creating...' : 'Initialize Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
