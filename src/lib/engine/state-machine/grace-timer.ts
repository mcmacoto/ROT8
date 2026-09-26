/**
 * Module 3: Server-Authoritative Grace Timer & Stopwatch Utilities
 * Ensures temporal synchronization within +-250ms across admin tablet, TV kiosk, and mobile hub.
 */

export interface GraceTimerState {
  remainingSeconds: number;
  isExpired: boolean;
  needsAttention: boolean;
  formattedTime: string;
}

/**
 * Calculates current grace timer state from server-authoritative summoned_at timestamp.
 * If timer expires (reaches 0), court/match enters 'needs_attention'.
 * CRITICAL RULE: A grace timeout NEVER auto-starts a match.
 */
export function calculateGraceTimer(
  summonedAt: string | null,
  gracePeriodSeconds = 90,
  nowMs: number = Date.now()
): GraceTimerState {
  if (!summonedAt) {
    return {
      remainingSeconds: gracePeriodSeconds,
      isExpired: false,
      needsAttention: false,
      formattedTime: formatDuration(gracePeriodSeconds),
    };
  }

  const summonedMs = new Date(summonedAt).getTime();
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - summonedMs) / 1000));
  const remainingSeconds = Math.max(0, gracePeriodSeconds - elapsedSeconds);
  const isExpired = remainingSeconds === 0;

  return {
    remainingSeconds,
    isExpired,
    needsAttention: isExpired, // Enters needs_attention upon 00:00
    formattedTime: formatDuration(remainingSeconds),
  };
}

/**
 * Calculates active match stopwatch duration from started_at server timestamp.
 */
export function calculateMatchDuration(
  startedAt: string | null,
  nowMs: number = Date.now()
): { durationSeconds: number; formattedTime: string } {
  if (!startedAt) {
    return { durationSeconds: 0, formattedTime: '00:00' };
  }

  const startMs = new Date(startedAt).getTime();
  const durationSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1000));

  return {
    durationSeconds,
    formattedTime: formatDuration(durationSeconds),
  };
}

/**
 * Formats seconds into MM:SS string.
 */
export function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
