import React from 'react';
import Link from 'next/link';
import { IconArrowLeft, IconBook, IconUser, IconDeviceTablet } from '@tabler/icons-react';

export default function HowToUsePage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-cream)', color: 'var(--color-umber)' }}>
      <header
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid rgba(62, 47, 35, 0.12)',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
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
        <h1 style={{ fontSize: '1.1rem', fontWeight: 800 }}>ROT8 User Guide &amp; Reference</h1>
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 20px 80px' }}>
        {/* Intro */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--color-terracotta)', marginBottom: '8px' }}>
            <IconBook size={24} />
            <span style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.05em' }}>DOCUMENTATION</span>
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--color-umber)', marginBottom: '10px' }}>
            How ROT8 Works
          </h2>
          <p style={{ fontSize: '1rem', color: 'var(--color-umber-muted)', lineHeight: 1.5 }}>
            ROT8 is an intelligent court rotation engine designed for pickleball clubs and open play sessions.
            It balances player wait times, pairs compatible skill levels, and minimizes courtside downtime.
          </p>
        </div>

        {/* Player Guide */}
        <section
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            marginBottom: '28px',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid rgba(62, 47, 35, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <IconUser size={22} color="var(--color-olive-dark)" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-umber)' }}>
              Player Guide
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem', lineHeight: 1.6 }}>
            <div>
              <h4 style={{ fontWeight: 700, color: 'var(--color-umber)', marginBottom: '4px' }}>1. Check-In via QR Code</h4>
              <p style={{ color: 'var(--color-umber-muted)' }}>
                Scan the QR code on the TV kiosk or enter the 6-character session PIN on the homepage. Enter your name and self-assessed star rating.
              </p>
            </div>

            <div>
              <h4 style={{ fontWeight: 700, color: 'var(--color-umber)', marginBottom: '4px' }}>2. Rotation &amp; Grace Countdown</h4>
              <p style={{ color: 'var(--color-umber-muted)' }}>
                When your name is summoned to a court, your mobile screen will turn terracotta with your court number. You have a 90-second grace window to report to the court.
              </p>
            </div>

            <div>
              <h4 style={{ fontWeight: 700, color: 'var(--color-umber)', marginBottom: '4px' }}>3. Taking a Break (Rest Mode)</h4>
              <p style={{ color: 'var(--color-umber-muted)' }}>
                Need water or rest? Tap &ldquo;Take a Break&rdquo; in the mobile hub. You will be excluded from new drafts without losing your session stats. Tap &ldquo;Resume&rdquo; when ready to play.
              </p>
            </div>

            <div>
              <h4 style={{ fontWeight: 700, color: 'var(--color-umber)', marginBottom: '4px' }}>4. Locked Pairs</h4>
              <p style={{ color: 'var(--color-umber-muted)' }}>
                Want to partner with a friend for doubles? Submit a Pair-Lock request in your mobile hub. Once the session host approves, you will be drafted as an indivisible team.
              </p>
            </div>
          </div>
        </section>

        {/* Host Manual */}
        <section
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            marginBottom: '28px',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid rgba(62, 47, 35, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <IconDeviceTablet size={22} color="var(--color-terracotta)" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-umber)' }}>
              Host Operator Manual
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem', lineHeight: 1.6 }}>
            <div>
              <h4 style={{ fontWeight: 700, color: 'var(--color-umber)', marginBottom: '4px' }}>Host Console Workflow</h4>
              <p style={{ color: 'var(--color-umber-muted)' }}>
                <strong>Active Courts:</strong> Live stopwatches and score completion.<br />
                <strong>On-Deck Matchups:</strong> Pre-composed matchups awaiting summon. Tap &ldquo;Call to Court&rdquo; to send a matchup to an available court.<br />
                <strong>Queue &amp; Roster Management:</strong> Roster view, manual check-ins, holding list approvals, and pair builder.
              </p>
            </div>

            <div>
              <h4 style={{ fontWeight: 700, color: 'var(--color-umber)', marginBottom: '4px' }}>Handling No-Shows</h4>
              <p style={{ color: 'var(--color-umber-muted)' }}>
                If a player fails to appear during the grace period countdown, click the &ldquo;No-Show&rdquo; button next to their name. The system bumps the absent player to resting and drafts an instant replacement in under 500ms, restarting the timer.
              </p>
            </div>

            <div>
              <h4 style={{ fontWeight: 700, color: 'var(--color-umber)', marginBottom: '4px' }}>Retire / Forfeit</h4>
              <p style={{ color: 'var(--color-umber-muted)' }}>
                If a player must leave mid-game due to injury or fatigue, tap their card on the active court and select &ldquo;Retire / Forfeit&rdquo;. Enter the live score at departure. No substitutes are placed into completed matches to protect Elo rating integrity.
              </p>
            </div>
          </div>
        </section>

        {/* Star & Elo Rating Scale Reference Table (Spec §3) */}
        <section
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid rgba(62, 47, 35, 0.1)',
          }}
        >
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-umber)', marginBottom: '8px' }}>
            Star &amp; Elo Rating Scale Reference
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-umber-muted)', marginBottom: '16px' }}>
            Benchmark definitions used by ROT8 algorithms to seed initial ratings and balance matches.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(62, 47, 35, 0.1)', textAlign: 'left', color: 'var(--color-umber-muted)' }}>
                  <th style={{ padding: '8px' }}>Stars</th>
                  <th style={{ padding: '8px' }}>Elo Range</th>
                  <th style={{ padding: '8px' }}>Skill Benchmarks</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(62, 47, 35, 0.08)' }}>
                  <td style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--color-terracotta)' }}>Unrated (0)</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)' }}>1200</td>
                  <td style={{ padding: '10px 8px', color: 'var(--color-umber-muted)' }}>
                    No prior rating assigned; default starting baseline Elo for new players.
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(62, 47, 35, 0.08)' }}>
                  <td style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--color-terracotta)' }}>★ Beginner (1)</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)' }}>600</td>
                  <td style={{ padding: '10px 8px', color: 'var(--color-umber-muted)' }}>
                    Learning the rules, kitchen zone basics, scoring, and paddle control.
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(62, 47, 35, 0.08)' }}>
                  <td style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--color-terracotta)' }}>★ Novice (2)</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)' }}>950</td>
                  <td style={{ padding: '10px 8px', color: 'var(--color-umber-muted)' }}>
                    Basic rallies, consistent serve direction, developing third-shot drop mechanics.
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(62, 47, 35, 0.08)' }}>
                  <td style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--color-terracotta)' }}>★ Intermediate (3)</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)' }}>1300</td>
                  <td style={{ padding: '10px 8px', color: 'var(--color-umber-muted)' }}>
                    Consistent dinks, strategic kitchen positioning, reliable drops under pressure.
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(62, 47, 35, 0.08)' }}>
                  <td style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--color-terracotta)' }}>★ Advanced (4)</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)' }}>1650</td>
                  <td style={{ padding: '10px 8px', color: 'var(--color-umber-muted)' }}>
                    High hand speed, aggressive play, directional resets, and low unforced error rate.
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--color-terracotta)' }}>★ Expert (5)</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)' }}>2000</td>
                  <td style={{ padding: '10px 8px', color: 'var(--color-umber-muted)' }}>
                    Tournament competitive, elite court vision, mastery of pace modulation and defense.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
