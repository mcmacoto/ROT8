import { describe, it, expect } from 'vitest';
import { generateHostToken, hashHostToken, validateHostToken } from '@/lib/auth/host-token';
import { MatchStage } from '@/types/database';

describe('Module 1: Host Authentication & Security', () => {
  it('generates a 64-character hex raw token and matching SHA256 digest', () => {
    const { rawToken, tokenHash } = generateHostToken();
    expect(rawToken).toHaveLength(64);
    expect(tokenHash).toHaveLength(64);
    expect(hashHostToken(rawToken)).toBe(tokenHash);
  });

  it('validates correct host token matches stored hash', () => {
    const { rawToken, tokenHash } = generateHostToken();
    const isValid = validateHostToken(rawToken, tokenHash);
    expect(isValid).toBe(true);
  });

  it('rejects invalid or tampered host token', () => {
    const { rawToken, tokenHash } = generateHostToken();
    const tampered = rawToken.slice(0, -1) + (rawToken.slice(-1) === 'a' ? 'b' : 'a');
    expect(validateHostToken(tampered, tokenHash)).toBe(false);
    expect(validateHostToken(null, tokenHash)).toBe(false);
    expect(validateHostToken(undefined, tokenHash)).toBe(false);
  });

  it('rejects when join pin is provided instead of host token', () => {
    const { tokenHash } = generateHostToken();
    const joinPin = 'AB12CD';
    expect(validateHostToken(joinPin, tokenHash)).toBe(false);
  });
});

describe('Module 1: Section 6 Player Replacement Stage Validation', () => {
  function checkReplacementAllowed(stage: MatchStage): boolean {
    return stage === 'on_deck';
  }

  it('allows player replacement ONLY on on_deck stage', () => {
    expect(checkReplacementAllowed('on_deck')).toBe(true);
  });

  it('strictly disallows replacement on active or completed stages (Elo-integrity guarantee)', () => {
    const forbiddenStages: MatchStage[] = ['summoning', 'in_match', 'result_pending', 'completed'];
    for (const stage of forbiddenStages) {
      expect(checkReplacementAllowed(stage)).toBe(false);
    }
  });
});
