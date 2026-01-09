/**
 * Tests for dateTimeParsers utility module.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies before imports
vi.mock('../../../logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logError: vi.fn()
  }
}));

vi.mock('../../../../shared/utils/dateTime.js', () => ({
  coerceDateOnly: vi.fn(),
  formatDateOnlyLocal: vi.fn()
}));

import {
  formatToYYYYMMDD,
  formatDateToYYYYMMDDLocal,
  parseToISODateTime,
  formatRecurrenceRuleForResponse,
  formatTaskForAI,
  formatNotificationForAI
} from '../../../ai-function-handlers/utils/dateTimeParsers.js';
import { coerceDateOnly, formatDateOnlyLocal } from '../../../../shared/utils/dateTime.js';

describe('dateTimeParsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatToYYYYMMDD', () => {
    it('formats valid date string to YYYY-MM-DD', () => {
      coerceDateOnly.mockReturnValue('2024-01-15');

      const result = formatToYYYYMMDD('Jan 15, 2024');

      expect(result).toBe('2024-01-15');
    });

    it('returns null for invalid date', () => {
      coerceDateOnly.mockReturnValue(null);

      const result = formatToYYYYMMDD('invalid-date');

      expect(result).toBeNull();
    });

    it('handles errors gracefully', () => {
      coerceDateOnly.mockImplementation(() => {
        throw new Error('Parse error');
      });

      const result = formatToYYYYMMDD('bad-input');

      expect(result).toBeNull();
    });
  });

  describe('formatDateToYYYYMMDDLocal', () => {
    it('formats Date using local calendar values', () => {
      formatDateOnlyLocal.mockReturnValue('2024-01-15');

      const date = new Date('2024-01-15T10:30:00.000Z');
      const result = formatDateToYYYYMMDDLocal(date);

      expect(result).toBe('2024-01-15');
    });
  });

  describe('parseToISODateTime', () => {
    it('parses already-formatted ISO date-time', () => {
      const input = '2024-01-15T10:30:00.000Z';
      const result = parseToISODateTime(input);

      expect(result).toBe(input);
    });

    it('parses local date-time string to ISO format', () => {
      const input = 'Jan 15, 2024 10:30 AM';
      const result = parseToISODateTime(input);

      // Should produce a valid ISO string
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('returns null for completely invalid date string', () => {
      const result = parseToISODateTime('not-a-date-at-all');

      expect(result).toBeNull();
    });

    it('handles custom context parameter', () => {
      const input = '2024-01-15 14:30';
      const result = parseToISODateTime(input, 'appointment time');

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('handles errors gracefully', () => {
      // Test with completely invalid input that will cause Date parsing to fail
      const result = parseToISODateTime('\x00invalid');

      // Should return null for invalid input
      expect(result).toBeNull();
    });
  });

  describe('formatRecurrenceRuleForResponse', () => {
    it('formats rule with Date endDate', () => {
      formatDateOnlyLocal.mockReturnValue('2024-12-31');

      const rule = {
        taskId: 'task-1',
        frequency: 'weekly',
        interval: 2,
        endDate: new Date('2024-12-31'),
        count: 10
      };

      const result = formatRecurrenceRuleForResponse(rule);

      expect(result).toEqual({
        taskId: 'task-1',
        frequency: 'weekly',
        interval: 2,
        endDate: '2024-12-31',
        count: 10
      });
    });

    it('formats rule with string endDate', () => {
      coerceDateOnly.mockReturnValue('2024-12-31');

      const rule = {
        task_id: 'task-2',
        frequency: 'daily',
        interval: 1,
        endDate: '2024-12-31',
        count: null
      };

      const result = formatRecurrenceRuleForResponse(rule);

      expect(result).toEqual({
        taskId: 'task-2',
        frequency: 'daily',
        interval: 1,
        endDate: '2024-12-31',
        count: null
      });
    });

    it('handles rule with no endDate', () => {
      const rule = {
        taskId: 'task-3',
        frequency: 'monthly',
        interval: 1,
        endDate: null,
        count: 5
      };

      const result = formatRecurrenceRuleForResponse(rule);

      expect(result).toEqual({
        taskId: 'task-3',
        frequency: 'monthly',
        interval: 1,
        endDate: null,
        count: 5
      });
    });

    it('returns null for null input', () => {
      const result = formatRecurrenceRuleForResponse(null);

      expect(result).toBeNull();
    });

    it('defaults count to null when undefined', () => {
      const rule = {
        taskId: 'task-1',
        frequency: 'weekly',
        interval: 1
      };

      const result = formatRecurrenceRuleForResponse(rule);

      expect(result.count).toBeNull();
    });
  });

  describe('formatTaskForAI', () => {
    it('formats task with ISO dueDate', () => {
      formatDateOnlyLocal.mockReturnValue('2024-01-15');

      const task = {
        id: 'task-1',
        name: 'Test Task',
        dueDate: '2024-01-15T10:30:00.000Z'
      };

      const result = formatTaskForAI(task);

      expect(result.dueDate).toBe('2024-01-15');
    });

    it('formats task with Date dueDate', () => {
      formatDateOnlyLocal.mockReturnValue('2024-01-15');

      const task = {
        id: 'task-1',
        name: 'Test Task',
        dueDate: new Date('2024-01-15T10:30:00.000Z')
      };

      const result = formatTaskForAI(task);

      expect(result.dueDate).toBe('2024-01-15');
    });

    it('formats task with plannedTime to readable format', () => {
      const task = {
        id: 'task-1',
        name: 'Test Task',
        plannedTime: '2024-01-15T10:30:00.000Z'
      };

      const result = formatTaskForAI(task);

      expect(result.plannedTime).toContain('at');
      expect(result.plannedTime).toMatch(/\d{1,2}:\d{2}/);
    });

    it('preserves task without dates', () => {
      const task = {
        id: 'task-1',
        name: 'Test Task'
      };

      const result = formatTaskForAI(task);

      expect(result).toEqual(task);
    });

    it('does not modify original task object', () => {
      formatDateOnlyLocal.mockReturnValue('2024-01-15');

      const originalTask = {
        id: 'task-1',
        name: 'Test Task',
        dueDate: '2024-01-15T10:30:00.000Z'
      };

      const originalDueDate = originalTask.dueDate;
      formatTaskForAI(originalTask);

      expect(originalTask.dueDate).toBe(originalDueDate);
    });
  });

  describe('formatNotificationForAI', () => {
    it('formats notification time to local string', () => {
      const notification = {
        id: 'notif-1',
        message: 'Test notification',
        time: '2024-01-15T10:30:00.000Z'
      };

      const result = formatNotificationForAI(notification);

      expect(typeof result.time).toBe('string');
      expect(result.time.length).toBeGreaterThan(0);
    });

    it('preserves notification without time', () => {
      const notification = {
        id: 'notif-1',
        message: 'Test notification'
      };

      const result = formatNotificationForAI(notification);

      expect(result).toEqual(notification);
    });

    it('does not modify original notification object', () => {
      const originalNotification = {
        id: 'notif-1',
        message: 'Test',
        time: '2024-01-15T10:30:00.000Z'
      };

      const originalTime = originalNotification.time;
      formatNotificationForAI(originalNotification);

      expect(originalNotification.time).toBe(originalTime);
    });
  });
});
