'use client';

import React, { useState, useEffect, use } from 'react';
import { Court, Match, Player, Session } from '@/types/database';
import { CourtCard } from '@/components/kiosk/CourtCard';
import { OnDeckPreview } from '@/components/kiosk/OnDeckPreview';
import { KioskQueue } from '@/components/kiosk/KioskQueue';
import { KioskLeaderboard } from '@/components/kiosk/KioskLeaderboard';
import { createClient } from '@/lib/supabase/client';
import { useNow } from '@/lib/hooks/useNow';

export default function KioskBoardPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const supabase = createClient();
  const nowMs = useNow();

  const [session, setSession] = useState<Session | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = React.useCallback(async () => {
    try {
      const [
        { data: sData },
        { data: cData },
        { data: mData },
        { data: pData },
      ] = await Promise.all([
        supabase.from('sessions').select('id, join_pin, name, scoring_required, grace_period_seconds, match_mode, auto_dispatch_enabled, on_deck_cap_override, is_active, created_at, ended_at').eq('id', sessionId).single(),
        supabase.from('courts').select('*').eq('session_id', sessionId).order('court_number', { ascending: true }),
        supabase.from('matches').select('*').eq('session_id', sessionId),
        supabase.from('players').select('*').eq('session_id', sessionId),
      ]);

      if (sData) {
        setSession(sData);
      } else {
        const histRes = await fetch(`/api/history/${sessionId}`).catch(() => null);
        if (histRes && histRes.ok) {
          const histData = await histRes.json();
          if (histData.session) setSession(histData.session);
          if (histData.courts) setCourts(histData.courts);
          if (histData.matches) setMatches(histData.matches);
          if (histData.players) setPlayers(histData.players);
        }
      }

      if (cData) setCourts(cData);
      if (mData) setMatches(mData);
      if (pData) setPlayers(pData);
    } catch (err: unknown) {
      console.error('Failed to load kiosk data', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, supabase]);

  useEffect(() => {
    let ignore = false;
    async function start() {
      if (!ignore) {
        await loadData();
      }
    }
    start();

    let debounceTimer: NodeJS.Timeout | null = null;
    const triggerDebouncedReload = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!ignore) loadData();
      }, 150);
    };

    const channel = supabase
      .channel(`kiosk-session-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', filter: `session_id=eq.${sessionId}` }, () => {
        triggerDebouncedReload();
      })
      .subscribe();

    // Fallback polling interval (10 seconds) for real-time display reliability
    const pollInterval = setInterval(() => {
      if (!ignore) loadData();
    }, 10000);

    return () => {
      ignore = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [sessionId, loadData, supabase]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#0D0D0C',
          color: '#F5F0E8',
        }}
      >
        <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>Initializing Court Display...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#0D0D0C',
          color: '#F5F0E8',
          padding: '24px',
          gap: '12px',
        }}
      >
        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#E06D53' }}>Session Not Found</p>
        <p style={{ fontSize: '0.9rem', color: 'rgba(245, 240, 232, 0.6)' }}>
          This session display is unavailable or has not been created yet.
        </p>
      </div>
    );
  }

  const playersMap = new Map<string, Player>(players.map((p) => [p.id, p]));
  const courtMatchesMap = new Map<string, Match>();
  for (const m of matches) {
    if (m.court_id) courtMatchesMap.set(m.court_id, m);
  }

  const onDeckMatches = matches
    .filter((m) => m.stage === 'on_deck')
    .sort((a, b) => (a.on_deck_slot_number || 1) - (b.on_deck_slot_number || 1));

  const queuedPlayers = players.filter((p) => p.status === 'queued' || p.status === 'staged');

  // QR Code URL for player onboarding
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/live/${sessionId}` : `/live/${sessionId}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(joinUrl)}`;

  return (
    <div
      className="kiosk-theme kiosk-container"
      data-theme="kiosk"
    >
      {/* Kiosk Header */}
      <header className="kiosk-header">
        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: session.is_active ? '#C36F42' : '#E06D53', letterSpacing: '0.1em' }}>
            {session.is_active ? 'ROT8 PICKLEBALL COURTS' : 'SESSION CONCLUDED — FINAL STANDINGS'}
          </span>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 900, color: '#F5F0E8', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {session.name}
          </h1>
        </div>

        {/* Top-Right: QR Code & PIN or Concluded badge */}
        {session.is_active ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(245, 240, 232, 0.6)', textTransform: 'uppercase' }}>
                Scan to Join Queue
              </div>
              <div style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#C36F42' }}>
                PIN: {session.join_pin}
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                padding: '6px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrApiUrl} alt="Join Queue QR" width={80} height={80} style={{ display: 'block' }} />
            </div>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: 'rgba(224, 109, 83, 0.15)',
              border: '1px solid rgba(224, 109, 83, 0.4)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              color: '#E06D53',
              fontWeight: 800,
              fontSize: '0.9rem',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Session Ended
          </div>
        )}
      </header>

      {/* Main Grid: Courts 1-6 */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <section className="kiosk-grid-courts">
          {courts.map((court) => (
            <CourtCard
              key={court.id}
              court={court}
              match={courtMatchesMap.get(court.id) || null}
              playersMap={playersMap}
              nowMs={nowMs}
            />
          ))}
        </section>

        {/* Lower Section: Up-Next On-Deck & General Queue + Live Leaderboard */}
        <section style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid rgba(245, 240, 232, 0.1)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <OnDeckPreview onDeckMatches={onDeckMatches} playersMap={playersMap} />
          <div style={{ display: 'grid', gridTemplateColumns: queuedPlayers.length > 0 && matches.some((m) => m.stage === 'completed') ? 'repeat(auto-fit, minmax(360px, 1fr))' : '1fr', gap: '24px', alignItems: 'start' }}>
            <KioskQueue queuedPlayers={queuedPlayers} nowMs={nowMs} />
            {matches.some((m) => m.stage === 'completed') && (
              <KioskLeaderboard session={session} players={players} matches={matches} />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
