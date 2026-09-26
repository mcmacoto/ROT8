import { describe, it, expect } from 'vitest';
import { getPlayerPin, verifyPlayerPin } from '@/lib/utils/player-pin';
import { deriveSessionHostToken, validateHostToken, generateHostToken } from '@/lib/auth/host-token';

describe('Player PIN & Multi-Host Authentication', () => {
  const sessionId = 'd290f1ee-6c54-4b01-90e6-d701748f0851';
  const sessionPin = 'PKL892';
  const playerId1 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const playerId2 = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

  it('generates a 4-digit numeric PIN string', () => {
    const pin = getPlayerPin(playerId1, sessionPin);
    expect(pin).toHaveLength(4);
    expect(/^\d{4}$/.test(pin)).toBe(true);
  });

  it('is deterministic for identical inputs', () => {
    const pinA = getPlayerPin(playerId1, sessionPin);
    const pinB = getPlayerPin(playerId1, sessionPin);
    expect(pinA).toBe(pinB);
  });

  it('generates different PINs for different players in the same session', () => {
    const pin1 = getPlayerPin(playerId1, sessionPin);
    const pin2 = getPlayerPin(playerId2, sessionPin);
    expect(pin1).not.toBe(pin2);
  });

  it('generates different PINs for the same player across different sessions', () => {
    const pinA = getPlayerPin(playerId1, 'SESSION1');
    const pinB = getPlayerPin(playerId1, 'SESSION2');
    expect(pinA).not.toBe(pinB);
  });

  it('verifies valid player PIN and rejects invalid or tampered PINs', () => {
    const pin = getPlayerPin(playerId1, sessionPin);
    expect(verifyPlayerPin(pin, playerId1, sessionPin)).toBe(true);
    expect(verifyPlayerPin('0000', playerId1, sessionPin)).toBe(pin === '0000');
    expect(verifyPlayerPin('9999', playerId1, sessionPin)).toBe(pin === '9999');
    expect(verifyPlayerPin('', playerId1, sessionPin)).toBe(false);
    expect(verifyPlayerPin('abc', playerId1, sessionPin)).toBe(false);
  });

  it('supports multi-device host token derivation from session PIN', () => {
    const derivedToken = deriveSessionHostToken(sessionId, sessionPin);
    expect(derivedToken).toHaveLength(64);

    // Should validate when sessionId and joinPin match
    const isValid = validateHostToken(derivedToken, 'some-original-hash', sessionId, sessionPin);
    expect(isValid).toBe(true);

    // Should reject if wrong session PIN provided
    const isInvalid = validateHostToken(derivedToken, 'some-original-hash', sessionId, 'WRONGPIN');
    expect(isInvalid).toBe(false);
  });
});
