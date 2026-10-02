'use client';

import React, { useState, useMemo } from 'react';
import { parsePlayerList, ParsedPlayer } from '@/lib/utils/parse-player-list';
import { formatRating } from '@/lib/utils/rating-labels';
import { IconUsers, IconX, IconCheck, IconTrash } from '@tabler/icons-react';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (players: ParsedPlayer[], destination: 'queued' | 'checked_in') => Promise<void>;
}

export function BulkImportModal({
  isOpen,
  onClose,
  onImport,
}: BulkImportModalProps) {
  const [rawText, setRawText] = useState('');
  const [destination, setDestination] = useState<'queued' | 'checked_in'>('queued');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live parsed list (defaults rating to 0 Unrated)
  const parsedPlayers = useMemo(() => {
    return parsePlayerList(rawText, 0);
  }, [rawText]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedPlayers.length === 0) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await onImport(parsedPlayers, destination);
      setRawText('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to import players';
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
        backgroundColor: 'rgba(62, 47, 35, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '540px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid rgba(62, 47, 35, 0.12)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(62, 47, 35, 0.08)',
            backgroundColor: 'var(--color-cream-light)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--color-terracotta)' }}>
              <IconUsers size={20} />
            </span>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-umber)', margin: 0 }}>
              Bulk Player Import
            </h3>
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
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-umber-muted)', margin: 0 }}>
              Paste player names. Supports numbered lists, commas, or newlines (e.g. from a spreadsheet or chat). Players enter the Holding List and ratings can be assigned anytime.
            </p>

            {error && (
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'var(--color-alert-light)',
                  color: 'var(--color-alert-dark)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                }}
              >
                {error}
              </div>
            )}

            {/* Input area */}
            <div>
              <label
                htmlFor="bulk-player-textarea"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--color-umber)',
                  marginBottom: '6px',
                }}
              >
                Player Names
              </label>
              <textarea
                id="bulk-player-textarea"
                rows={7}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`Alice Smith\nBob Jones\nCharlie Brown\nDiana Prince`}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(62, 47, 35, 0.2)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  lineHeight: '1.4',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Destination Selection (Queue vs Holding List) */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--color-umber)',
                  marginBottom: '6px',
                }}
              >
                Import Destination
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setDestination('queued')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: destination === 'queued' ? '2px solid var(--color-terracotta)' : '1px solid rgba(62, 47, 35, 0.2)',
                    backgroundColor: destination === 'queued' ? 'var(--color-cream-light)' : '#FFFFFF',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.825rem', color: destination === 'queued' ? 'var(--color-terracotta)' : 'var(--color-umber)' }}>
                    ⚡ Active Queue (Checked In)
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--color-umber-muted)', marginTop: '2px' }}>
                    Ready to play; immediately eligible for on-deck matches
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDestination('checked_in')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: destination === 'checked_in' ? '2px solid var(--color-olive)' : '1px solid rgba(62, 47, 35, 0.2)',
                    backgroundColor: destination === 'checked_in' ? 'var(--color-cream-light)' : '#FFFFFF',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.825rem', color: destination === 'checked_in' ? 'var(--color-olive-dark)' : 'var(--color-umber)' }}>
                    📋 Holding List (Pre-Registered)
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--color-umber-muted)', marginTop: '2px' }}>
                    Wait in holding list; host or player checks in later
                  </div>
                </button>
              </div>
            </div>

            {/* Live Preview */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-umber)' }}>
                  Preview ({parsedPlayers.length} detected)
                </span>
                {parsedPlayers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRawText('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '0.75rem',
                      color: 'var(--color-terracotta)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    <IconTrash size={12} /> Clear
                  </button>
                )}
              </div>

              {parsedPlayers.length === 0 ? (
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--color-cream-light)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px dashed rgba(62, 47, 35, 0.2)',
                    textAlign: 'center',
                    fontSize: '0.8rem',
                    color: 'var(--color-umber-muted)',
                  }}
                >
                  Type or paste players above to preview list.
                </div>
              ) : (
                <div
                  style={{
                    maxHeight: '160px',
                    overflowY: 'auto',
                    border: '1px solid rgba(62, 47, 35, 0.1)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-cream-light)',
                  }}
                >
                  {parsedPlayers.map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 12px',
                        borderBottom:
                          idx < parsedPlayers.length - 1 ? '1px solid rgba(62, 47, 35, 0.06)' : 'none',
                        fontSize: '0.825rem',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--color-umber)' }}>
                        {idx + 1}. {p.name}
                      </span>
                      <span
                        style={{
                          backgroundColor: 'var(--color-cream-dark)',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--color-umber-muted)',
                        }}
                      >
                        {formatRating(p.rating)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid rgba(62, 47, 35, 0.08)',
              display: 'flex',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
              gap: '10px',
              backgroundColor: '#FAFAF8',
            }}
          >
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
                fontSize: '0.875rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={parsedPlayers.length === 0 || isSubmitting}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-terracotta)',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '0.875rem',
                border: 'none',
                cursor: parsedPlayers.length === 0 || isSubmitting ? 'not-allowed' : 'pointer',
                opacity: parsedPlayers.length === 0 || isSubmitting ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <IconCheck size={16} />
              {isSubmitting
                ? 'Importing...'
                : `Import ${parsedPlayers.length} Player${parsedPlayers.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
