'use client';

import React, { useState } from 'react';
import { Player, StaticRating } from '@/types/database';
import { RATING_TIERS, formatRating } from '@/lib/utils/rating-labels';
import { getPlayerPin } from '@/lib/utils/player-pin';
import { IconX, IconCheck, IconTrash, IconUserX, IconRefresh, IconLinkOff } from '@tabler/icons-react';

export interface ReplacementOption {
  id: string;
  name: string;
  info: string;
}

interface PlayerEditModalProps {
  isOpen: boolean;
  player: Player | null;
  joinPin?: string;
  isOnDeck: boolean; // true if in on-deck slot
  isSummoning?: boolean; // true if on active court in summoning stage (Issue 4)
  isLockedPair: boolean;
  queuedPlayers?: Player[]; // for backwards compatibility
  replacementCandidates?: ReplacementOption[]; // queue + cross-match on-deck candidates (Issue 5)
  onClose: () => void;
  onSaveEdits: (playerId: string, name: string, rating: StaticRating) => Promise<void>;
  onReplace?: (outgoingPlayerId: string, incomingPlayerId: string) => Promise<void>;
  onRetireForfeit?: (playerId: string) => void;
  onDissolvePair?: (playerId: string) => Promise<void>;
  onCheckoutPlayer?: (playerId: string) => Promise<void>;
}

export function PlayerEditModal({
  isOpen,
  player,
  joinPin,
  isOnDeck,
  isSummoning = false,
  isLockedPair,
  queuedPlayers = [],
  replacementCandidates,
  onClose,
  onSaveEdits,
  onReplace,
  onRetireForfeit,
  onDissolvePair,
  onCheckoutPlayer,
}: PlayerEditModalProps) {
  const [name, setName] = useState<string>(player?.name || '');
  const [rating, setRating] = useState<StaticRating>((player?.static_rating as StaticRating) ?? 0);
  const [showReplaceSelector, setShowReplaceSelector] = useState(false);
  const [selectedReplacementId, setSelectedReplacementId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prevPlayerId, setPrevPlayerId] = useState(player?.id);
  if (player && player.id !== prevPlayerId) {
    setPrevPlayerId(player.id);
    setName(player.name);
    setRating((player.static_rating as StaticRating) ?? 0);
    setShowReplaceSelector(false);
    setSelectedReplacementId('');
    setError(null);
  }

  if (!isOpen || !player) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await onSaveEdits(player.id, name.trim(), rating);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save edits';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteReplacement = async () => {
    if (!selectedReplacementId || !onReplace) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await onReplace(player.id, selectedReplacementId);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to replace player';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!onCheckoutPlayer) return;
    const isAlreadyHolding = player.status === 'checked_in';
    const confirmMsg = isAlreadyHolding
      ? `Permanently remove ${player.name} from this session?`
      : `Move ${player.name} back to the Check-in / Holding List?`;
    if (window.confirm(confirmMsg)) {
      try {
        setIsSubmitting(true);
        await onCheckoutPlayer(player.id);
        onClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to remove player';
        setError(msg);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDissolve = async () => {
    if (!onDissolvePair) return;
    if (window.confirm(`Dissolve locked pair for ${player.name}?`)) {
      try {
        setIsSubmitting(true);
        await onDissolvePair(player.id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to dissolve pair';
        setError(msg);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Status label
  const statusLabel =
    isSummoning
      ? 'Court Summoning (Waiting for Players)'
      : player.status === 'on_court'
      ? 'Active Court'
      : isOnDeck
      ? 'On-Deck Slot'
      : player.status === 'queued'
      ? 'Waiting Queue'
      : player.status === 'checked_in'
      ? 'Holding List'
      : player.status === 'resting'
      ? 'Resting'
      : player.status.toUpperCase().replace('_', ' ');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(62, 47, 35, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        backdropFilter: 'blur(4px)',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '440px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid rgba(62, 47, 35, 0.12)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(62, 47, 35, 0.08)',
            backgroundColor: 'var(--color-cream-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-umber)', margin: 0 }}>
              Edit Player
            </h3>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--color-umber-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '2px',
                flexWrap: 'wrap',
              }}
            >
              <span>Status: {statusLabel} • Elo {player.current_elo}</span>
              {joinPin && (
                <span
                  title="Player PIN for self-tracking on live page"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: 'rgba(62, 47, 35, 0.08)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontSize: '0.725rem',
                    color: 'var(--color-umber)',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  PIN: {getPlayerPin(player.id, joinPin)}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-umber-muted)',
              padding: '4px',
            }}
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Immediate Edit Form */}
        <form onSubmit={handleSave} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
          {error && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--color-alert-light)',
                color: 'var(--color-alert-dark)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.825rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Name input */}
          <div>
            <label
              htmlFor="edit-player-name"
              style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-umber)', marginBottom: '4px' }}
            >
              Player Name
            </label>
            <input
              id="edit-player-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(62, 47, 35, 0.25)',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            />
          </div>

          {/* Rating input */}
          <div>
            <label
              htmlFor="edit-player-rating"
              style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-umber)', marginBottom: '4px' }}
            >
              Star Rating
            </label>
            <select
              id="edit-player-rating"
              value={rating}
              onChange={(e) => setRating(parseInt(e.target.value, 10) as StaticRating)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(62, 47, 35, 0.25)',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            >
              {RATING_TIERS.map((tier) => (
                <option key={tier.value} value={tier.value}>
                  {tier.value === 0 ? 'Unrated (0)' : `${tier.label} (${tier.value})`}
                </option>
              ))}
            </select>
          </div>

          {/* Locked Pair Dissolution Option if active */}
          {isLockedPair && onDissolvePair && (
            <div style={{ paddingTop: '4px' }}>
              <button
                type="button"
                onClick={handleDissolve}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-cream-light)',
                  border: '1px dashed var(--color-olive)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-olive-dark)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <IconLinkOff size={14} /> Dissolve Locked Pair
              </button>
            </div>
          )}

          {/* Contextual Action: Direct Remove / Forfeit / Replace options */}
          <div style={{ paddingTop: '6px', borderTop: '1px solid rgba(62, 47, 35, 0.08)' }}>
            {/* Active Court: Retire / Forfeit */}
            {player.status === 'on_court' && onRetireForfeit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRetireForfeit(player.id);
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-alert-light)',
                  border: '1px solid rgba(184, 51, 42, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-alert-dark)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <IconUserX size={16} /> Retire / Forfeit Active Match
              </button>
            )}

            {/* On-Deck & Summoning: Replace Player Selector (Issue 4 & Issue 5) */}
            {(isOnDeck || isSummoning) && onReplace && (
              <div>
                {!showReplaceSelector ? (
                  <button
                    type="button"
                    onClick={() => setShowReplaceSelector(true)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: 'var(--color-olive-light)',
                      border: '1px solid rgba(85, 107, 47, 0.2)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-olive-dark)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <IconRefresh size={16} /> Substitute / Replace Player
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-olive-dark)' }}>
                      Select replacement player (from queue or other on-deck slot):
                    </label>
                    <select
                      value={selectedReplacementId}
                      onChange={(e) => setSelectedReplacementId(e.target.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid rgba(62, 47, 35, 0.2)',
                        fontSize: '0.85rem',
                      }}
                    >
                      <option value="">-- Choose replacement --</option>
                      {replacementCandidates && replacementCandidates.length > 0
                        ? replacementCandidates
                            .filter((c) => c.id !== player.id)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} — {c.info}
                              </option>
                            ))
                        : queuedPlayers
                            .filter((qp) => qp.id !== player.id)
                            .map((qp) => (
                              <option key={qp.id} value={qp.id}>
                                {qp.name} ({formatRating(qp.static_rating)})
                              </option>
                            ))}
                    </select>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setShowReplaceSelector(false)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--color-cream-dark)',
                          border: 'none',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteReplacement}
                        disabled={!selectedReplacementId || isSubmitting}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--color-olive)',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: !selectedReplacementId || isSubmitting ? 'not-allowed' : 'pointer',
                          opacity: !selectedReplacementId ? 0.6 : 1,
                        }}
                      >
                        Confirm Sub
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Queue / Holding / Resting: Direct Remove button */}
            {!isOnDeck && player.status !== 'on_court' && onCheckoutPlayer && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-cream-light)',
                  border: '1px solid rgba(184, 51, 42, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-alert-dark)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <IconTrash size={16} />{' '}
                {player.status === 'checked_in'
                  ? 'Remove Permanently from Session'
                  : 'Move to Check-in / Holding List'}
              </button>
            )}
          </div>

          {/* Footer Save / Cancel */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-cream-dark)',
                color: 'var(--color-umber)',
                fontWeight: 600,
                fontSize: '0.85rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-terracotta)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.85rem',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <IconCheck size={16} /> {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
