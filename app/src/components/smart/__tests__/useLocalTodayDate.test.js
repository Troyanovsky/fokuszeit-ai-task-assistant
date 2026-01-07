/**
 * Unit tests for the local "today" date composable used by smart projects.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { useLocalTodayDate } from '../useLocalTodayDate.js';

describe('useLocalTodayDate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates todayDateStr after local midnight (with buffer)', () => {
    vi.useFakeTimers();

    const { todayDateStr, start, stop } = useLocalTodayDate();

    vi.setSystemTime(new Date(2026, 0, 7, 23, 59, 59, 500));
    start();

    expect(todayDateStr.value).toBe('2026-01-07');

    vi.advanceTimersByTime(1499);
    expect(todayDateStr.value).toBe('2026-01-07');

    vi.advanceTimersByTime(1);
    expect(todayDateStr.value).toBe('2026-01-08');

    stop();
  });

  it('cleans up the scheduled timeout on stop()', () => {
    vi.useFakeTimers();

    const { start, stop } = useLocalTodayDate();

    vi.setSystemTime(new Date(2026, 0, 7, 12, 0, 0, 0));
    start();
    stop();

    expect(vi.getTimerCount()).toBe(0);
  });
});

