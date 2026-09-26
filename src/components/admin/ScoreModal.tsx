'use client';

import React, { useState } from 'react';
import { IconTrophy, IconCheck, IconX } from '@tabler/icons-react';

interface ScoreModalProps {
  isOpen: boolean;
  teamANames: string[];
  teamBNames: string[];
  isForfeit?: boolean;
  forfeitedByTeam?: 'A' | 'B' | null;
  scoringRequired?: boolean;
  onClose: () => void;
  onSubmit: (scoreA: number, scoreB: number, winningTeam: 'A' | 'B') => Promise<void>;
}

export function ScoreModal({
  isOpen,
  teamANames,
  teamBNames,
  isForfeit = false,
  forfeitedByTeam = null,
  scoringRequired = true,
  onClose,
  onSubmit,
}: ScoreModalProps) {
  // Determine default winner
  const defaultWinner: 'A' | 'B' = forfeitedByTeam === 'A' ? 'B' : forfeitedByTeam === 'B' ? 'A' : 'A';
  const [winningTeam, setWinningTeam] = useState<'A' | 'B'>(defaultWinner);
  const [scoreA, setScoreA] = useState<string>('');
  const [scoreB, setScoreB] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectWinner = (team: 'A' | 'B') => {
    if (isForfeit) return; // Forfeited team cannot win
    setWinningTeam(team);
    if (scoringRequired && scoreA.trim() !== '' && scoreB.trim() !== '') {
      const curA = parseInt(scoreA, 10) || 0;
      const curB = parseInt(scoreB, 10) || 0;
      if (team === 'A' && curA <= curB) {
        setScoreA(String(Math.max(11, curB + 1)));
      } else if (team === 'B' && curB <= curA) {
        setScoreB(String(Math.max(11, curA + 1)));
      }
    }
  };

  const handleScoreAChange = (val: string) => {
    setScoreA(val);
    const numA = parseInt(val, 10);
    const numB = parseInt(scoreB, 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      if (numA > numB) setWinningTeam('A');
      else if (numB > numA) setWinningTeam('B');
    }
  };

  const handleScoreBChange = (val: string) => {
    setScoreB(val);
    const numA = parseInt(scoreA, 10);
    const numB = parseInt(val, 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      if (numA > numB) setWinningTeam('A');
      else if (numB > numA) setWinningTeam('B');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let numA = 0;
    let numB = 0;

    if (scoringRequired) {
      if (scoreA.trim() === '' || scoreB.trim() === '') {
        setError('Please enter scores for both teams.');
        return;
      }

      numA = parseInt(scoreA, 10);
      numB = parseInt(scoreB, 10);

      if (isNaN(numA) || isNaN(numB) || numA < 0 || numB < 0) {
        setError('Scores must be non-negative numbers');
        return;
      }

      if (numA === numB) {
        setError('A winner must be decided (scores cannot be tied).');
        return;
      }

      // Ensure winner matches higher score
      if ((winningTeam === 'A' && numA <= numB) || (winningTeam === 'B' && numB <= numA)) {
        setError(`Winning Team ${winningTeam} must have a higher score.`);
        return;
      }
    } else {
      // Unscored mode: binary 1-0 or 11-9 representation
      numA = winningTeam === 'A' ? 11 : 0;
      numB = winningTeam === 'B' ? 11 : 0;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit(numA, numB, winningTeam);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit match outcome';
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
          maxWidth: '480px',
          maxHeight: '90vh',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid rgba(62, 47, 35, 0.12)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
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
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--color-terracotta)' }}>
              <IconTrophy size={20} />
            </span>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-umber)', margin: 0 }}>
              {isForfeit ? 'Confirm Forfeit Result' : 'Complete Match — Who Won?'}
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
            }}
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', overflowY: 'auto' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-umber-muted)', marginTop: 0, marginBottom: '16px' }}>
            {isForfeit
              ? `Team ${forfeitedByTeam} has retired/forfeited. Confirm the departure score.`
              : 'Select the winning team below to update standings, wins/losses, and Elo rankings.'}
          </p>

          {error && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--color-alert-light)',
                color: 'var(--color-alert-dark)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontWeight: 600,
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          {/* Winner Selection Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            {/* Team A Card */}
            <div
              onClick={() => handleSelectWinner('A')}
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: winningTeam === 'A' ? '2px solid var(--color-olive)' : '1px solid rgba(62, 47, 35, 0.15)',
                backgroundColor: winningTeam === 'A' ? '#F7F9F2' : '#FFFFFF',
                cursor: isForfeit ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
              }}
            >
              {winningTeam === 'A' && (
                <span
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    backgroundColor: 'var(--color-olive)',
                    color: '#FFFFFF',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <IconCheck size={12} /> WINNER
                </span>
              )}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-olive-dark)', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  TEAM A {forfeitedByTeam === 'A' && '(FORFEIT)'}
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-umber)', lineHeight: 1.3 }}>
                  {teamANames.join(' & ')}
                </div>
              </div>
            </div>

            {/* Team B Card */}
            <div
              onClick={() => handleSelectWinner('B')}
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: winningTeam === 'B' ? '2px solid var(--color-olive)' : '1px solid rgba(62, 47, 35, 0.15)',
                backgroundColor: winningTeam === 'B' ? '#F7F9F2' : '#FFFFFF',
                cursor: isForfeit ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
              }}
            >
              {winningTeam === 'B' && (
                <span
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    backgroundColor: 'var(--color-olive)',
                    color: '#FFFFFF',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <IconCheck size={12} /> WINNER
                </span>
              )}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-olive-dark)', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  TEAM B {forfeitedByTeam === 'B' && '(FORFEIT)'}
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-umber)', lineHeight: 1.3 }}>
                  {teamBNames.join(' & ')}
                </div>
              </div>
            </div>
          </div>

          {/* Optional Numeric Scores (Only if scoring is required) */}
          {scoringRequired && (
            <div
              style={{
                padding: '16px',
                backgroundColor: 'var(--color-cream-light)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '20px',
                border: '1px solid rgba(62, 47, 35, 0.08)',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-umber)', marginBottom: '10px', textAlign: 'center' }}>
                Enter Match Score
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)', marginBottom: '4px' }}>Team A</div>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={scoreA}
                    onChange={(e) => handleScoreAChange(e.target.value)}
                    required
                    style={{
                      width: '70px',
                      height: '48px',
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      textAlign: 'center',
                      borderRadius: 'var(--radius-sm)',
                      border: winningTeam === 'A' ? '2px solid var(--color-olive)' : '1px solid rgba(62, 47, 35, 0.2)',
                      backgroundColor: '#FFFFFF',
                      color: 'var(--color-umber)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-umber-subtle)' }}>
                  —
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)', marginBottom: '4px' }}>Team B</div>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={scoreB}
                    onChange={(e) => handleScoreBChange(e.target.value)}
                    required
                    style={{
                      width: '70px',
                      height: '48px',
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      textAlign: 'center',
                      borderRadius: 'var(--radius-sm)',
                      border: winningTeam === 'B' ? '2px solid var(--color-olive)' : '1px solid rgba(62, 47, 35, 0.2)',
                      backgroundColor: '#FFFFFF',
                      color: 'var(--color-umber)',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '9px 16px',
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
              disabled={isSubmitting}
              style={{
                padding: '9px 20px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-terracotta)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.875rem',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <IconCheck size={16} />
              {isSubmitting
                ? 'Completing...'
                : `Confirm Team ${winningTeam} Won & Complete`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

