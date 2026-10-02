'use client';

import React, { useState } from 'react';
import { Player, StaticRating } from '@/types/database';
import { useNow } from '@/lib/hooks/useNow';
import { formatRating } from '@/lib/utils/rating-labels';
import {
  IconUserPlus,
  IconLink,
  IconClock,
  IconMoon,
  IconPlayerPlay,
  IconUsers,
  IconCheck,
  IconTrash,
  IconPencil,
  IconTrophy,
  IconBolt,
} from '@tabler/icons-react';

interface QueueZoneProps {
  queuedPlayers: Player[];
  restingPlayers: Player[];
  checkedInPlayers: Player[];
  lockedPairIds: Set<string>;
  onAddPlayer: (name: string, rating: StaticRating, status?: 'queued' | 'checked_in') => Promise<void>;
  onLockPair: (player1Id: string, player2Id: string) => Promise<void>;
  onToggleResting: (playerId: string, currentStatus: string) => Promise<void>;
  onTapPlayer?: (player: Player) => void;
  onCheckInToQueue: (playerIds: string[]) => Promise<void>;
  onCheckoutPlayer: (playerId: string) => Promise<void>;
  onOpenBulkImport: () => void;
  onOpenLeaderboard?: () => void;
  onFillOnDeckSlots?: () => Promise<void>;
}

export function QueueZone({
  queuedPlayers,
  restingPlayers,
  checkedInPlayers,
  lockedPairIds,
  onAddPlayer,
  onLockPair,
  onToggleResting,
  onTapPlayer,
  onCheckInToQueue,
  onCheckoutPlayer,
  onOpenBulkImport,
  onOpenLeaderboard,
  onFillOnDeckSlots,
}: QueueZoneProps) {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [checkInDirectly, setCheckInDirectly] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isCheckingInAll, setIsCheckingInAll] = useState(false);
  const [isAutoFilling, setIsAutoFilling] = useState(false);

  // Pair locking builder state
  const [pairP1, setPairP1] = useState('');
  const [pairP2, setPairP2] = useState('');
  const [isLocking, setIsLocking] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const nowMs = useNow();

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    try {
      setIsAdding(true);
      setAddError(null);
      // Defaults rating to 0 (Unrated) per user feedback
      await onAddPlayer(newPlayerName.trim(), 0, checkInDirectly ? 'queued' : 'checked_in');
      setNewPlayerName('');
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to add player');
    } finally {
      setIsAdding(false);
    }
  };

  const handleCheckInAll = async () => {
    if (checkedInPlayers.length === 0) return;
    try {
      setIsCheckingInAll(true);
      await onCheckInToQueue(checkedInPlayers.map((p) => p.id));
    } finally {
      setIsCheckingInAll(false);
    }
  };

  const handleRemove = async (player: Player) => {
    if (window.confirm(`Remove ${player.name} from the session rotation?`)) {
      await onCheckoutPlayer(player.id);
    }
  };

  const handleAutoFill = async () => {
    if (!onFillOnDeckSlots) return;
    try {
      setIsAutoFilling(true);
      await onFillOnDeckSlots();
    } finally {
      setIsAutoFilling(false);
    }
  };

  const handleLockPair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairP1 || !pairP2 || pairP1 === pairP2) return;
    try {
      setIsLocking(true);
      setPairError(null);
      await onLockPair(pairP1, pairP2);
      setPairP1('');
      setPairP2('');
    } catch (err: unknown) {
      setPairError(err instanceof Error ? err.message : 'Failed to lock pair');
    } finally {
      setIsLocking(false);
    }
  };

  return (
    <section>
      {/* Zone Header with Leaderboard & Bulk Import buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-umber)', margin: 0 }}>
            Queue &amp; Roster Management
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-umber-muted)', margin: '4px 0 0' }}>
            Queue takes priority ({queuedPlayers.length}) • Resting ({restingPlayers.length}) • Holding List ({checkedInPlayers.length})
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onFillOnDeckSlots && queuedPlayers.length >= 4 && (
            <button
              type="button"
              onClick={handleAutoFill}
              disabled={isAutoFilling}
              title="Automatically compose available on-deck slots from queued players"
              style={{
                padding: '8px 14px',
                backgroundColor: 'var(--color-olive-light)',
                border: '1px solid rgba(85, 107, 47, 0.25)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.825rem',
                fontWeight: 700,
                color: 'var(--color-olive-dark)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <IconBolt size={16} /> {isAutoFilling ? 'Filling...' : 'Auto-Fill On-Deck'}
            </button>
          )}

          {onOpenLeaderboard && (
            <button
              type="button"
              onClick={onOpenLeaderboard}
              style={{
                padding: '8px 14px',
                backgroundColor: 'var(--color-cream-dark)',
                border: '1px solid rgba(62, 47, 35, 0.15)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.825rem',
                fontWeight: 700,
                color: 'var(--color-umber)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <IconTrophy size={16} style={{ color: 'var(--color-terracotta)' }} /> Live Leaderboard
            </button>
          )}

          <button
            type="button"
            onClick={onOpenBulkImport}
            style={{
              padding: '8px 14px',
              backgroundColor: 'var(--color-terracotta)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.825rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <IconUsers size={16} /> Bulk Import
          </button>
        </div>
      </div>

      {/* PRIMARY SECTION: Queue takes priority over Holding List (Issue #2) */}
      <div className="responsive-grid-queue" style={{ marginBottom: '24px' }}>
        {/* 1. Off-Court Queue */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(62, 47, 35, 0.12)',
            padding: '16px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  backgroundColor: queuedPlayers.length > 0 ? 'var(--color-terracotta)' : 'var(--color-cream-dark)',
                  color: queuedPlayers.length > 0 ? '#FFFFFF' : 'var(--color-umber)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {queuedPlayers.length}
              </span>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-umber)', margin: 0 }}>
                Off-Court Queue
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)' }}>
              (Tap card to edit name/rating)
            </span>
          </div>

          {queuedPlayers.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-umber-muted)' }}>
              Queue is empty. Check in players from the holding list below or wait for active matches to conclude.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
              {queuedPlayers.map((player) => {
                const waitMinutes = nowMs
                  ? Math.floor((nowMs - new Date(player.wait_started_at).getTime()) / (60 * 1000))
                  : 0;

                return (
                  <div
                    key={player.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: 'var(--color-cream-light)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(62, 47, 35, 0.1)',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    {/* Tappable player card portion */}
                    <div
                      onClick={() => onTapPlayer && onTapPlayer(player)}
                      style={{
                        flex: 1,
                        cursor: onTapPlayer ? 'pointer' : 'default',
                        paddingRight: '8px',
                      }}
                      title="Tap to edit name / rating"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-umber)' }}>
                          {player.name}
                        </span>
                        {player.status === 'staged' && (
                          <span
                            title="Player is assigned to an On-Deck match"
                            style={{
                              backgroundColor: 'var(--color-terracotta)',
                              color: '#FFFFFF',
                              padding: '1px 7px',
                              borderRadius: '10px',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                            }}
                          >
                            <IconBolt size={11} /> On-Deck
                          </span>
                        )}
                        {lockedPairIds.has(player.id) && (
                          <span title="Locked Pair" style={{ color: 'var(--color-olive-dark)' }}>
                            <IconLink size={14} />
                          </span>
                        )}
                        <IconPencil size={12} style={{ color: 'var(--color-umber-muted)', opacity: 0.6 }} />
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)' }}>
                        {formatRating(player.static_rating)} • Elo {player.current_elo} •{' '}
                        <IconClock size={12} style={{ verticalAlign: 'middle' }} /> {waitMinutes}m wait
                      </div>
                    </div>

                    {/* Actions: Rest + Remove */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {player.status === 'staged' ? (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'var(--color-terracotta)',
                            backgroundColor: 'rgba(217, 83, 79, 0.1)',
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          Up Next
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onToggleResting(player.id, player.status)}
                            title="Set to resting"
                            style={{
                              padding: '4px 8px',
                              backgroundColor: 'var(--color-cream-dark)',
                              color: 'var(--color-umber)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <IconMoon size={12} /> Rest
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemove(player)}
                            title="Remove / Checkout"
                            style={{
                              padding: '4px 6px',
                              backgroundColor: 'transparent',
                              color: 'var(--color-alert-dark)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.75rem',
                              border: '1px solid rgba(184, 51, 42, 0.2)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <IconTrash size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Resting Players */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(62, 47, 35, 0.12)',
            padding: '16px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  backgroundColor: 'var(--color-cream-dark)',
                  color: 'var(--color-umber)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {restingPlayers.length}
              </span>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-umber)', margin: 0 }}>
                Resting Players
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)' }}>
              (Tap card to edit)
            </span>
          </div>

          {restingPlayers.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-umber-muted)' }}>
              No players currently resting.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
              {restingPlayers.map((player) => (
                <div
                  key={player.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: 'var(--color-cream-light)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(62, 47, 35, 0.08)',
                    opacity: 0.9,
                  }}
                >
                  <div
                    onClick={() => onTapPlayer && onTapPlayer(player)}
                    style={{
                      flex: 1,
                      cursor: onTapPlayer ? 'pointer' : 'default',
                      paddingRight: '8px',
                    }}
                    title="Tap to edit name / rating"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-umber)' }}>
                        {player.name}
                      </span>
                      <IconPencil size={12} style={{ color: 'var(--color-umber-muted)', opacity: 0.6 }} />
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)' }}>
                      {formatRating(player.static_rating)} • Elo {player.current_elo}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => onToggleResting(player.id, player.status)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'var(--color-olive-light)',
                        color: 'var(--color-olive-dark)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <IconPlayerPlay size={12} /> Resume
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemove(player)}
                      title="Remove / Checkout"
                      style={{
                        padding: '4px 6px',
                        backgroundColor: 'transparent',
                        color: 'var(--color-alert-dark)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        border: '1px solid rgba(184, 51, 42, 0.2)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <IconTrash size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Add Player & Pair Builder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Add Player Form (Issue #4: Rating dropdown removed, defaults to 0.0 Unrated) */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(62, 47, 35, 0.12)',
              padding: '16px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
              }}
            >
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-umber)', margin: 0 }}>
                Check In Player
              </h4>
              <button
                type="button"
                onClick={onOpenBulkImport}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-terracotta)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <IconUsers size={14} /> Bulk Paste
              </button>
            </div>

            {addError && (
              <div
                style={{
                  padding: '8px 10px',
                  backgroundColor: 'var(--color-alert-light)',
                  color: 'var(--color-alert-dark)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  marginBottom: '10px',
                }}
              >
                {addError}
              </div>
            )}

            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Player full name"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  required
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(62, 47, 35, 0.2)',
                    fontSize: '0.875rem',
                  }}
                />
                <button
                  type="submit"
                  disabled={isAdding}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: checkInDirectly ? 'var(--color-terracotta)' : 'var(--color-olive)',
                    color: '#FFFFFF',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <IconUserPlus size={16} />
                  {isAdding ? 'Adding...' : checkInDirectly ? 'Check In to Queue' : 'Add to Holding'}
                </button>
              </div>

              {/* Direct Queue Checkbox Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <input
                  type="checkbox"
                  id="checkInDirectly"
                  checked={checkInDirectly}
                  onChange={(e) => setCheckInDirectly(e.target.checked)}
                  style={{ cursor: 'pointer', accentColor: 'var(--color-terracotta)' }}
                />
                <label
                  htmlFor="checkInDirectly"
                  style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--color-umber)', cursor: 'pointer' }}
                >
                  Check in directly to active queue (ready to play)
                </label>
              </div>
            </form>
            <p style={{ fontSize: '0.725rem', color: 'var(--color-umber-muted)', margin: '6px 0 0' }}>
              {checkInDirectly
                ? 'Player joins the active queue directly (Unrated). Eligible for on-deck matches immediately.'
                : 'Player enters Check-In Holding List below (Unrated). Admit to queue when player arrives.'}
            </p>
          </div>

          {/* Pair Locking Builder */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(62, 47, 35, 0.12)',
              padding: '16px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-umber)', marginBottom: '10px' }}>
              Lock Pair Together
            </h4>
            {pairError && (
              <div
                style={{
                  padding: '8px 10px',
                  backgroundColor: 'var(--color-alert-light)',
                  color: 'var(--color-alert-dark)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  marginBottom: '10px',
                }}
              >
                {pairError}
              </div>
            )}
            <form onSubmit={handleLockPair} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <select
                value={pairP1}
                onChange={(e) => setPairP1(e.target.value)}
                required
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(62, 47, 35, 0.2)',
                  fontSize: '0.85rem',
                }}
              >
                <option value="">-- Select Player 1 --</option>
                {queuedPlayers
                  .filter((p) => !lockedPairIds.has(p.id) && p.id !== pairP2)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatRating(p.static_rating)})
                    </option>
                  ))}
              </select>

              <select
                value={pairP2}
                onChange={(e) => setPairP2(e.target.value)}
                required
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(62, 47, 35, 0.2)',
                  fontSize: '0.85rem',
                }}
              >
                <option value="">-- Select Player 2 --</option>
                {queuedPlayers
                  .filter((p) => !lockedPairIds.has(p.id) && p.id !== pairP1)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatRating(p.static_rating)})
                    </option>
                  ))}
              </select>

              <button
                type="submit"
                disabled={!pairP1 || !pairP2 || isLocking}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--color-olive)',
                  color: '#FFFFFF',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  border: 'none',
                  cursor: !pairP1 || !pairP2 ? 'not-allowed' : 'pointer',
                  opacity: !pairP1 || !pairP2 ? 0.6 : 1,
                }}
              >
                <IconLink size={16} /> Create Locked Pair
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* SECONDARY SECTION: Check-In Holding List (Moved below Queue per Issue #2) */}
      <div
        style={{
          backgroundColor: checkedInPlayers.length > 0 ? '#FFFDF8' : '#FFFFFF',
          borderRadius: 'var(--radius-md)',
          border:
            checkedInPlayers.length > 0
              ? '2px solid var(--color-olive)'
              : '1px solid rgba(62, 47, 35, 0.12)',
          padding: '16px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                backgroundColor: checkedInPlayers.length > 0 ? 'var(--color-olive)' : 'var(--color-cream-dark)',
                color: checkedInPlayers.length > 0 ? '#FFFFFF' : 'var(--color-umber)',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              {checkedInPlayers.length}
            </span>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-umber)', margin: 0 }}>
              Check-In Holding List
            </h3>
            {checkedInPlayers.length > 0 && (
              <span
                style={{
                  backgroundColor: 'rgba(217, 83, 79, 0.12)',
                  color: '#D9534F',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                }}
              >
                Needs Host Approval
              </span>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)' }}>
              (Player join requests and holding players wait here before queue admittance)
            </span>
          </div>

          {checkedInPlayers.length > 0 && (
            <button
              type="button"
              onClick={handleCheckInAll}
              disabled={isCheckingInAll}
              style={{
                padding: '6px 14px',
                backgroundColor: 'var(--color-olive)',
                color: '#FFFFFF',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <IconCheck size={14} /> Approve &amp; Admit All ({checkedInPlayers.length})
            </button>
          )}
        </div>

        {checkedInPlayers.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--color-umber-muted)', margin: 0 }}>
            Holding list is empty. Add players above or use Bulk Import to populate.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '10px',
              marginTop: '12px',
            }}
          >
            {checkedInPlayers.map((player) => (
              <div
                key={player.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(62, 47, 35, 0.15)',
                }}
              >
                <div
                  onClick={() => onTapPlayer && onTapPlayer(player)}
                  style={{
                    flex: 1,
                    cursor: onTapPlayer ? 'pointer' : 'default',
                    paddingRight: '8px',
                  }}
                  title="Click to edit name/rating"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-umber)' }}>
                      {player.name}
                    </span>
                    <IconPencil size={12} style={{ color: 'var(--color-umber-muted)', opacity: 0.6 }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)' }}>
                    {formatRating(player.static_rating)} • Elo {player.current_elo}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => onCheckInToQueue([player.id])}
                    title="Admit to queue"
                    style={{
                      padding: '4px 10px',
                      backgroundColor: 'var(--color-olive-light)',
                      color: 'var(--color-olive-dark)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <IconCheck size={12} /> Check In
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemove(player)}
                    title="Remove player"
                    style={{
                      padding: '4px 6px',
                      backgroundColor: 'transparent',
                      color: 'var(--color-alert-dark)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      border: '1px solid rgba(184, 51, 42, 0.2)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <IconTrash size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
