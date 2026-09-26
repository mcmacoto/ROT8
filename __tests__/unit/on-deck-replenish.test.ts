import { describe, it, expect } from 'vitest';
import { calculateInitialElo } from '@/lib/engine/matchmaking/elo-rated';
import { computeOnDeckCap } from '@/lib/engine/cap';

describe('On-Deck Replenishment & Rating Baseline', () => {
  it('assigns 1200 initial Elo for unrated (0.0) players', () => {
    const elo = calculateInitialElo(0.0);
    expect(elo).toBe(1200);
  });

  it('calculates standard initial Elo for rated players', () => {
    expect(calculateInitialElo(1.0)).toBe(600);
    expect(calculateInitialElo(3.0)).toBe(1300);
    expect(calculateInitialElo(3.5)).toBe(1475);
    expect(calculateInitialElo(5.0)).toBe(2000);
  });

  it('correctly calculates on-deck cap across court counts and overrides', () => {
    // 1 court -> cap is 1
    expect(computeOnDeckCap(1, null)).toBe(1);
    // 2 courts -> cap is 1 (max(1, 2-1))
    expect(computeOnDeckCap(2, null)).toBe(1);
    // 4 courts -> cap is 3 (max(1, 4-1))
    expect(computeOnDeckCap(4, null)).toBe(3);
    // Manual override
    expect(computeOnDeckCap(4, 2)).toBe(2);
    expect(computeOnDeckCap(2, 4)).toBe(4);
  });
});
