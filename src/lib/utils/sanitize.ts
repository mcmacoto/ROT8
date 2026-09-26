/**
 * Input sanitization utilities for ROT8.
 * Protects against XSS, control character injection, and database field overflow.
 */

/**
 * Strips HTML tags, control characters, and normalizes whitespace.
 */
export function sanitizeText(input: unknown, maxLength = 100): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Strip unprintable/control characters (except standard spaces)
  let clean = input.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

  // Strip dangerous HTML tags completely or replace HTML tag characters
  clean = clean.replace(/<[^>]*>/g, '');

  // Normalize consecutive whitespace to a single space
  clean = clean.replace(/\s+/g, ' ').trim();

  // Enforce max length
  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength).trim();
  }

  return clean;
}

/**
 * Sanitizes a player's display name.
 * Limits to 50 characters, strips HTML/control chars.
 */
export function sanitizePlayerName(name: unknown): string {
  return sanitizeText(name, 50);
}

/**
 * Sanitizes a session title/name.
 * Limits to 100 characters, strips HTML/control chars.
 */
export function sanitizeSessionName(name: unknown): string {
  return sanitizeText(name, 100);
}

/**
 * Sanitizes a session join PIN or player PIN.
 * Uppercases and keeps alphanumeric characters only, max 6 characters.
 */
export function sanitizePin(pin: unknown): string {
  if (typeof pin !== 'string') {
    return '';
  }
  return pin.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
}
