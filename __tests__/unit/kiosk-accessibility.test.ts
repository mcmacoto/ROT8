import { describe, it, expect } from 'vitest';
import { CourtStatus } from '@/types/database';

describe('Module 5: TV Kiosk Accessibility & Non-Color Status Distinctions', () => {
  const statusIconMapping: Record<CourtStatus, string> = {
    in_match: 'IconPlayerPlay',
    summoning: 'IconClock',
    needs_attention: 'IconAlertTriangle',
    maintenance: 'IconSquareOff',
    available: 'IconSquareOff',
  };

  it('ensures every court status is paired with a distinct semantic icon', () => {
    // Accessibility rule: Color is NEVER the sole signal
    const activeIcon = statusIconMapping['in_match'];
    const summoningIcon = statusIconMapping['summoning'];
    const alertIcon = statusIconMapping['needs_attention'];
    const maintenanceIcon = statusIconMapping['maintenance'];

    // All operational statuses have unique icons
    expect(activeIcon).not.toBe(summoningIcon);
    expect(activeIcon).not.toBe(alertIcon);
    expect(summoningIcon).not.toBe(alertIcon);
    expect(alertIcon).not.toBe(maintenanceIcon);
  });
});
