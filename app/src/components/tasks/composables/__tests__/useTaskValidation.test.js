/**
 * Tests for useTaskValidation composable
 */

import { describe, it, expect } from 'vitest';
import { isPlannedTimeAfterDueDate, isDueDateInPast, isPlannedTimeInPast, isTaskOverdue, isMissedPlannedTime } from '../useTaskValidation.js';

describe('useTaskValidation', () => {
  describe('isPlannedTimeAfterDueDate', () => {
    it('should return false when due date or planned time is missing', () => {
      expect(isPlannedTimeAfterDueDate(null, null, null)).toBe(false);
      expect(isPlannedTimeAfterDueDate('2025-01-01', null, null)).toBe(false);
      expect(isPlannedTimeAfterDueDate(null, '2025-01-01', '10:00')).toBe(false);
    });

    it('should return false when planned time is before due date end', () => {
      expect(isPlannedTimeAfterDueDate('2025-01-10', '2025-01-10', '10:00')).toBe(false);
    });

    it('should return true when planned time is after due date end', () => {
      expect(isPlannedTimeAfterDueDate('2025-01-10', '2025-01-11', '10:00')).toBe(true);
    });
  });

  describe('isDueDateInPast', () => {
    it('should return false for null or undefined due date', () => {
      expect(isDueDateInPast(null)).toBe(false);
      expect(isDueDateInPast(undefined)).toBe(false);
    });

    it('should return false for future due date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      expect(isDueDateInPast(futureDate.toISOString().split('T')[0])).toBe(false);
    });

    it('should return false for today', () => {
      const today = new Date().toISOString().split('T')[0];
      expect(isDueDateInPast(today)).toBe(false);
    });

    it('should return true for past due date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      expect(isDueDateInPast(pastDate.toISOString().split('T')[0])).toBe(true);
    });
  });

  describe('isPlannedTimeInPast', () => {
    it('should return false when planned date or time is missing', () => {
      expect(isPlannedTimeInPast(null, null)).toBe(false);
      expect(isPlannedTimeInPast('2025-01-01', null)).toBe(false);
    });

    it('should return true for past planned time', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const pastDateStr = pastDate.toISOString().split('T')[0];
      expect(isPlannedTimeInPast(pastDateStr, '10:00')).toBe(true);
    });
  });

  describe('isTaskOverdue', () => {
    it('should return false for tasks without due date', () => {
      expect(isTaskOverdue({ dueDate: null, status: 'planning' })).toBe(false);
    });

    it('should return false for completed tasks', () => {
      expect(isTaskOverdue({ dueDate: '2020-01-01', status: 'done' })).toBe(false);
    });

    it('should return true for tasks with past due date and not done', () => {
      expect(isTaskOverdue({ dueDate: '2020-01-01', status: 'planning' })).toBe(true);
    });
  });

  describe('isMissedPlannedTime', () => {
    it('should return false for tasks without planned time', () => {
      expect(isMissedPlannedTime({ plannedTime: null, status: 'planning' })).toBe(false);
    });

    it('should return false for tasks in progress or completed', () => {
      expect(isMissedPlannedTime({ plannedTime: new Date('2020-01-01'), status: 'doing' })).toBe(false);
      expect(isMissedPlannedTime({ plannedTime: new Date('2020-01-01'), status: 'done' })).toBe(false);
    });

    it('should return true for tasks with missed planned time', () => {
      const pastTime = new Date();
      pastTime.setHours(pastTime.getHours() - 1);
      expect(isMissedPlannedTime({ plannedTime: pastTime, status: 'planning' })).toBe(true);
    });
  });
});
