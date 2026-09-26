'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Session } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { IconArrowLeft, IconHistory, IconCalendar, IconFilter } from '@tabler/icons-react';

export default function SessionArchivePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadSessions = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/history');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to fetch session history (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (data.sessions) setSessions(data.sessions);
    } catch (err: unknown) {
      console.error('Failed to load history sessions', err);
      const msg = err instanceof Error ? err.message : 'Failed to load sessions';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const filteredSessions = sessions.filter((s) => {
    if (modeFilter !== 'all' && s.match_mode !== modeFilter) return false;
    if (statusFilter === 'active' && !s.is_active) return false;
    if (statusFilter === 'completed' && s.is_active) return false;
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-cream)', color: 'var(--color-umber)' }}>
      <header
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid rgba(62, 47, 35, 0.12)',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--color-umber)',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          <IconArrowLeft size={18} /> Home
        </Link>
        <span style={{ color: 'var(--color-umber-muted)' }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconHistory size={20} color="var(--color-terracotta)" />
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Session History &amp; Audit Archive</h1>
        </div>
      </header>

      <main style={{ maxWidth: '880px', margin: '0 auto', padding: '32px 20px 80px' }}>
        {/* Header & Filters */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--color-umber)' }}>
              Session Records ({filteredSessions.length})
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-umber-muted)' }}>
              Historical session logs, leaderboards, court utilization audits, and CSV match logs.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
              <IconFilter size={16} /> Filters:
            </div>

            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(62, 47, 35, 0.2)',
                fontSize: '0.85rem',
                backgroundColor: '#FFFFFF',
              }}
            >
              <option value="all">All Modes</option>
              <option value="balanced">Balanced</option>
              <option value="skill_separated">Skill-Separated</option>
              <option value="social">Social</option>
              <option value="elo_rated">Elo-Rated</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(62, 47, 35, 0.2)',
                fontSize: '0.85rem',
                backgroundColor: '#FFFFFF',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Sessions List */}
        {loading ? (
          <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-umber-muted)' }}>
            Loading archive...
          </p>
        ) : error ? (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              padding: '32px',
              textAlign: 'center',
              border: '1px solid rgba(217, 83, 79, 0.2)',
            }}
          >
            <p style={{ color: '#D9534F', marginBottom: '12px' }}>{error}</p>
            <button
              type="button"
              onClick={loadSessions}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-terracotta)',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              padding: '40px',
              textAlign: 'center',
              border: '1px solid rgba(62, 47, 35, 0.1)',
            }}
          >
            <p style={{ color: 'var(--color-umber-muted)' }}>No sessions found matching current filters.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredSessions.map((sess) => {
              const dateStr = new Date(sess.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <Link
                  key={sess.id}
                  href={`/history/${sess.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(62, 47, 35, 0.12)',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'transform 0.15s ease, border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = 'var(--color-terracotta)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'rgba(62, 47, 35, 0.12)';
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-umber)' }}>
                        {sess.name}
                      </h3>
                      {sess.is_active ? (
                        <span className="badge badge-olive">LIVE</span>
                      ) : (
                        <span className="badge" style={{ backgroundColor: 'var(--color-cream-dark)', color: 'var(--color-umber-muted)' }}>
                          FINISHED
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.8rem', color: 'var(--color-umber-muted)', marginTop: '4px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IconCalendar size={14} /> {dateStr}
                      </span>
                      <span>•</span>
                      <span style={{ textTransform: 'capitalize' }}>Mode: {sess.match_mode}</span>
                      <span>•</span>
                      <span>PIN: {sess.join_pin}</span>
                    </div>
                  </div>

                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-terracotta)' }}>
                    View Audit &rarr;
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
