/**
 * Tests for argumentParsers utility module.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies before imports
vi.mock('../../../ai-function-handlers/utils/projectResolvers.js', () => ({
  resolveProjectId: vi.fn()
}));

vi.mock('../../../ai-function-handlers/utils/dateTimeParsers.js', () => ({
  formatToYYYYMMDD: vi.fn(),
  parseToISODateTime: vi.fn()
}));

import {
  processTaskArguments,
  validateFrequency,
  validateNotificationType
} from '../../../ai-function-handlers/utils/argumentParsers.js';
import { TYPE } from '../../../../shared/models/Notification.js';
import { resolveProjectId } from '../../../ai-function-handlers/utils/projectResolvers.js';
import { formatToYYYYMMDD, parseToISODateTime } from '../../../ai-function-handlers/utils/dateTimeParsers.js';

const baseResult = { queryId: 'test-query' };

describe('argumentParsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processTaskArguments', () => {
    it('resolves project ID when provided as string', async () => {
      resolveProjectId.mockResolvedValue('resolved-project-id');

      const args = { projectId: 'My Project' };
      const result = await processTaskArguments(args, baseResult);

      expect(resolveProjectId).toHaveBeenCalledWith('My Project');
      expect(result).toBeNull(); // No error
      expect(args.projectId).toBe('resolved-project-id');
    });

    it('returns error when project not found', async () => {
      resolveProjectId.mockResolvedValue(null);

      const args = { projectId: 'Nonexistent Project' };
      const result = await processTaskArguments(args, baseResult);

      expect(result).toEqual({
        ...baseResult,
        success: false,
        error: 'Project "Nonexistent Project" not found',
        message: 'I couldn\'t find a project named "Nonexistent Project". Please specify a valid project name or ID.'
      });
    });

    it('does not modify args when projectId is not a string', async () => {
      const args = { projectId: 123 };
      const result = await processTaskArguments(args, baseResult);

      expect(result).toBeNull();
      expect(resolveProjectId).not.toHaveBeenCalled();
      expect(args.projectId).toBe(123);
    });

    it('formats dueDate when provided as string', async () => {
      formatToYYYYMMDD.mockReturnValue('2024-01-15');

      const args = { dueDate: 'Jan 15, 2024' };
      const result = await processTaskArguments(args, baseResult);

      expect(formatToYYYYMMDD).toHaveBeenCalledWith('Jan 15, 2024');
      expect(result).toBeNull();
      expect(args.dueDate).toBe('2024-01-15');
    });

    it('parses plannedTime to ISO format when provided', async () => {
      parseToISODateTime.mockReturnValue('2024-01-15T10:30:00.000Z');

      const args = { plannedTime: 'Jan 15, 2024 10:30 AM' };
      const result = await processTaskArguments(args, baseResult);

      expect(parseToISODateTime).toHaveBeenCalledWith('Jan 15, 2024 10:30 AM', 'planned time');
      expect(result).toBeNull();
      expect(args.plannedTime).toBe('2024-01-15T10:30:00.000Z');
    });

    it('returns error when plannedTime parsing fails', async () => {
      parseToISODateTime.mockReturnValue(null);

      const args = { plannedTime: 'invalid-date' };
      const result = await processTaskArguments(args, baseResult);

      expect(result).toEqual({
        ...baseResult,
        success: false,
        error: 'Could not parse date/time from: invalid-date',
        message: 'I couldn\'t process the planned time because the format is invalid: invalid-date'
      });
    });

    it('processes multiple arguments together', async () => {
      resolveProjectId.mockResolvedValue('proj-id');
      formatToYYYYMMDD.mockReturnValue('2024-01-15');
      parseToISODateTime.mockReturnValue('2024-01-15T10:30:00.000Z');

      const args = {
        projectId: 'My Project',
        dueDate: 'Jan 15, 2024',
        plannedTime: 'Jan 15, 2024 10:30 AM'
      };
      const result = await processTaskArguments(args, baseResult);

      expect(result).toBeNull();
      expect(args.projectId).toBe('proj-id');
      expect(args.dueDate).toBe('2024-01-15');
      expect(args.plannedTime).toBe('2024-01-15T10:30:00.000Z');
    });

    it('handles empty args object', async () => {
      const args = {};
      const result = await processTaskArguments(args, baseResult);

      expect(result).toBeNull();
    });
  });

  describe('validateFrequency', () => {
    it('returns true for valid frequencies', () => {
      expect(validateFrequency('daily')).toBe(true);
      expect(validateFrequency('weekly')).toBe(true);
      expect(validateFrequency('monthly')).toBe(true);
      expect(validateFrequency('yearly')).toBe(true);
    });

    it('returns false for invalid frequencies', () => {
      expect(validateFrequency('hourly')).toBe(false);
      expect(validateFrequency('dailyly')).toBe(false);
      expect(validateFrequency('')).toBe(false);
      expect(validateFrequency(null)).toBe(false);
      expect(validateFrequency(undefined)).toBe(false);
    });
  });

  describe('validateNotificationType', () => {
    it('returns true for valid notification types', () => {
      expect(validateNotificationType(TYPE.REMINDER)).toBe(true);
      expect(validateNotificationType(TYPE.DUE_DATE)).toBe(true);
      expect(validateNotificationType(TYPE.STATUS_CHANGE)).toBe(true);
      expect(validateNotificationType(TYPE.PLANNED_TIME)).toBe(true);
    });

    it('returns false for invalid notification types', () => {
      expect(validateNotificationType('invalid')).toBe(false);
      expect(validateNotificationType('')).toBe(false);
      expect(validateNotificationType(null)).toBe(false);
      expect(validateNotificationType(undefined)).toBe(false);
    });
  });
});
