import { describe, it, expect } from 'vitest';
import { parsePlayerList } from '@/lib/utils/parse-player-list';

describe('parsePlayerList Utility', () => {
  it('parses simple newline-separated names with default rating 0 (Unrated)', () => {
    const input = `Alice Smith\nBob Jones\nCharlie Brown`;
    const result = parsePlayerList(input);
    expect(result).toEqual([
      { name: 'Alice Smith', rating: 0 },
      { name: 'Bob Jones', rating: 0 },
      { name: 'Charlie Brown', rating: 0 },
    ]);
  });

  it('parses comma-separated names with custom default rating', () => {
    const input = `Alice Smith, Bob Jones, Charlie Brown`;
    const result = parsePlayerList(input, 3);
    expect(result).toEqual([
      { name: 'Alice Smith', rating: 3 },
      { name: 'Bob Jones', rating: 3 },
      { name: 'Charlie Brown', rating: 3 },
    ]);
  });

  it('strips numbered and bulleted prefixes', () => {
    const input = `
      1. Alice Smith
      2) Bob Jones
      - Charlie Brown
      * David Miller
      • Eve Adams
    `;
    const result = parsePlayerList(input);
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({ name: 'Alice Smith', rating: 0 });
    expect(result[1]).toEqual({ name: 'Bob Jones', rating: 0 });
    expect(result[2]).toEqual({ name: 'Charlie Brown', rating: 0 });
    expect(result[3]).toEqual({ name: 'David Miller', rating: 0 });
    expect(result[4]).toEqual({ name: 'Eve Adams', rating: 0 });
  });

  it('extracts inline ratings in various formats', () => {
    const input = `
      1. Alice Smith 4
      2. Bob Jones (3)
      3. Charlie Brown [5]
      4. David Miller - 3
      5. Eve Adams: 5
      6. Frank Castle ★ 2
    `;
    const result = parsePlayerList(input);
    expect(result).toEqual([
      { name: 'Alice Smith', rating: 4 },
      { name: 'Bob Jones', rating: 3 },
      { name: 'Charlie Brown', rating: 5 },
      { name: 'David Miller', rating: 3 },
      { name: 'Eve Adams', rating: 5 },
      { name: 'Frank Castle', rating: 2 },
    ]);
  });

  it('falls back to default rating 0 when inline rating is invalid or out of bounds', () => {
    const input = `
      Player Alpha 9.9
      Player Beta 0.5
      Player Gamma 3.3
      Player Delta
    `;
    const result = parsePlayerList(input);
    expect(result).toEqual([
      { name: 'Player Alpha 9.9', rating: 0 },
      { name: 'Player Beta 0.5', rating: 0 },
      { name: 'Player Gamma 3.3', rating: 0 },
      { name: 'Player Delta', rating: 0 },
    ]);
  });

  it('handles empty input and blank lines gracefully', () => {
    expect(parsePlayerList('')).toEqual([]);
    expect(parsePlayerList('   \n\n   \r\n  ')).toEqual([]);
  });
});
