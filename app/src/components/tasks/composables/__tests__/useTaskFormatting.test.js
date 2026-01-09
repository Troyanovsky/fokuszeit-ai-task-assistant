/**
 * Tests for useTaskFormatting composable
 */

import { describe, it, expect } from 'vitest';
import { formatTaskDate, formatTaskDateTime, formatTaskDuration, capitalizeFirst } from '../useTaskFormatting.js';

describe('useTaskFormatting', () => {
  describe('formatTaskDate', () => {
    it('should format date string correctly', () => {
      const result = formatTaskDate('2025-01-15');
      expect(result).toContain('2025');
    });

    it('should handle invalid date strings', () => {
      const result = formatTaskDate('invalid-date');
      expect(result).toBe('Invalid date');
    });
  });

  describe('formatTaskDateTime', () => {
    it('should show "Today" for today\'s date', () => {
      const today = new Date().toISOString();
      const result = formatTaskDateTime(today);
      expect(result).toContain('Today');
    });

    it('should show "Tomorrow" for tomorrow\'s date', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const result = formatTaskDateTime(tomorrow.toISOString());
      expect(result).toContain('Tomorrow');
    });

    it('should show formatted date for other dates', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const result = formatTaskDateTime(futureDate.toISOString());
      expect(result).toContain(',');
    });

    it('should handle invalid date strings', () => {
      const result = formatTaskDateTime('invalid-date');
      expect(result).toBe('Invalid date');
    });
  });

  describe('formatTaskDuration', () => {
    it('should format minutes correctly', () => {
      expect(formatTaskDuration(30)).toBe('30 min');
      expect(formatTaskDuration(45)).toBe('45 min');
    });

    it('should format hours correctly', () => {
      expect(formatTaskDuration(60)).toBe('1h');
      expect(formatTaskDuration(120)).toBe('2h');
    });

    it('should format hours and minutes correctly', () => {
      expect(formatTaskDuration(90)).toBe('1h 30m');
      expect(formatTaskDuration(150)).toBe('2h 30m');
    });

    it('should handle null values', () => {
      expect(formatTaskDuration(null)).toBe('30 min');
    });
  });

  describe('capitalizeFirst', () => {
    it('should capitalize first letter', () => {
      expect(capitalizeFirst('hello')).toBe('Hello');
      expect(capitalizeFirst('WORLD')).toBe('WORLD');
    });

    it('should handle single character strings', () => {
      expect(capitalizeFirst('a')).toBe('A');
    });

    it('should handle empty strings', () => {
      expect(capitalizeFirst('')).toBe('');
    });
  });
});
