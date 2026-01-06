/**
 * Tests for RecurrenceRule Model
 */

import { describe, it, expect } from 'vitest';
import { RecurrenceRule, FREQUENCY } from '../RecurrenceRule.js';

describe('RecurrenceRule', () => {
  describe('constructor', () => {
    it('should create a recurrence rule with default values', () => {
      const rule = new RecurrenceRule();

      expect(rule.id).toBeDefined();
      expect(rule.taskId).toBe('');
      expect(rule.frequency).toBe(FREQUENCY.DAILY);
      expect(rule.interval).toBe(1);
      expect(rule.endDate).toBeNull();
      expect(rule.count).toBeNull();
      expect(rule.createdAt).toBeInstanceOf(Date);
    });

    it('should create a recurrence rule with provided data', () => {
      const data = {
        id: 'rule-1',
        task_id: 'task-1',
        frequency: FREQUENCY.WEEKLY,
        interval: 2,
        end_date: '2024-12-31',
        count: 10,
        created_at: '2024-01-01T00:00:00Z',
      };

      const rule = new RecurrenceRule(data);

      expect(rule.id).toBe('rule-1');
      expect(rule.taskId).toBe('task-1');
      expect(rule.frequency).toBe(FREQUENCY.WEEKLY);
      expect(rule.interval).toBe(2);
      expect(rule.endDate).toBeInstanceOf(Date);
      expect(rule.count).toBe(10);
      expect(rule.createdAt).toBeInstanceOf(Date);
    });

    it('should parse string endDate correctly', () => {
      const data = {
        taskId: 'task-1',
        frequency: FREQUENCY.DAILY,
        interval: 1,
        endDate: '2024-12-31', // String date from form
      };

      const rule = new RecurrenceRule(data);

      expect(rule.endDate).toBeInstanceOf(Date);
      expect(rule.endDate).toEqual(new Date(2024, 11, 31));
    });

    it('should handle invalid date strings', () => {
      const data = {
        taskId: 'task-1',
        frequency: FREQUENCY.DAILY,
        interval: 1,
        endDate: 'invalid-date',
      };

      const rule = new RecurrenceRule(data);

      expect(rule.endDate).toBeNull();
    });

    it('should validate correctly with string endDate from form', () => {
      const data = {
        taskId: 'task-1',
        frequency: FREQUENCY.WEEKLY,
        interval: 2,
        endDate: '2024-12-31', // String date from form
        count: null,
      };

      const rule = new RecurrenceRule(data);

      expect(rule.validate()).toBe(true);
      expect(rule.endDate).toBeInstanceOf(Date);
      expect(rule.endDate).toEqual(new Date(2024, 11, 31));
    });
  });

  describe('validate', () => {
    it('should validate a valid recurrence rule', () => {
      const rule = new RecurrenceRule({
        taskId: 'task-1',
        frequency: FREQUENCY.DAILY,
        interval: 1,
      });

      expect(rule.validate()).toBe(true);
    });

    it('should reject rule without task ID', () => {
      const rule = new RecurrenceRule({
        frequency: FREQUENCY.DAILY,
        interval: 1,
      });

      expect(rule.validate()).toBe(false);
    });

    it('should reject rule with invalid frequency', () => {
      const rule = new RecurrenceRule({
        taskId: 'task-1',
        frequency: 'invalid',
        interval: 1,
      });

      expect(rule.validate()).toBe(false);
    });

    it('should reject rule with invalid interval', () => {
      const rule = new RecurrenceRule({
        taskId: 'task-1',
        frequency: FREQUENCY.DAILY,
        interval: 0,
      });

      expect(rule.validate()).toBe(false);
    });

    it('should reject rule with invalid count', () => {
      const rule = new RecurrenceRule({
        taskId: 'task-1',
        frequency: FREQUENCY.DAILY,
        interval: 1,
        count: 0,
      });

      expect(rule.validate()).toBe(false);
    });
  });

  describe('getNextOccurrence', () => {
    it('should calculate next daily occurrence', () => {
      const rule = new RecurrenceRule({
        taskId: 'task-1',
        frequency: FREQUENCY.DAILY,
        interval: 1,
      });

      const fromDate = new Date('2024-01-01');
      const nextOccurrence = rule.getNextOccurrence(fromDate);

      expect(nextOccurrence).toBeInstanceOf(Date);
      expect(nextOccurrence.toISOString().split('T')[0]).toBe('2024-01-02');
    });

    it('should calculate next weekly occurrence', () => {
      const rule = new RecurrenceRule({
        taskId: 'task-1',
        frequency: FREQUENCY.WEEKLY,
        interval: 2,
      });

      const fromDate = new Date('2024-01-01');
      const nextOccurrence = rule.getNextOccurrence(fromDate);

      expect(nextOccurrence).toBeInstanceOf(Date);
      expect(nextOccurrence.toISOString().split('T')[0]).toBe('2024-01-15');
    });

    it('should calculate next monthly occurrence', () => {
      const rule = new RecurrenceRule({
        taskId: 'task-1',
        frequency: FREQUENCY.MONTHLY,
        interval: 1,
      });

      const fromDate = new Date('2024-01-01');
      const nextOccurrence = rule.getNextOccurrence(fromDate);

      expect(nextOccurrence).toBeInstanceOf(Date);
      expect(nextOccurrence.toISOString().split('T')[0]).toBe('2024-02-01');
    });

    it('should calculate next yearly occurrence', () => {
      const rule = new RecurrenceRule({
        taskId: 'task-1',
        frequency: FREQUENCY.YEARLY,
        interval: 1,
      });

      const fromDate = new Date('2024-01-01');
      const nextOccurrence = rule.getNextOccurrence(fromDate);

      expect(nextOccurrence).toBeInstanceOf(Date);
      expect(nextOccurrence.toISOString().split('T')[0]).toBe('2025-01-01');
    });

    it('should return null when past end date', () => {
      const rule = new RecurrenceRule({
        taskId: 'task-1',
        frequency: FREQUENCY.DAILY,
        interval: 1,
        endDate: new Date('2024-01-01'),
      });

      const fromDate = new Date('2024-01-02');
      const nextOccurrence = rule.getNextOccurrence(fromDate);

      expect(nextOccurrence).toBeNull();
    });

    it('should return null when next occurrence would be past end date', () => {
      const rule = new RecurrenceRule({
        taskId: 'task-1',
        frequency: FREQUENCY.DAILY,
        interval: 1,
        endDate: new Date('2024-01-01'),
      });

      const fromDate = new Date('2024-01-01');
      const nextOccurrence = rule.getNextOccurrence(fromDate);

      expect(nextOccurrence).toBeNull();
    });
  });

  describe('toDatabase', () => {
    it('should convert to database format', () => {
      const rule = new RecurrenceRule({
        id: 'rule-1',
        taskId: 'task-1',
        frequency: FREQUENCY.WEEKLY,
        interval: 2,
        endDate: new Date(2024, 11, 31),
        count: 10,
        createdAt: new Date('2024-01-01'),
      });

      const dbData = rule.toDatabase();

      expect(dbData).toEqual({
        id: 'rule-1',
        task_id: 'task-1',
        frequency: FREQUENCY.WEEKLY,
        interval: 2,
        end_date: '2024-12-31',
        count: 10,
        created_at: '2024-01-01T00:00:00.000Z',
      });
    });

    it('should handle null values', () => {
      const rule = new RecurrenceRule({
        id: 'rule-1',
        taskId: 'task-1',
        frequency: FREQUENCY.DAILY,
        interval: 1,
      });

      const dbData = rule.toDatabase();

      expect(dbData.end_date).toBeNull();
      expect(dbData.count).toBeNull();
    });
  });

  describe('fromDatabase', () => {
    it('should create instance from database data', () => {
      const dbData = {
        id: 'rule-1',
        task_id: 'task-1',
        frequency: FREQUENCY.MONTHLY,
        interval: 3,
        end_date: '2024-12-31',
        count: 5,
        created_at: '2024-01-01T00:00:00.000Z',
      };

      const rule = RecurrenceRule.fromDatabase(dbData);

      expect(rule).toBeInstanceOf(RecurrenceRule);
      expect(rule.id).toBe('rule-1');
      expect(rule.taskId).toBe('task-1');
      expect(rule.frequency).toBe(FREQUENCY.MONTHLY);
      expect(rule.interval).toBe(3);
      expect(rule.endDate).toBeInstanceOf(Date);
      expect(rule.count).toBe(5);
      expect(rule.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('update', () => {
    it('should update rule properties', () => {
      const rule = new RecurrenceRule({
        taskId: 'task-1',
        frequency: FREQUENCY.DAILY,
        interval: 1,
      });

      rule.update({
        frequency: FREQUENCY.WEEKLY,
        interval: 2,
        endDate: new Date('2024-12-31'),
        count: 10,
      });

      expect(rule.frequency).toBe(FREQUENCY.WEEKLY);
      expect(rule.interval).toBe(2);
      expect(rule.endDate).toBeInstanceOf(Date);
      expect(rule.count).toBe(10);
    });

    it('should not update undefined properties', () => {
      const rule = new RecurrenceRule({
        taskId: 'task-1',
        frequency: FREQUENCY.DAILY,
        interval: 1,
      });

      const originalFrequency = rule.frequency;
      const originalInterval = rule.interval;

      rule.update({
        count: 5,
      });

      expect(rule.frequency).toBe(originalFrequency);
      expect(rule.interval).toBe(originalInterval);
      expect(rule.count).toBe(5);
    });
  });
});
