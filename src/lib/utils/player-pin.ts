/**
 * Generates a stable, deterministic 4-digit PIN (1000–9999) for a player in a session.
 * Pure TypeScript implementation that works identically in both Node.js and browser environments
 * without requiring any database schema migrations.
 *
 * @param playerId Unique player UUID or ID string
 * @param sessionPin Session join PIN string for session-level salting
 * @returns 4-digit PIN string (e.g., "4821")
 */
export function getPlayerPin(playerId: string, sessionPin: string = ''): string {
  if (!playerId) return '1000';

  const str = `${playerId}:${sessionPin || 'rot8'}`;
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const positive = Math.abs(hash);
  const pin = 1000 + (positive % 9000);
  return pin.toString();
}

/**
 * Validates whether an entered PIN matches a player's assigned PIN.
 */
export function verifyPlayerPin(enteredPin: string, playerId: string, sessionPin: string = ''): boolean {
  if (!enteredPin || !playerId) return false;
  const expectedPin = getPlayerPin(playerId, sessionPin);
  return enteredPin.trim() === expectedPin;
}
