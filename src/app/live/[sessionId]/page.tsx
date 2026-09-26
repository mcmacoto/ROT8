'use client';

import React, { useState, useEffect, use } from 'react';
import { Court, Match, Player, Session, PairLockRequest, StaticRating } from '@/types/database';
import { PlayerStatusCard } from '@/components/mobile/PlayerStatusCard';
import { PairLockRequestForm } from '@/components/mobile/PairLockRequestForm';
import { computeLeaderboard } from '@/lib/engine/leaderboard';
import { createClient } from '@/lib/supabase/client';
import { useNow } from '@/lib/hooks/useNow';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { RATING_TIERS, formatRating } from '@/lib/utils/rating-labels';
import {
  IconTrophy,
  IconUserCheck,
  IconHelp,
  IconPlus,
  IconUserSearch,
  IconX,
  IconClock,
  IconBolt,
  IconDeviceTv,
  IconCheck,
  IconAlertCircle,
  IconShieldLock,
} from '@tabler/icons-react';
import Link from 'next/link';

export default function MobilePlayerHubPage({
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
  const [lockedPairs, setLockedPairs] = useState<{ p1: string; p2: string }[]>([]);
  const [pairRequests, setPairRequests] = useState<PairLockRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Local player identification
  const storedPlayerId = useLocalStorage(`rot8_player_id_${sessionId}`);
  const [newlyRegisteredId, setNewlyRegisteredId] = useState<string | null>(null);
  const currentPlayerId = newlyRegisteredId || storedPlayerId;

  // Modals state
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);

  // Join form state
  const [joinName, setJoinName] = useState('');
  const [joinRating, setJoinRating] = useState<StaticRating>(0);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Track profile form state
  const [trackPlayerId, setTrackPlayerId] = useState('');
  const [trackPin, setTrackPin] = useState('');
  const [isTrackSubmitting, setIsTrackSubmitting] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      const [
        { data: sData },
        { data: cData },
        { data: mData },
        { data: pData },
        { data: lpData },
        { data: prData },
      ] = await Promise.all([
        supabase.from('sessions').select('id, join_pin, name, scoring_required, grace_period_seconds, match_mode, auto_dispatch_enabled, on_deck_cap_override, is_active, created_at, ended_at').eq('id', sessionId).single(),
        supabase.from('courts').select('*').eq('session_id', sessionId).order('court_number', { ascending: true }),
        supabase.from('matches').select('*').eq('session_id', sessionId),
        supabase.from('players').select('*').eq('session_id', sessionId),
        supabase.from('locked_pairs').select('*').eq('session_id', sessionId).eq('is_active', true),
        supabase.from('pair_lock_requests').select('*').eq('session_id', sessionId),
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
      if (lpData) {
        setLockedPairs(
          (lpData as { player_1_id: string; player_2_id: string }[]).map((lp) => ({
            p1: lp.player_1_id,
            p2: lp.player_2_id,
          }))
        );
      }
      if (prData) setPairRequests(prData);
    } catch (err: unknown) {
      console.error('Failed to load player hub data', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, supabase]);

  useEffect(() => {
    let ignore = false;
    async function start() {
      if (!ignore) await loadData();
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
      .channel(`live-session-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', filter: `session_id=eq.${sessionId}` }, () => {
        triggerDebouncedReload();
      })
      .subscribe();

    // Fallback polling interval (10 seconds)
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--color-cream)' }}>
        <p style={{ fontWeight: 600, color: 'var(--color-umber)' }}>Loading Live Session...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--color-cream)', padding: '24px' }}>
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 'var(--radius-lg)', padding: '32px', maxWidth: '440px', width: '100%', textAlign: 'center', border: '1px solid rgba(62, 47, 35, 0.12)', boxShadow: 'var(--shadow-md)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-umber)', marginBottom: '8px' }}>Session Not Found</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-umber-muted)', marginBottom: '20px' }}>This session could not be found or has not started yet.</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link href="/" style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-cream-light)', color: 'var(--color-umber)', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>
              Home
            </Link>
            <Link href="/history" style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-terracotta)', color: '#FFFFFF', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}>
              Session History
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Handle Player Queue Join Request (Feature #5)
  const handleJoinQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinName.trim()) return;

    try {
      setIsJoining(true);
      setJoinError(null);
      const res = await fetch('/api/player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_in',
          sessionId,
          name: joinName.trim(),
          staticRating: joinRating,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit join request');
      }

      if (data.player?.id) {
        setNewlyRegisteredId(data.player.id);
        try {
          localStorage.setItem(`rot8_player_id_${sessionId}`, data.player.id);
        } catch {}
        setIsJoinModalOpen(false);
        setJoinName('');
        await loadData();
      }
    } catch (err: any) {
      setJoinError(err.message || 'Failed to join queue');
    } finally {
      setIsJoining(false);
    }
  };

  // Handle Player Profile Claim with PIN (Feature #6)
  const handleClaimProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackPlayerId || !trackPin.trim()) return;

    try {
      setIsTrackSubmitting(true);
      setTrackError(null);
      const res = await fetch('/api/player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'claim_profile',
          sessionId,
          playerId: trackPlayerId,
          pin: trackPin.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to claim profile. Check your PIN.');
      }

      if (data.player?.id) {
        setNewlyRegisteredId(data.player.id);
        try {
          localStorage.setItem(`rot8_player_id_${sessionId}`, data.player.id);
        } catch {}
        setIsTrackModalOpen(false);
        setTrackPin('');
        await loadData();
      }
    } catch (err: any) {
      setTrackError(err.message || 'Invalid PIN. Ask host for assistance.');
    } finally {
      setIsTrackSubmitting(false);
    }
  };

  const handleUntrack = () => {
    try {
      localStorage.removeItem(`rot8_player_id_${sessionId}`);
    } catch {}
    setNewlyRegisteredId(null);
  };

  const currentPlayer = players.find((p) => p.id === currentPlayerId) || null;
  const playersMap = new Map<string, Player>(players.map((p) => [p.id, p]));

  // Check if player is part of active match
  const assignedMatch = currentPlayer
    ? matches.find(
        (m) =>
          (m.stage === 'summoning' || m.stage === 'in_match') &&
          (m.team_a_ids.includes(currentPlayer.id) || m.team_b_ids.includes(currentPlayer.id))
      )
    : null;

  const assignedCourt = assignedMatch?.court_id
    ? courts.find((c) => c.id === assignedMatch.court_id) || null
    : null;

  const isLocked = currentPlayer
    ? lockedPairs.some((lp) => lp.p1 === currentPlayer.id || lp.p2 === currentPlayer.id)
    : false;

  const myRequests = currentPlayer
    ? pairRequests.filter((pr) => pr.requester_id === currentPlayer.id)
    : [];

  const handleToggleRest = async () => {
    if (!currentPlayer) return;
    await fetch('/api/player', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_rest', playerId: currentPlayer.id }),
    });
    loadData();
  };

  const handleRequestPair = async (targetPlayerId: string) => {
    if (!currentPlayer) return;
    await fetch('/api/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'request_pair_lock',
        sessionId,
        requesterId: currentPlayer.id,
        targetId: targetPlayerId,
      }),
    });
    loadData();
  };

  // Compute live leaderboard
  const leaderboard = computeLeaderboard(
    players,
    matches,
    session.match_mode,
    session.scoring_required
  );

  // Group courts and matches
  const activeCourtsMatches = courts.map((court) => {
    const match = matches.find((m) => m.court_id === court.id && m.stage !== 'completed') || null;
    return { court, match };
  });

  const onDeckMatches = matches
    .filter((m) => m.stage === 'on_deck')
    .sort((a, b) => (a.on_deck_slot_number || 1) - (b.on_deck_slot_number || 1));

  const queuedPlayers = players.filter((p) => p.status === 'queued' || p.status === 'staged');
  const holdingPlayers = players.filter((p) => p.status === 'checked_in');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-cream)', color: 'var(--color-umber)' }}>
      {/* Mobile Top Header */}
      <header
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid rgba(62, 47, 35, 0.12)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 2px 8px rgba(62, 47, 35, 0.04)',
        }}
      >
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-terracotta)', letterSpacing: '0.05em' }}>
            ROT8 LIVE HUB
          </span>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-umber)', margin: 0, lineHeight: 1.2 }}>
            {session.name}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link
            href={`/kiosk/${sessionId}`}
            target="_blank"
            title="Open Kiosk View"
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-cream-light)',
              color: 'var(--color-umber)',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              textDecoration: 'none',
              border: '1px solid rgba(62, 47, 35, 0.1)',
            }}
          >
            <IconDeviceTv size={16} /> Kiosk
          </Link>
          <Link
            href="/how-to-use"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.8rem',
              color: 'var(--color-umber-muted)',
              fontWeight: 600,
              padding: '6px 8px',
            }}
          >
            <IconHelp size={16} />
          </Link>
        </div>
      </header>

      {!session.is_active && (
        <div
          style={{
            backgroundColor: 'rgba(217, 83, 79, 0.08)',
            borderBottom: '1px solid rgba(217, 83, 79, 0.25)',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#D9534F', fontWeight: 600, fontSize: '0.875rem' }}>
            <IconAlertCircle size={18} />
            <span>This session has concluded. Live matches and queue requests are closed.</span>
          </div>
          <Link
            href={`/history/${sessionId}`}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: '#D9534F',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.8rem',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            View Final Standings &amp; Audit →
          </Link>
        </div>
      )}

      {/* Action Banner (Join Queue & Track Player) */}
      <div
        style={{
          backgroundColor: '#FAF8F5',
          borderBottom: '1px solid #EFEAE3',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        {!session.is_active ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--color-umber-muted)' }}>
            <span>Session is closed.</span>
            <Link
              href={`/history/${sessionId}`}
              style={{ color: 'var(--color-terracotta)', fontWeight: 700, textDecoration: 'underline' }}
            >
              View Final Standings &amp; Audit
            </Link>
          </div>
        ) : !currentPlayer ? (
          <>
            <button
              type="button"
              onClick={() => setIsJoinModalOpen(true)}
              style={{
                backgroundColor: 'var(--color-terracotta)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(195, 111, 66, 0.25)',
              }}
            >
              <IconPlus size={16} /> Join Queue
            </button>
            <button
              type="button"
              onClick={() => setIsTrackModalOpen(true)}
              style={{
                backgroundColor: '#FFFFFF',
                color: 'var(--color-umber)',
                border: '1px solid #D6C7B2',
                borderRadius: '8px',
                padding: '8px 16px',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <IconUserSearch size={16} /> Track My Player
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--color-umber-muted)' }}>Tracking player:</span>
            <strong style={{ color: 'var(--color-umber)' }}>{currentPlayer.name}</strong>
            <button
              type="button"
              onClick={handleUntrack}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-terracotta)',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              (Switch / Untrack)
            </button>
          </div>
        )}
      </div>

      <main style={{ maxWidth: '640px', margin: '0 auto', padding: '16px 16px 80px' }}>
        {/* Tracked Player Personal Card */}
        {currentPlayer && (
          <div style={{ marginBottom: '24px' }}>
            <PlayerStatusCard
              player={currentPlayer}
              assignedCourt={assignedCourt}
              nowMs={nowMs}
              onToggleRest={handleToggleRest}
              onUntrack={handleUntrack}
            />

            {currentPlayer.status !== 'checked_in' && (
              <PairLockRequestForm
                currentPlayerId={currentPlayer.id}
                allPlayers={players}
                myRequests={myRequests}
                isLocked={isLocked}
                onRequestPair={handleRequestPair}
              />
            )}
          </div>
        )}

        {/* SECTION 1: Active Courts */}
        <section style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-umber)', margin: 0 }}>
              Active Courts ({courts.length})
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)' }}>Live Rotations</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {activeCourtsMatches.map(({ court, match }) => {
              const isMyCourt =
                currentPlayer &&
                match &&
                (match.team_a_ids.includes(currentPlayer.id) || match.team_b_ids.includes(currentPlayer.id));

              const teamANames = match
                ? match.team_a_ids.map((id) => playersMap.get(id)?.name || 'Player').join(' & ')
                : '';
              const teamBNames = match
                ? match.team_b_ids.map((id) => playersMap.get(id)?.name || 'Player').join(' & ')
                : '';

              return (
                <div
                  key={court.id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 'var(--radius-md)',
                    border: isMyCourt ? '2px solid var(--color-terracotta)' : '1px solid rgba(62, 47, 35, 0.12)',
                    padding: '14px 16px',
                    boxShadow: isMyCourt ? '0 4px 12px rgba(195, 111, 66, 0.15)' : 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-umber)' }}>
                        {court.name || `Court ${court.court_number}`}
                      </span>
                    </div>
                    {match ? (
                      <span
                        style={{
                          backgroundColor:
                            match.stage === 'summoning' ? 'rgba(217, 83, 79, 0.15)' : 'rgba(107, 142, 35, 0.15)',
                          color: match.stage === 'summoning' ? '#D9534F' : '#4E6B1D',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                        }}
                      >
                        {match.stage === 'summoning' ? 'Grace Countdown' : 'In Progress'}
                      </span>
                    ) : (
                      <span
                        style={{
                          backgroundColor: 'var(--color-cream-dark)',
                          color: 'var(--color-umber-muted)',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                        }}
                      >
                        Available
                      </span>
                    )}
                  </div>

                  {match ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                        <span style={{ color: 'var(--color-umber)' }}>{teamANames}</span>
                        {match.score_a !== null && <span>{match.score_a}</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)', textAlign: 'center' }}>vs</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                        <span style={{ color: 'var(--color-umber)' }}>{teamBNames}</span>
                        {match.score_b !== null && <span>{match.score_b}</span>}
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-umber-muted)', margin: '8px 0 0' }}>
                      Court is clear, awaiting summon from on-deck.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: On-Deck Matchups (Up Next) */}
        {onDeckMatches.length > 0 && (
          <section style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <IconBolt size={18} color="var(--color-terracotta)" />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-umber)', margin: 0 }}>
                On-Deck Matchups ({onDeckMatches.length})
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {onDeckMatches.map((m) => {
                const teamA = m.team_a_ids.map((id) => playersMap.get(id)?.name || 'Player').join(' & ');
                const teamB = m.team_b_ids.map((id) => playersMap.get(id)?.name || 'Player').join(' & ');
                const isMyMatch =
                  currentPlayer && (m.team_a_ids.includes(currentPlayer.id) || m.team_b_ids.includes(currentPlayer.id));

                return (
                  <div
                    key={m.id}
                    style={{
                      backgroundColor: isMyMatch ? '#FFFDF8' : '#FFFFFF',
                      borderRadius: 'var(--radius-md)',
                      border: isMyMatch ? '2px solid var(--color-terracotta)' : '1px solid rgba(62, 47, 35, 0.12)',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          backgroundColor: 'rgba(195, 111, 66, 0.12)',
                          color: 'var(--color-terracotta)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        Slot #{m.on_deck_slot_number || 1}
                      </span>
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-umber)', marginTop: '4px' }}>
                        {teamA} <span style={{ color: 'var(--color-umber-muted)', fontWeight: 400 }}>vs</span> {teamB}
                      </div>
                    </div>
                    {isMyMatch && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-terracotta)' }}>
                        You&apos;re Up Next!
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* SECTION 3: Off-Court Queue */}
        <section style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconClock size={18} color="var(--color-olive-dark)" />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-umber)', margin: 0 }}>
                Queue ({queuedPlayers.length})
              </h2>
            </div>
            {holdingPlayers.length > 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)' }}>
                {holdingPlayers.length} awaiting host approval
              </span>
            )}
          </div>

          {queuedPlayers.length === 0 ? (
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                textAlign: 'center',
                border: '1px solid rgba(62, 47, 35, 0.1)',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-umber-muted)' }}>
                The queue is currently empty. Tap &quot;Join Queue&quot; above to jump in!
              </p>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(62, 47, 35, 0.12)',
                padding: '12px 14px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {queuedPlayers.map((player) => {
                const waitMinutes = nowMs
                  ? Math.floor((nowMs - new Date(player.wait_started_at).getTime()) / (60 * 1000))
                  : 0;
                const isMe = currentPlayer?.id === player.id;

                return (
                  <div
                    key={player.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: isMe ? 'var(--color-terracotta)' : 'var(--color-cream-light)',
                      color: isMe ? '#FFFFFF' : 'var(--color-umber)',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      fontSize: '0.825rem',
                      fontWeight: isMe ? 700 : 500,
                      border: isMe ? 'none' : '1px solid rgba(62, 47, 35, 0.1)',
                    }}
                  >
                    <span>{player.name}</span>
                    {player.status === 'staged' && (
                      <span
                        style={{
                          backgroundColor: isMe ? 'rgba(255, 255, 255, 0.25)' : 'rgba(195, 111, 66, 0.15)',
                          color: isMe ? '#FFFFFF' : 'var(--color-terracotta)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                        }}
                      >
                        On-Deck
                      </span>
                    )}
                    <span style={{ fontSize: '0.7rem', opacity: 0.75 }}>{waitMinutes}m</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SECTION 4: Live Leaderboard */}
        <section style={{ marginBottom: '28px' }}>
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              border: '1px solid rgba(62, 47, 35, 0.12)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconTrophy size={20} color="var(--color-olive-dark)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-umber)', margin: 0 }}>
                  Live Standings
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)' }}>
                {session.match_mode.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            {leaderboard.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-umber-muted)', margin: 0 }}>
                No completed matches yet. Standings update after each finished game.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid rgba(62, 47, 35, 0.1)', textAlign: 'left', color: 'var(--color-umber-muted)', fontSize: '0.75rem' }}>
                      <th style={{ padding: '8px 4px' }}>#</th>
                      <th style={{ padding: '8px' }}>Player</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Elo / Rating</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>W - L</th>
                      {session.scoring_required && (
                        <th style={{ padding: '8px', textAlign: 'right' }}>Diff</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.slice(0, 10).map((entry) => {
                      const isMe = currentPlayer?.id === entry.player.id;
                      return (
                        <tr
                          key={entry.player.id}
                          style={{
                            borderBottom: '1px solid rgba(62, 47, 35, 0.06)',
                            backgroundColor: isMe ? 'var(--color-cream-light)' : 'transparent',
                            fontWeight: isMe ? 700 : 500,
                          }}
                        >
                          <td style={{ padding: '8px 4px', color: 'var(--color-umber-muted)' }}>{entry.rank}</td>
                          <td style={{ padding: '8px' }}>
                            {entry.player.name} {isMe && '(You)'}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            {session.match_mode === 'elo_rated'
                              ? entry.player.current_elo
                              : formatRating(entry.player.static_rating)}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            {entry.player.total_wins} - {entry.player.total_losses}
                          </td>
                          {session.scoring_required && (
                            <td
                              style={{
                                padding: '8px',
                                textAlign: 'right',
                                fontWeight: 600,
                                color:
                                  entry.player.point_differential > 0
                                    ? '#2E7D32'
                                    : entry.player.point_differential < 0
                                    ? '#C62828'
                                    : 'inherit',
                              }}
                            >
                              {entry.player.point_differential > 0 ? `+${entry.player.point_differential}` : entry.player.point_differential}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* MODAL 1: Join Queue Form (Pending Host Approval per Feature #5) */}
      {isJoinModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(62, 47, 35, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isJoining) setIsJoinModalOpen(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              boxShadow: '0 20px 40px -8px rgba(62, 47, 35, 0.25)',
              border: '1px solid #EFEAE3',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-umber)' }}>
                Join Queue Request
              </h3>
              <button
                type="button"
                onClick={() => setIsJoinModalOpen(false)}
                disabled={isJoining}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-umber-muted)' }}
              >
                <IconX size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--color-umber-muted)', margin: '0 0 16px 0', lineHeight: 1.4 }}>
              Enter your details below. Your request will be sent to the host holding list for check-in approval.
            </p>

            {joinError && (
              <div
                style={{
                  backgroundColor: 'rgba(217, 83, 79, 0.1)',
                  border: '1px solid rgba(217, 83, 79, 0.3)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '16px',
                  fontSize: '0.85rem',
                  color: '#D9534F',
                }}
              >
                {joinError}
              </div>
            )}

            <form onSubmit={handleJoinQueue} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-umber)', marginBottom: '6px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jordan Lee"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(62, 47, 35, 0.2)',
                    fontSize: '0.95rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-umber)', marginBottom: '6px' }}>
                  Skill Level
                </label>
                <select
                  value={joinRating}
                  onChange={(e) => setJoinRating(parseInt(e.target.value, 10) as StaticRating)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(62, 47, 35, 0.2)',
                    fontSize: '0.95rem',
                  }}
                >
                  {RATING_TIERS.map((tier) => (
                    <option key={tier.value} value={tier.value}>
                      {tier.value === 0 ? 'Unrated (0) — No rating' : `★ ${tier.label} (${tier.value}) — ${tier.description}`}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  disabled={isJoining}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid #D6C7B2',
                    backgroundColor: '#FFFFFF',
                    color: 'var(--color-umber)',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isJoining}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--color-terracotta)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    cursor: isJoining ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <IconUserCheck size={18} />
                  {isJoining ? 'Submitting...' : 'Request to Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Track My Player Profile with PIN (Feature #6) */}
      {isTrackModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(62, 47, 35, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isTrackSubmitting) setIsTrackModalOpen(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              boxShadow: '0 20px 40px -8px rgba(62, 47, 35, 0.25)',
              border: '1px solid #EFEAE3',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconShieldLock size={22} color="var(--color-terracotta)" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-umber)' }}>
                  Track My Player
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTrackModalOpen(false)}
                disabled={isTrackSubmitting}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-umber-muted)' }}
              >
                <IconX size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--color-umber-muted)', margin: '0 0 16px 0', lineHeight: 1.4 }}>
              Select your name and enter your <strong>4-digit Player PIN</strong> to view your personalized queue status, set rest mode, and request pair-locks.
            </p>

            {trackError && (
              <div
                style={{
                  backgroundColor: 'rgba(217, 83, 79, 0.1)',
                  border: '1px solid rgba(217, 83, 79, 0.3)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '16px',
                  fontSize: '0.85rem',
                  color: '#D9534F',
                }}
              >
                {trackError}
              </div>
            )}

            <form onSubmit={handleClaimProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-umber)', marginBottom: '6px' }}>
                  Select Your Name
                </label>
                <select
                  value={trackPlayerId}
                  onChange={(e) => setTrackPlayerId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(62, 47, 35, 0.2)',
                    fontSize: '0.95rem',
                  }}
                >
                  <option value="">-- Choose from roster --</option>
                  {players
                    .filter((p) => p.status !== 'checked_out')
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.status.replace('_', ' ')})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-umber)', marginBottom: '6px' }}>
                  4-Digit Player PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="e.g. 4821"
                  value={trackPin}
                  onChange={(e) => setTrackPin(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(62, 47, 35, 0.2)',
                    fontSize: '1.25rem',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.25em',
                    textAlign: 'center',
                  }}
                />
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-umber-muted)', marginTop: '4px' }}>
                  Ask the host or check host console for your player PIN.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsTrackModalOpen(false)}
                  disabled={isTrackSubmitting}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid #D6C7B2',
                    backgroundColor: '#FFFFFF',
                    color: 'var(--color-umber)',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTrackSubmitting || !trackPlayerId || trackPin.length !== 4}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--color-olive)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    cursor: isTrackSubmitting || !trackPlayerId || trackPin.length !== 4 ? 'not-allowed' : 'pointer',
                    opacity: !trackPlayerId || trackPin.length !== 4 ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <IconCheck size={18} />
                  {isTrackSubmitting ? 'Verifying...' : 'Track Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
