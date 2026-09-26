import { StaticRating } from '@/types/database';

export interface ParsedPlayer {
  name: string;
  rating: StaticRating;
}

const VALID_STATIC_RATINGS: ReadonlySet<number> = new Set([
  0, 1, 2, 3, 4, 5,
]);

/**
 * Validates whether a number is a valid StaticRating.
 */
export function isValidStaticRating(val: number): val is StaticRating {
  return VALID_STATIC_RATINGS.has(val);
}

/**
 * Parses raw text input containing player names and optional ratings.
 * Supports:
 * - Newline separated lines
 * - Comma separated names (if single line or multiple per line)
 * - Numbered/bulleted prefixes: "1. Alice", "2) Bob", "- Charlie", "* Dave"
 * - Inline ratings: "Alice 4", "Bob (3)", "Charlie [5]", "Diana - 2"
 *
 * @param input Raw text input from user
 * @param defaultRating Fallback rating if none specified (default: 0)
 * @returns Array of ParsedPlayer objects
 */
export function parsePlayerList(
  input: string,
  defaultRating: StaticRating = 0
): ParsedPlayer[] {
  if (!input || !input.trim()) {
    return [];
  }

  // First split by newlines
  const rawLines = input.split(/\r?\n/);
  const candidateItems: string[] = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if this line contains multiple comma-separated items.
    // However, avoid splitting on commas inside parentheses e.g. "Smith, John (3.5)"
    // If there's commas and no bullet at the start or multiple comma tokens, split by comma.
    // A simple robust rule: if line has comma and no numbering like "1. ", split by comma;
    // but if it's "Doe, John" we don't want to split.
    // Standard rule: If multiple items separated by comma, e.g. "Alice, Bob, Charlie",
    // or if a line has commas where items look like players.
    // Let's check if the whole input has no newlines and has commas: split by comma.
    if (rawLines.length === 1 && trimmed.includes(',')) {
      const parts = trimmed.split(',');
      for (const p of parts) {
        if (p.trim()) candidateItems.push(p.trim());
      }
    } else {
      // If line contains multiple comma-separated entries e.g. "Alice 3.5, Bob 4.0"
      // or "Alice, Bob, Charlie"
      if (trimmed.includes(',') && !/^[0-9]+[.)]\s+/.test(trimmed)) {
        const parts = trimmed.split(',');
        for (const p of parts) {
          if (p.trim()) candidateItems.push(p.trim());
        }
      } else {
        candidateItems.push(trimmed);
      }
    }
  }

  const results: ParsedPlayer[] = [];

  for (const item of candidateItems) {
    // 1. Strip leading numbering or bullets (e.g. "1.", "1)", "-", "*", "•")
    let cleaned = item.replace(/^(\d+[\.\)]\s*|[\-\*\•\–\—]\s*)/, '').trim();
    if (!cleaned) continue;

    let rating: StaticRating = defaultRating;

    // 2. Extract rating token from end of string:
    // It must be preceded by whitespace, parenthesis, bracket, dash, colon, or star.
    // Examples: " 4.0", " (3.5)", " [4.5]", " - 3.0", " : 5.0", " ★ 2.5", " 4"
    const ratingPattern = /(?:^|[\s\(\[\-\:\—\–\★])(?:★\s*)?([0-9]+(?:\.[0-9]+)?)\s*[\]\)]?$/i;
    const match = cleaned.match(ratingPattern);

    if (match && match[1]) {
      const parsedNum = parseFloat(match[1]);
      if (isValidStaticRating(parsedNum)) {
        rating = parsedNum;
        // Remove the matched rating portion from the end of the name
        cleaned = cleaned.slice(0, match.index).trim();
      }
    }

    // Strip trailing punctuation like "-" or ":" or "," that might remain after rating removal
    cleaned = cleaned.replace(/[\-\:\,\(\)\[\]]+$/, '').trim();

    if (cleaned.length > 0) {
      results.push({
        name: cleaned,
        rating,
      });
    }
  }

  return results;
}
