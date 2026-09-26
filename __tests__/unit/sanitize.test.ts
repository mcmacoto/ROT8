import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizePlayerName, sanitizeSessionName, sanitizePin } from '@/lib/utils/sanitize';

describe('Sanitization Utilities', () => {
  describe('sanitizeText', () => {
    it('strips HTML tags and script elements', () => {
      expect(sanitizeText('<script>alert("xss")</script>John Doe')).toBe('alert("xss")John Doe');
      expect(sanitizeText('<b>Bold</b> <i>Italic</i>')).toBe('Bold Italic');
    });

    it('strips control characters', () => {
      expect(sanitizeText('Hello\x00\x08World')).toBe('HelloWorld');
    });

    it('normalizes multiple spaces and trims', () => {
      expect(sanitizeText('   Alice    Smith   ')).toBe('Alice Smith');
    });

    it('enforces maximum length', () => {
      const longText = 'A'.repeat(120);
      expect(sanitizeText(longText, 50).length).toBe(50);
    });

    it('handles non-string inputs gracefully', () => {
      expect(sanitizeText(null)).toBe('');
      expect(sanitizeText(undefined)).toBe('');
      expect(sanitizeText(123)).toBe('');
    });
  });

  describe('sanitizePlayerName', () => {
    it('limits player name to 50 chars and strips tags', () => {
      expect(sanitizePlayerName('  <img src="x" onerror="alert(1)">Marcus  ')).toBe('Marcus');
      const longName = 'Player '.repeat(20);
      expect(sanitizePlayerName(longName).length).toBeLessThanOrEqual(50);
    });
  });

  describe('sanitizeSessionName', () => {
    it('limits session name to 100 chars', () => {
      expect(sanitizeSessionName('  Friday Night Pickles 🥒  ')).toBe('Friday Night Pickles 🥒');
      const longTitle = 'Super Championship '.repeat(10);
      expect(sanitizeSessionName(longTitle).length).toBeLessThanOrEqual(100);
    });
  });

  describe('sanitizePin', () => {
    it('cleans PIN to uppercase alphanumeric max 6 chars', () => {
      expect(sanitizePin('abc-123')).toBe('ABC123');
      expect(sanitizePin(' 456789 extra ')).toBe('456789');
      expect(sanitizePin(null)).toBe('');
    });
  });
});
