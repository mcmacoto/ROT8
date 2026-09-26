import { describe, it, expect } from 'vitest';
import {
  validateMatchStageTransition,
  validateCourtStatusTransition,
  validatePlayerStatusTransition,
} from '@/lib/engine/state-machine/transitions';
import {
  calculateGraceTimer,
  calculateMatchDuration,
  formatDuration,
} from '@/lib/engine/state-machine/grace-timer';

describe('Module 3: State Transition Validation', () => {
  it('validates match stage transitions along the turnaround lifecycle', () => {
    expect(validateMatchStageTransition('on_deck', 'summoning').valid).toBe(true);
    expect(validateMatchStageTransition('summoning', 'in_match').valid).toBe(true);
    expect(validateMatchStageTransition('in_match', 'result_pending').valid).toBe(true);
    expect(validateMatchStageTransition('result_pending', 'completed').valid).toBe(true);

    // Invalid jumps
    expect(validateMatchStageTransition('on_deck', 'in_match').valid).toBe(false);
    expect(validateMatchStageTransition('completed', 'on_deck').valid).toBe(false);
  });

  it('validates court status transitions including needs_attention', () => {
    expect(validateCourtStatusTransition('available', 'summoning').valid).toBe(true);
    expect(validateCourtStatusTransition('summoning', 'needs_attention').valid).toBe(true);
    expect(validateCourtStatusTransition('needs_attention', 'in_match').valid).toBe(true);
    expect(validateCourtStatusTransition('in_match', 'available').valid).toBe(true);
  });

  it('validates player status transitions', () => {
    expect(validatePlayerStatusTransition('queued', 'staged').valid).toBe(true);
    expect(validatePlayerStatusTransition('staged', 'summoned').valid).toBe(true);
    expect(validatePlayerStatusTransition('summoned', 'on_court').valid).toBe(true);
    expect(validatePlayerStatusTransition('summoned', 'resting').valid).toBe(true); // No-show bump
    expect(validatePlayerStatusTransition('on_court', 'queued').valid).toBe(true);
  });
});

describe('Module 3: Grace Timer & Synchronization Invariants', () => {
  it('formats duration accurately into MM:SS', () => {
    expect(formatDuration(90)).toBe('01:30');
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(600)).toBe('10:00');
  });

  it('computes remaining seconds during active grace countdown', () => {
    const now = Date.now();
    const summonedAt = new Date(now - 30 * 1000).toISOString(); // 30s elapsed
    const state = calculateGraceTimer(summonedAt, 90, now);

    expect(state.remainingSeconds).toBe(60);
    expect(state.formattedTime).toBe('01:00');
    expect(state.isExpired).toBe(false);
    expect(state.needsAttention).toBe(false);
  });

  it('CRITICAL: Grace timer timeout at 00:00 enters needs_attention, NEVER auto-starts', () => {
    const now = Date.now();
    const summonedAt = new Date(now - 95 * 1000).toISOString(); // 95s elapsed > 90s
    const state = calculateGraceTimer(summonedAt, 90, now);

    expect(state.remainingSeconds).toBe(0);
    expect(state.formattedTime).toBe('00:00');
    expect(state.isExpired).toBe(true);
    // Court enters needs_attention state requiring host action
    expect(state.needsAttention).toBe(true);
  });

  it('calculates active match stopwatch correctly', () => {
    const now = Date.now();
    const startedAt = new Date(now - 125 * 1000).toISOString(); // 2m 5s
    const { durationSeconds, formattedTime } = calculateMatchDuration(startedAt, now);

    expect(durationSeconds).toBe(125);
    expect(formattedTime).toBe('02:05');
  });
});
