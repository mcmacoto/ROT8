export interface StalledSlot {
  isStalled: true;
  slotNumber: number;
  reason: string;
  recoveryActions: ['relax_skill_bounds', 'shift_to_social'];
}

/**
 * Computes on-deck capacity.
 * Formula: override ?? max(1, active_courts - 1)
 * CRITICAL REGRESSION REQUIREMENT: For 1 court venue, returns 1, never 0.
 */
export function computeOnDeckCap(activeCourts: number, override?: number | null): number {
  if (override !== undefined && override !== null && override > 0) {
    return override;
  }
  return Math.max(1, activeCourts - 1);
}
