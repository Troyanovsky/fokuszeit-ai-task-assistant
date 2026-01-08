/**
 * Tests for Recurrence Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import recurrenceService from '../recurrence.js';
import { RecurrenceRule, FREQUENCY } from '../../../shared/models/RecurrenceRule.js';
import { Task, STATUS } from '../../../shared/models/Task.js';
import databaseService from '../database.js';

// Mock the database service
vi.mock('../database.js', () => ({
  default: {
    insert: vi.fn(),
    queryOne: vi.fn(),
    query: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('RecurrenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('addRecurrenceRule', () => {
    it('should add a valid recurrence rule', async () => {
      const ruleData = {
        taskId: 'task-1',
        frequency: FREQUENCY.DAILY,
        interval: 1,
        endDate: null,
        count: 5,
      };

      databaseService.insert.mockReturnValue({ changes: 1 });

      const result = await recurrenceService.addRecurrenceRule(ruleData);

      expect(result).toBeTruthy();
      expect(databaseService.insert).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO recurrence_rules'),
        expect.arrayContaining([
          expect.any(String), // id
          'task-1', // task_id
          FREQUENCY.DAILY, // frequency
          1, // interval
          null, // end_date
          5, // count
          expect.any(String), // created_at
        ])
      );
    });

    it('should reject invalid recurrence rule data', async () => {
      const invalidRuleData = {
        taskId: '', // Invalid: empty task ID
        frequency: 'invalid',
        interval: 0,
      };

      const result = await recurrenceService.addRecurrenceRule(invalidRuleData);

      expect(result).toBe(false);
      expect(databaseService.insert).not.toHaveBeenCalled();
    });
  });

  describe('getRecurrenceRuleByTaskId', () => {
    it('should return recurrence rule for valid task ID', async () => {
      const mockRuleData = {
        id: 'rule-1',
        task_id: 'task-1',
        frequency: FREQUENCY.WEEKLY,
        interval: 2,
        end_date: null,
        count: 10,
        created_at: new Date().toISOString(),
      };

      databaseService.queryOne.mockReturnValue(mockRuleData);

      const result = await recurrenceService.getRecurrenceRuleByTaskId('task-1');

      expect(result).toBeInstanceOf(RecurrenceRule);
      expect(result.taskId).toBe('task-1');
      expect(result.frequency).toBe(FREQUENCY.WEEKLY);
      expect(result.interval).toBe(2);
    });

    it('should return null for non-existent task ID', async () => {
      databaseService.queryOne.mockReturnValue(null);

      const result = await recurrenceService.getRecurrenceRuleByTaskId('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('cloneTaskForRecurrence', () => {
    it('should clone task with new due date and reset status', () => {
      const originalTask = new Task({
        id: 'original-task',
        name: 'Test Task',
        description: 'Test Description',
        duration: 60,
        dueDate: '2024-01-01',
        plannedTime: '2024-01-01T10:00:00Z',
        projectId: 'project-1',
        status: STATUS.DONE,
        priority: 'high',
        labels: ['label1', 'label2'],
        dependencies: ['dep1', 'dep2'],
      });

      const newDueDate = new Date('2024-01-02');
      const clonedTask = recurrenceService.cloneTaskForRecurrence(originalTask, newDueDate);

      expect(clonedTask).toBeTruthy();
      expect(clonedTask.id).not.toBe(originalTask.id);
      expect(clonedTask.name).toBe(originalTask.name);
      expect(clonedTask.description).toBe(originalTask.description);
      expect(clonedTask.dueDate).toBe('2024-01-02');
      expect(clonedTask.plannedTime).toBeNull();
      expect(clonedTask.status).toBe(STATUS.PLANNING);
      expect(clonedTask.projectId).toBe(originalTask.projectId);
      expect(clonedTask.priority).toBe(originalTask.priority);
      expect(clonedTask.labels).toEqual(originalTask.labels);
      expect(clonedTask.dependencies).toEqual(originalTask.dependencies);
    });

    it('should handle task with null/undefined properties', () => {
      const originalTask = new Task({
        id: 'original-task',
        name: 'Test Task',
        projectId: 'project-1',
      });

      const newDueDate = new Date('2024-01-02');
      const clonedTask = recurrenceService.cloneTaskForRecurrence(originalTask, newDueDate);

      expect(clonedTask).toBeTruthy();
      expect(clonedTask.description).toBe('');
      expect(clonedTask.duration).toBeNull();
      expect(clonedTask.labels).toEqual([]);
      expect(clonedTask.dependencies).toEqual([]);
    });
  });

  describe('shouldContinueRecurrence', () => {
    it('should return false when end date is passed', () => {
      const rule = new RecurrenceRule({
        taskId: 'task-1',
        frequency: FREQUENCY.DAILY,
        interval: 1,
        endDate: new Date('2024-01-01'),
        count: null,
      });

      const nextOccurrence = new Date('2024-01-02');
      const result = recurrenceService.shouldContinueRecurrence(rule, nextOccurrence);

      expect(result).toBe(false);
    });

    it('should return false when count reaches zero', () => {
      // Create a rule and manually set count to 0 to bypass validation
      const rule = new RecurrenceRule({
        taskId: 'task-1',
        frequency: FREQUENCY.DAILY,
        interval: 1,
        endDate: null,
        count: 1, // Start with valid count
      });
      rule.count = 0; // Manually set to 0 to test the logic

      const nextOccurrence = new Date('2024-01-02');
      const result = recurrenceService.shouldContinueRecurrence(rule, nextOccurrence);

      expect(result).toBe(false);
    });

    it('should return true when recurrence should continue', () => {
      const rule = new RecurrenceRule({
        taskId: 'task-1',
        frequency: FREQUENCY.DAILY,
        interval: 1,
        endDate: new Date('2024-12-31'),
        count: 5,
      });

      const nextOccurrence = new Date('2024-01-02');
      const result = recurrenceService.shouldContinueRecurrence(rule, nextOccurrence);

      expect(result).toBe(true);
    });
  });

  describe('processTaskCompletion', () => {
    it('should create new recurring task when task is completed', async () => {
      const taskData = {
        id: 'task-1',
        name: 'Test Task',
        description: 'Test Description',
        due_date: '2024-01-01',
        project_id: 'project-1',
        status: STATUS.DONE,
        priority: 'medium',
        duration: 60,
        planned_time: null,
        dependencies: '[]',
        labels: '[]',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const ruleData = {
        id: 'rule-1',
        task_id: 'task-1',
        frequency: FREQUENCY.DAILY,
        interval: 1,
        end_date: null,
        count: 5,
        created_at: new Date().toISOString(),
      };

      databaseService.queryOne
        .mockReturnValueOnce(taskData) // getTaskById
        .mockReturnValueOnce(ruleData) // getRecurrenceRuleByTaskId
        .mockReturnValueOnce(ruleData); // getRecurrenceRuleById (for updateRecurrenceRule)

      databaseService.insert.mockReturnValue({ changes: 1 });
      databaseService.update.mockReturnValue({ changes: 1 });

      const result = await recurrenceService.processTaskCompletion('task-1');

      expect(result).toBeTruthy();
      expect(result.id).not.toBe('task-1');
      expect(result.name).toBe('Test Task');
      expect(result.status).toBe(STATUS.PLANNING);
      expect(databaseService.insert).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tasks'),
        expect.any(Array)
      );
      expect(databaseService.update).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE recurrence_rules'),
        expect.arrayContaining([
          expect.any(String), // task_id (new task ID)
          FREQUENCY.DAILY,
          1,
          null,
          4, // count decremented
          'rule-1',
        ])
      );
    });

    it('should return null when no recurrence rule exists', async () => {
      const taskData = {
        id: 'task-1',
        name: 'Test Task',
        status: STATUS.DONE,
      };

      databaseService.queryOne
        .mockReturnValueOnce(taskData) // getTaskById
        .mockReturnValueOnce(null); // getRecurrenceRuleByTaskId

      const result = await recurrenceService.processTaskCompletion('task-1');

      expect(result).toBeNull();
      expect(databaseService.insert).not.toHaveBeenCalled();
    });

    it('should delete rule and return null when recurrence should end', async () => {
      const taskData = {
        id: 'task-1',
        name: 'Test Task',
        due_date: '2024-01-01',
        status: STATUS.DONE,
      };

      const ruleData = {
        id: 'rule-1',
        task_id: 'task-1',
        frequency: FREQUENCY.DAILY,
        interval: 1,
        end_date: '2024-01-01', // End date reached
        count: null,
        created_at: new Date().toISOString(),
      };

      databaseService.queryOne.mockReturnValueOnce(taskData).mockReturnValueOnce(ruleData);

      databaseService.delete.mockReturnValue({ changes: 1 });

      const result = await recurrenceService.processTaskCompletion('task-1');

      expect(result).toBeNull();
      expect(databaseService.delete).toHaveBeenCalledWith(
        'DELETE FROM recurrence_rules WHERE id = ?',
        ['rule-1']
      );
    });
  });
});
