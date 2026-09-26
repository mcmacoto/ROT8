'use client';

import React, { useState } from 'react';
import { MatchMode, Session } from '@/types/database';
import { IconSettings, IconX } from '@tabler/icons-react';

interface SessionSettingsDrawerProps {
  isOpen: boolean;
  session: Session;
  onClose: () => void;
  onEndSessionClick?: () => void;
  onUpdateSettings: (updates: {
    match_mode?: MatchMode;
    scoring_required?: boolean;
    on_deck_cap_override?: number | null;
    grace_period_seconds?: number;
    auto_dispatch_enabled?: boolean;
  }) => Promise<void>;
}

export function SessionSettingsDrawer({
  isOpen,
  session,
  onClose,
  onEndSessionClick,
  onUpdateSettings,
}: SessionSettingsDrawerProps) {
  const [matchMode, setMatchMode] = useState<MatchMode>(session.match_mode);
  const [scoringRequired, setScoringRequired] = useState<boolean>(session.scoring_required);
  const [autoDispatchEnabled, setAutoDispatchEnabled] = useState<boolean>(session.auto_dispatch_enabled ?? false);
  const [gracePeriod, setGracePeriod] = useState<number>(session.grace_period_seconds);
  const [capOverride, setCapOverride] = useState<string>(
    session.on_deck_cap_override !== null ? String(session.on_deck_cap_override) : ''
  );
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await onUpdateSettings({
        match_mode: matchMode,
        scoring_required: scoringRequired,
        auto_dispatch_enabled: autoDispatchEnabled,
        grace_period_seconds: gracePeriod,
        on_deck_cap_override: capOverride.trim() ? parseInt(capOverride, 10) : null,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(62, 47, 35, 0.4)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          height: '100%',
          backgroundColor: '#FFFFFF',
          padding: '24px',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconSettings size={20} color="var(--color-umber)" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-umber)' }}>
              Session Settings
            </h3>
          </div>
          <button type="button" onClick={onClose} style={{ color: 'var(--color-umber-muted)' }}>
            <IconX size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
          {/* Matchmaking Mode */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-umber)', marginBottom: '6px' }}>
              Matchmaking Mode
            </label>
            <select
              value={matchMode}
              onChange={(e) => setMatchMode(e.target.value as MatchMode)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(62, 47, 35, 0.2)',
                fontSize: '0.9rem',
              }}
            >
              <option value="balanced">Balanced Mode (ΔR ≤ 1.0)</option>
              <option value="skill_separated">Skill-Separated (Tiered)</option>
              <option value="social">Social Mode (Mixer)</option>
              <option value="elo_rated">Dynamic Elo-Rated</option>
            </select>
          </div>

          {/* Scoring Required Toggle */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={scoringRequired}
                onChange={(e) => setScoringRequired(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--color-terracotta)' }}
              />
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-umber)' }}>
                Scoring Required (Elo Updates &amp; Standings)
              </span>
            </label>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)', marginTop: '4px', marginLeft: '28px' }}>
              When disabled, matches finish immediately without score entry modals.
            </p>
          </div>

          {/* Auto-Dispatch Toggle */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoDispatchEnabled}
                onChange={(e) => setAutoDispatchEnabled(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--color-terracotta)' }}
              />
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-umber)' }}>
                Auto-Dispatch Matches
              </span>
            </label>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)', marginTop: '4px', marginLeft: '28px' }}>
              When courts become available, automatically match and summon queued players.
            </p>
          </div>

          {/* Grace Period Seconds */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-umber)', marginBottom: '6px' }}>
              Grace Period Countdown (Seconds)
            </label>
            <input
              type="number"
              min="30"
              max="300"
              value={gracePeriod}
              onChange={(e) => setGracePeriod(parseInt(e.target.value, 10) || 90)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(62, 47, 35, 0.2)',
                fontSize: '0.9rem',
              }}
            />
          </div>

          {/* On-Deck Cap Override */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-umber)', marginBottom: '6px' }}>
              On-Deck Cap Override (Optional)
            </label>
            <input
              type="number"
              min="1"
              max="5"
              placeholder="Leave empty for auto: max(1, active_courts - 1)"
              value={capOverride}
              onChange={(e) => setCapOverride(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(62, 47, 35, 0.2)',
                fontSize: '0.9rem',
              }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--color-umber-muted)', marginTop: '4px' }}>
              Leave blank to use dynamic venue formula.
            </p>
          </div>

          {onEndSessionClick && (
            <div style={{ paddingTop: '16px', borderTop: '1px solid #EFEAE3' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#D9534F', marginBottom: '8px' }}>
                Danger Zone
              </label>
              <button
                type="button"
                onClick={onEndSessionClick}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(217, 83, 79, 0.08)',
                  border: '1px solid rgba(217, 83, 79, 0.3)',
                  color: '#D9534F',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                End Session...
              </button>
            </div>
          )}

          <div style={{ marginTop: 'auto', display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px',
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
              disabled={isSaving}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-terracotta)',
                color: '#FFFFFF',
                fontWeight: 600,
              }}
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
