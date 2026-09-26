'use client';

import React, { useState, useEffect, use } from 'react';
import { Court, Match, Player, Session, PairLockRequest, StaticRating } from '@/types/database';
import { CourtZone } from '@/components/admin/CourtZone';
import { OnDeckZone } from '@/components/admin/OnDeckZone';
import { QueueZone } from '@/components/admin/QueueZone';
import { PairLockNotifications } from '@/components/admin/PairLockNotifications';
import { SessionSettingsDrawer } from '@/components/admin/SessionSettingsDrawer';
import { ScoreModal } from '@/components/admin/ScoreModal';
import { PlayerEditModal } from '@/components/admin/PlayerEditModal';
import { CallToCourtModal } from '@/components/admin/CallToCourtModal';
import { BulkImportModal } from '@/components/admin/BulkImportModal';
import { LeaderboardDrawer } from '@/components/admin/LeaderboardDrawer';
import { ShareSessionModal } from '@/components/admin/ShareSessionModal';
import { EndSessionModal } from '@/components/admin/EndSessionModal';
import { ParsedPlayer } from '@/lib/utils/parse-player-list';
import { StalledSlot, computeOnDeckCap } from '@/lib/engine/cap';
import { createClient } from '@/lib/supabase/client';
import { IconSettings, IconDeviceTv, IconRefresh, IconQrcode, IconDoorExit, IconAlertCircle } from '@tabler/icons-react';
import Link from 'next/link';

export default function AdminConsolePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const supabase = createClient();

  // Core State
  const [session, setSession] = useState<Session | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [lockedPairs, setLockedPairs] = useState<{ id: string; p1: string; p2: string }[]>([]);
  const [pairLockRequests, setPairLockRequests] = useState<PairLockRequest[]>([]);
  const [stalledSlots] = useState<Map<number, StalledSlot>>(new Map());
  const [loading, setLoading] = useState(true);

  // Modals State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isEndSessionOpen, setIsEndSessionOpen] = useState(false);
  const [selectedPlayerForEdit, setSelectedPlayerForEdit] = useState<{
    player: Player;
    isOnDeck: boolean;
    matchId?: string;
  } | null>(null);

  const [activeScoreModal, setActiveScoreModal] = useState<{
    courtId?: string;
    matchId: string;
    teamANames: string[];
    teamBNames: string[];
    isForfeit: boolean;
    forfeitedByTeam?: 'A' | 'B' | null;
  } | null>(null);

  const [activeCallModal, setActiveCallModal] = useState<{
    slotNumber: number;
    matchId: string;
  } | null>(null);

  // Load Session Data
  const loadData = React.useCallback(async () => {
    try {
      const [
        { data: sData },
        { data: cData },
        { data: mData },
        { data: pData },
        { data: lpData },
        { data: plrData },
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
        // Fallback to server history API if session was ended and blocked by anon RLS
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
          (lpData as { id: string; player_1_id: string; player_2_id: string }[]).map((lp) => ({
            id: lp.id,
            p1: lp.player_1_id,
            p2: lp.player_2_id,
          }))
        );
      }
      if (plrData) setPairLockRequests(plrData);
    } catch (err: unknown) {
      console.error('Failed to load session data', err);
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

    // Supabase Realtime subscriptions
    const channel = supabase
      .channel(`admin-session-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', filter: `session_id=eq.${sessionId}` }, () => {
        triggerDebouncedReload();
      })
      .subscribe();

    // Fallback polling interval (15 seconds) for safety net
    const pollInterval = setInterval(() => {
      if (!ignore) loadData();
    }, 15000);

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
        <p style={{ fontWeight: 600, color: 'var(--color-umber)' }}>Loading Host Admin Console...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--color-cream)', padding: '24px' }}>
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 'var(--radius-lg)', padding: '32px', maxWidth: '440px', width: '100%', textAlign: 'center', border: '1px solid rgba(62, 47, 35, 0.12)', boxShadow: 'var(--shadow-md)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-umber)', marginBottom: '8px' }}>Session Not Found</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-umber-muted)', marginBottom: '20px' }}>This session could not be found or has not generated data yet.</p>
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

  // Lookups
  const playersMap = new Map<string, Player>(players.map((p) => [p.id, p]));
  const lockedPairIds = new Set<string>();
  lockedPairs.forEach((lp) => {
    lockedPairIds.add(lp.p1);
    lockedPairIds.add(lp.p2);
  });

  // Capacity calculation
  const onDeckCap = computeOnDeckCap(courts.length, session.on_deck_cap_override);
  const capFormula = session.on_deck_cap_override
    ? `Override (${session.on_deck_cap_override})`
    : `max(1, ${courts.length} courts - 1) = ${onDeckCap}`;

  // On-deck slots
  const onDeckMatches = matches
    .filter((m) => m.stage === 'on_deck')
    .sort((a, b) => (a.on_deck_slot_number || 1) - (b.on_deck_slot_number || 1));

  const onDeckSlots: (Match | null)[] = [];
  for (let i = 1; i <= onDeckCap; i++) {
    const found = onDeckMatches.find((m) => m.on_deck_slot_number === i) || null;
    onDeckSlots.push(found);
  }

  const queuedPlayers = players.filter((p) => p.status === 'queued' || p.status === 'staged');
  const restingPlayers = players.filter((p) => p.status === 'resting');
  const checkedInPlayers = players.filter((p) => p.status === 'checked_in');
  const availableCourts = courts.filter((c) => c.status === 'available');

  // Handlers
  const handleStartMatch = async (courtId: string, matchId: string) => {
    await fetch(`/api/admin/${sessionId}/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start_match', courtId, matchId }),
    });
    loadData();
  };

  const handleCompleteMatchPrompt = (courtId: string, matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    const tANames = match.team_a_ids.map((id) => playersMap.get(id)?.name || 'Unknown');
    const tBNames = match.team_b_ids.map((id) => playersMap.get(id)?.name || 'Unknown');

    setActiveScoreModal({
      courtId,
      matchId,
      teamANames: tANames,
      teamBNames: tBNames,
      isForfeit: false,
    });
  };

  const handleRetireForfeitPrompt = (playerId: string) => {
    // Find active match containing this player
    const match = matches.find(
      (m) =>
        m.stage === 'in_match' &&
        (m.team_a_ids.includes(playerId) || m.team_b_ids.includes(playerId))
    );
    if (!match) return;

    const forfeitedByTeam = match.team_a_ids.includes(playerId) ? 'A' : 'B';
    const tANames = match.team_a_ids.map((id) => playersMap.get(id)?.name || 'Unknown');
    const tBNames = match.team_b_ids.map((id) => playersMap.get(id)?.name || 'Unknown');

    setActiveScoreModal({
      courtId: match.court_id || undefined,
      matchId: match.id,
      teamANames: tANames,
      teamBNames: tBNames,
      isForfeit: true,
      forfeitedByTeam,
    });
  };

  const handleScoreSubmit = async (scoreA: number, scoreB: number, winningTeam: 'A' | 'B') => {
    if (!activeScoreModal) return;
    const action = activeScoreModal.isForfeit ? 'forfeit' : 'complete_match';

    await fetch(`/api/admin/${sessionId}/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        courtId: activeScoreModal.courtId,
        matchId: activeScoreModal.matchId,
        scoreA,
        scoreB,
        winningTeam,
        forfeitedByTeam: activeScoreModal.forfeitedByTeam,
      }),
    });
    setActiveScoreModal(null);
    loadData();
  };

  const handleCallOnDeckToCourt = async (courtId: string, matchId: string) => {
    await fetch(`/api/admin/${sessionId}/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'call_to_court', matchId, courtId }),
    });
    loadData();
  };

  const handleNoShow = async (courtId: string, matchId: string, noShowPlayerId: string) => {
    await fetch(`/api/admin/${sessionId}/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'no_show', matchId, courtId, noShowPlayerId }),
    });
    loadData();
  };

  const handleCallToCourtSubmit = async (courtId: string) => {
    if (!activeCallModal) return;
    await fetch(`/api/admin/${sessionId}/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'call_to_court', matchId: activeCallModal.matchId, courtId }),
    });
    loadData();
  };

  const handleReroll = async (matchId: string) => {
    await fetch(`/api/admin/${sessionId}/on-deck`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reroll', matchId }),
    });
    loadData();
  };

  const handleRelaxBounds = async (matchId: string) => {
    await fetch(`/api/admin/${sessionId}/on-deck`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'relax_bounds', matchId }),
    });
    loadData();
  };

  const handleShiftToSocial = async (matchId: string) => {
    await fetch(`/api/admin/${sessionId}/on-deck`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'shift_to_social', matchId }),
    });
    loadData();
  };

  const handleAddPlayer = async (name: string, rating: StaticRating, status?: 'queued' | 'checked_in') => {
    const res = await fetch(`/api/admin/${sessionId}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, static_rating: rating, status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to add player' }));
      throw new Error(err.error || 'Failed to add player');
    }
    loadData();
  };

  const handleBulkImport = async (parsedList: ParsedPlayer[], destination: 'queued' | 'checked_in') => {
    const res = await fetch(`/api/admin/${sessionId}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bulk_import', players: parsedList, status: destination }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to import players' }));
      throw new Error(err.error || 'Failed to import players');
    }
    loadData();
  };

  const handleCheckInToQueue = async (playerIds: string[]) => {
    const res = await fetch(`/api/admin/${sessionId}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check_in_to_queue', playerIds }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to check in players' }));
      throw new Error(err.error || 'Failed to check in players');
    }
    loadData();
  };

  const handleCheckoutPlayer = async (playerId: string) => {
    const res = await fetch(`/api/admin/${sessionId}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'checkout', playerId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to remove player' }));
      throw new Error(err.error || 'Failed to remove player');
    }
    loadData();
  };

  const handleFillOnDeckSlots = async () => {
    await fetch(`/api/admin/${sessionId}/on-deck`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'fill_slots' }),
    });
    loadData();
  };

  const handleLockPair = async (p1: string, p2: string) => {
    await fetch(`/api/admin/${sessionId}/pair-lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', player1Id: p1, player2Id: p2 }),
    });
    loadData();
  };

  const handleDissolvePair = async (playerId: string) => {
    await fetch(`/api/admin/${sessionId}/pair-lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dissolve', playerId }),
    });
    loadData();
  };

  const handleApprovePairRequest = async (requestId: string) => {
    await fetch(`/api/admin/${sessionId}/pair-lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve_request', requestId }),
    });
    loadData();
  };

  const handleDismissPairRequest = async (requestId: string) => {
    await fetch(`/api/admin/${sessionId}/pair-lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss_request', requestId }),
    });
    loadData();
  };

  const handleSaveEdits = async (playerId: string, name: string, rating: StaticRating) => {
    await fetch(`/api/admin/${sessionId}/players`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, name, static_rating: rating }),
    });
    loadData();
  };

  const handleReplaceOnDeck = async (outgoingPlayerId: string, incomingPlayerId: string) => {
    if (!selectedPlayerForEdit?.matchId) return;
    await fetch(`/api/admin/${sessionId}/on-deck`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'replace_player',
        matchId: selectedPlayerForEdit.matchId,
        outgoingPlayerId,
        incomingPlayerId,
      }),
    });
    loadData();
  };

  const handleToggleResting = async (playerId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'resting' ? 'queued' : 'resting';
    await fetch(`/api/admin/${sessionId}/players`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, status: nextStatus }),
    });
    loadData();
  };

  const handleDirectDispatch = async (courtId: string) => {
    await fetch(`/api/admin/${sessionId}/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'direct_dispatch', courtId }),
    });
    loadData();
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-cream)', color: 'var(--color-umber)' }}>
      {/* Top Navigation Bar */}
      <header className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-terracotta)', letterSpacing: '0.05em' }}>
              HOST ADMIN CONSOLE
            </span>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-umber)', lineHeight: 1.2 }}>
              {session.name}
            </h1>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-cream-light)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(62, 47, 35, 0.1)',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)' }}>PIN:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-umber)' }}>
              {session.join_pin}
            </span>
          </div>
        </div>

        <div className="admin-header-actions">
          <button
            type="button"
            onClick={loadData}
            title="Refresh state"
            style={{
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-cream-light)',
              color: 'var(--color-umber)',
            }}
          >
            <IconRefresh size={18} />
          </button>

          <Link
            href={`/kiosk/${sessionId}`}
            target="_blank"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-cream-light)',
              color: 'var(--color-umber)',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <IconDeviceTv size={16} /> Open TV Kiosk
          </Link>

          <button
            type="button"
            onClick={() => setIsShareOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-cream-light)',
              color: 'var(--color-umber)',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: '1px solid rgba(62, 47, 35, 0.1)',
              cursor: 'pointer',
            }}
          >
            <IconQrcode size={16} style={{ color: 'var(--color-terracotta)' }} /> Share QR / Link
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-cream-dark)',
              color: 'var(--color-umber)',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <IconSettings size={16} /> Settings
          </button>

          <button
            type="button"
            onClick={() => setIsEndSessionOpen(true)}
            title="End this session"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(217, 83, 79, 0.08)',
              color: '#D9534F',
              border: '1px solid rgba(217, 83, 79, 0.3)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <IconDoorExit size={16} /> End Session
          </button>
        </div>
      </header>

      {!session.is_active && (
        <div
          style={{
            backgroundColor: 'rgba(217, 83, 79, 0.08)',
            borderBottom: '1px solid rgba(217, 83, 79, 0.25)',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#D9534F', fontWeight: 600, fontSize: '0.875rem' }}>
            <IconAlertCircle size={18} />
            <span>This session was ended. Live court rotations and score entry are concluded.</span>
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
              gap: '6px',
            }}
          >
            View Session Audit &amp; Export Logs →
          </Link>
        </div>
      )}

      {/* Main Content Area: 3 Zones */}
      <main className="admin-main">
        {/* Pair Lock Approval Notifications */}
        <PairLockNotifications
          requests={pairLockRequests}
          playersMap={playersMap}
          onApprove={handleApprovePairRequest}
          onDismiss={handleDismissPairRequest}
        />

        {/* Zone 1: Active Courts */}
        <CourtZone
          courts={courts}
          matches={matches}
          playersMap={playersMap}
          lockedPairIds={lockedPairIds}
          hasOnDeckSlots={onDeckMatches.length > 0}
          onTapPlayer={(player) => setSelectedPlayerForEdit({ player, isOnDeck: false })}
          onStartMatch={handleStartMatch}
          onCompleteMatch={handleCompleteMatchPrompt}
          onNoShow={handleNoShow}
          onDirectDispatch={handleDirectDispatch}
          onCallOnDeckToCourt={handleCallOnDeckToCourt}
        />

        {/* Zone 2: On-Deck Matchups */}
        <OnDeckZone
          slots={onDeckSlots}
          stalledSlots={stalledSlots}
          onDeckCap={onDeckCap}
          capFormula={capFormula}
          playersMap={playersMap}
          lockedPairIds={lockedPairIds}
          onTapPlayer={(player) => {
            const m = onDeckMatches.find(
              (match) => match.team_a_ids.includes(player.id) || match.team_b_ids.includes(player.id)
            );
            setSelectedPlayerForEdit({ player, isOnDeck: true, matchId: m?.id });
          }}
          onCallToCourt={(slotNumber, matchId) => setActiveCallModal({ slotNumber, matchId })}
          onReroll={handleReroll}
          onRelaxBounds={handleRelaxBounds}
          onShiftToSocial={handleShiftToSocial}
        />

        {/* Zone 3: Queue & Roster */}
        <QueueZone
          queuedPlayers={queuedPlayers}
          restingPlayers={restingPlayers}
          checkedInPlayers={checkedInPlayers}
          lockedPairIds={lockedPairIds}
          onAddPlayer={handleAddPlayer}
          onLockPair={handleLockPair}
          onToggleResting={handleToggleResting}
          onTapPlayer={(player) => setSelectedPlayerForEdit({ player, isOnDeck: false })}
          onCheckInToQueue={handleCheckInToQueue}
          onCheckoutPlayer={handleCheckoutPlayer}
          onOpenBulkImport={() => setIsBulkImportOpen(true)}
          onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
          onFillOnDeckSlots={handleFillOnDeckSlots}
        />
      </main>

      {/* Modals */}
      <PlayerEditModal
        isOpen={!!selectedPlayerForEdit}
        player={selectedPlayerForEdit?.player || null}
        joinPin={session.join_pin}
        isOnDeck={selectedPlayerForEdit?.isOnDeck || false}
        isLockedPair={selectedPlayerForEdit ? lockedPairIds.has(selectedPlayerForEdit.player.id) : false}
        queuedPlayers={queuedPlayers}
        onClose={() => setSelectedPlayerForEdit(null)}
        onSaveEdits={handleSaveEdits}
        onReplace={handleReplaceOnDeck}
        onRetireForfeit={handleRetireForfeitPrompt}
        onDissolvePair={handleDissolvePair}
        onCheckoutPlayer={handleCheckoutPlayer}
      />

      {activeScoreModal && (
        <ScoreModal
          isOpen={true}
          teamANames={activeScoreModal.teamANames}
          teamBNames={activeScoreModal.teamBNames}
          isForfeit={activeScoreModal.isForfeit}
          forfeitedByTeam={activeScoreModal.forfeitedByTeam}
          scoringRequired={session.scoring_required}
          onClose={() => setActiveScoreModal(null)}
          onSubmit={handleScoreSubmit}
        />
      )}

      {activeCallModal && (
        <CallToCourtModal
          isOpen={true}
          slotNumber={activeCallModal.slotNumber}
          availableCourts={availableCourts}
          onClose={() => setActiveCallModal(null)}
          onCall={handleCallToCourtSubmit}
        />
      )}

      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onImport={handleBulkImport}
      />

      <LeaderboardDrawer
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        session={session}
        players={players}
        matches={matches}
      />

      <ShareSessionModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        sessionId={sessionId}
        sessionName={session.name}
        joinPin={session.join_pin}
      />

      <EndSessionModal
        isOpen={isEndSessionOpen}
        onClose={() => setIsEndSessionOpen(false)}
        sessionId={sessionId}
        sessionName={session.name}
        activeMatchCount={matches.filter((m) => m.stage === 'in_match' || m.stage === 'summoning').length}
        completedMatchCount={matches.filter((m) => m.stage === 'completed').length}
      />

      <SessionSettingsDrawer
        isOpen={isSettingsOpen}
        session={session}
        onClose={() => setIsSettingsOpen(false)}
        onEndSessionClick={() => {
          setIsSettingsOpen(false);
          setIsEndSessionOpen(true);
        }}
        onUpdateSettings={async (updates) => {
          await fetch(`/api/admin/${sessionId}/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          });
          loadData();
        }}
      />
    </div>
  );
}
