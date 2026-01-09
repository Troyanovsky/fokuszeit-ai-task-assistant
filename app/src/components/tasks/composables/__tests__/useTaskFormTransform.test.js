/**
 * Tests for useTaskFormTransform composable
 */

import { describe, it, expect } from 'vitest';
import { toDateInputValue, toTimeInputValue, buildDateTimeFromInput, buildTaskData } from '../useTaskFormTransform.js';

describe('useTaskFormTransform', () => {
  describe('toDateInputValue', () => {
    it('should convert Date to YYYY-MM-DD format', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      const result = toDateInputValue(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('toTimeInputValue', () => {
    it('should convert Date to HH:MM format', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      const result = toTimeInputValue(date);
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should pad single digits with zeros', () => {
      // Create a date with single digit hour and minute
      const date = new Date(2025, 0, 15, 1, 5, 0);
      const result = toTimeInputValue(date);
      expect(result).toBe('01:05');
    });
  });

  describe('buildDateTimeFromInput', () => {
    it('should build Date from date and time strings', () => {
      const result = buildDateTimeFromInput('2025-01-15', '10:30');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(15);
      expect(result.getHours()).toBe(10);
      expect(result.getMinutes()).toBe(30);
    });
  });

  describe('buildTaskData', () => {
    it('should build task data from form data', () => {
      const formData = {
        name: 'Test Task',
        description: 'Test Description',
        status: 'planning',
        priority: 'high',
        duration: 60,
        dueDate: '2025-01-15',
        plannedDate: '2025-01-15',
        plannedTime: '10:00',
      };

      const result = buildTaskData(formData, 'project-1', null);

      expect(result.name).toBe('Test Task');
      expect(result.description).toBe('Test Description');
      expect(result.status).toBe('planning');
      expect(result.priority).toBe('high');
      expect(result.duration).toBe(60);
      expect(result.projectId).toBe('project-1');
      expect(result.dueDate).toBe('2025-01-15');
      expect(result.plannedTime).toBeDefined();
    });

    it('should handle empty planned time', () => {
      const formData = {
        name: 'Test Task',
        description: '',
        status: 'planning',
        priority: 'medium',
        duration: 0,
        dueDate: '',
        plannedDate: '',
        plannedTime: '',
      };

      const result = buildTaskData(formData, 'project-1', null);

      expect(result.name).toBe('Test Task');
      expect(result.description).toBe('');
      expect(result.dueDate).toBe(null);
      expect(result.plannedTime).toBe(null);
    });

    it('should include id and createdAt for existing tasks', () => {
      const formData = {
        name: 'Updated Task',
        description: 'Updated Description',
        status: 'doing',
        priority: 'high',
        duration: 90,
        dueDate: '2025-01-20',
        plannedDate: '',
        plannedTime: '',
      };

      const existingTask = {
        id: 'task-1',
        createdAt: new Date('2025-01-01T00:00:00Z'),
      };

      const result = buildTaskData(formData, 'project-1', existingTask);

      expect(result.id).toBe('task-1');
      expect(result.createdAt).toBe(existingTask.createdAt);
    });

    it('should trim whitespace from name and description', () => {
      const formData = {
        name: '  Test Task  ',
        description: '  Test Description  ',
        status: 'planning',
        priority: 'medium',
        duration: 30,
        dueDate: '',
        plannedDate: '',
        plannedTime: '',
      };

      const result = buildTaskData(formData, 'project-1', null);

      expect(result.name).toBe('Test Task');
      expect(result.description).toBe('Test Description');
    });
  });
});
