/**
 * Tests for date-only and timestamp handling utilities.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  coerceDateOnly,
  endOfDayLocalFromDateOnly,
  formatDateOnlyLocal,
  getTodayDateOnlyLocal,
  parseDateOnlyLocal,
} from '../dateTime.js';

describe('dateTime utilities', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formatDateOnlyLocal formats using local calendar values', () => {
    const date = new Date(2025, 0, 15, 23, 59, 59);
    expect(formatDateOnlyLocal(date)).toBe('2025-01-15');
  });

  it('coerceDateOnly normalizes YYYY-M-D to YYYY-MM-DD', () => {
    expect(coerceDateOnly('2025-1-5')).toBe('2025-01-05');
  });

  it('coerceDateOnly extracts date from ISO strings', () => {
    expect(coerceDateOnly('2025-01-05T10:30:00.000Z')).toBe('2025-01-05');
  });

  it('parseDateOnlyLocal creates a local-midnight Date', () => {
    const parsed = parseDateOnlyLocal('2025-01-05');
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed.getFullYear()).toBe(2025);
    expect(parsed.getMonth()).toBe(0);
    expect(parsed.getDate()).toBe(5);
    expect(parsed.getHours()).toBe(0);
    expect(parsed.getMinutes()).toBe(0);
  });

  it('endOfDayLocalFromDateOnly creates a local end-of-day Date', () => {
    const end = endOfDayLocalFromDateOnly('2025-01-05');
    expect(end).toBeInstanceOf(Date);
    expect(end.getFullYear()).toBe(2025);
    expect(end.getMonth()).toBe(0);
    expect(end.getDate()).toBe(5);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  it('getTodayDateOnlyLocal derives local calendar date (not UTC)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 15, 12, 0, 0));
    expect(getTodayDateOnlyLocal()).toBe('2025-01-15');
  });
});

