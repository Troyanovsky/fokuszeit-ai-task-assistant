/**
 * Tests for Task Model
 */

import { describe, it, expect } from 'vitest';
import { Task, STATUS, PRIORITY } from '../Task.js';

describe('Task', () => {
  describe('constructor', () => {
    it('should create a task with default values', () => {
      const task = new Task();

      expect(task.id).toBeDefined();
      expect(task.name).toBe('');
      expect(task.description).toBe('');
      expect(task.duration).toBeNull();
      expect(task.projectId).toBe('');
      expect(task.dependencies).toEqual([]);
      expect(task.status).toBe(STATUS.PLANNING);
      expect(task.labels).toEqual([]);
      expect(task.priority).toBe(PRIORITY.MEDIUM);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
      expect(task.dueDate).toBeNull();
      expect(task.plannedTime).toBeNull();
    });

    it('should create a task with provided data', () => {
      const data = {
        id: 'task-1',
        name: 'Test Task',
        description: 'Test description',
        duration: 60,
        project_id: 'project-1',
        dependencies: ['task-2', 'task-3'],
        status: STATUS.DOING,
        labels: ['urgent', 'bug'],
        priority: PRIORITY.HIGH,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-02T11:00:00Z',
        due_date: '2024-12-31',
        planned_time: '2024-01-15T14:30:00Z',
      };

      const task = new Task(data);

      expect(task.id).toBe('task-1');
      expect(task.name).toBe('Test Task');
      expect(task.description).toBe('Test description');
      expect(task.duration).toBe(60);
      expect(task.projectId).toBe('project-1');
      expect(task.dependencies).toEqual(['task-2', 'task-3']);
      expect(task.status).toBe(STATUS.DOING);
      expect(task.labels).toEqual(['urgent', 'bug']);
      expect(task.priority).toBe(PRIORITY.HIGH);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
      expect(task.dueDate).toBe('2024-12-31');
      expect(task.plannedTime).toBeInstanceOf(Date);
    });

    it('should handle null date/time values', () => {
      const data = {
        name: 'Test Task',
        project_id: 'project-1',
        due_date: null,
        planned_time: null,
        duration: null,
      };

      const task = new Task(data);

      expect(task.dueDate).toBeNull();
      expect(task.plannedTime).toBeNull();
      expect(task.duration).toBeNull();
    });

    it('should parse dependencies and labels from JSON strings', () => {
      const data = {
        name: 'Test Task',
        project_id: 'project-1',
        dependencies: '["task-2", "task-3"]',
        labels: '["urgent", "bug"]',
      };

      const task = new Task(data);

      expect(task.dependencies).toEqual(['task-2', 'task-3']);
      expect(task.labels).toEqual(['urgent', 'bug']);
    });
  });

  describe('validate', () => {
    describe('existing validation rules', () => {
      it('should validate a valid task', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          status: STATUS.PLANNING,
          priority: PRIORITY.MEDIUM,
        });

        expect(task.validate()).toBe(true);
      });

      it('should reject task without name', () => {
        const task = new Task({
          project_id: 'project-1',
        });

        expect(task.validate()).toBe(false);
      });

      it('should reject task with empty name', () => {
        const task = new Task({
          name: '   ',
          project_id: 'project-1',
        });

        expect(task.validate()).toBe(false);
      });

      it('should reject task without projectId', () => {
        const task = new Task({
          name: 'Test Task',
        });

        expect(task.validate()).toBe(false);
      });

      it('should reject task with invalid status', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          status: 'invalid',
        });

        expect(task.validate()).toBe(false);
      });

      it('should reject task with invalid priority', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          priority: 'invalid',
        });

        expect(task.validate()).toBe(false);
      });
    });

    describe('dueDate format validation', () => {
      it('should accept valid YYYY-MM-DD format', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          created_at: '2024-01-01T10:00:00Z',
          due_date: '2024-12-31',
        });

        expect(task.validate()).toBe(true);
        expect(task.dueDate).toBe('2024-12-31');
      });

      it('should accept null dueDate', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          due_date: null,
        });

        expect(task.validate()).toBe(true);
        expect(task.dueDate).toBeNull();
      });

      it('should accept undefined dueDate (defaults to null)', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
        });

        expect(task.validate()).toBe(true);
        expect(task.dueDate).toBeNull();
      });

      it('should reject invalid date format', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
        });
        // Manually set invalid dueDate to bypass coerceDateOnly
        task.dueDate = 'invalid-date';

        expect(task.validate()).toBe(false);
      });

      it('should reject non-string dueDate', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
        });
        task.dueDate = 20241231;

        expect(task.validate()).toBe(false);
      });
    });

    describe('plannedTime format validation', () => {
      it('should accept valid ISO 8601 timestamp', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          created_at: '2024-01-01T10:00:00Z',
          planned_time: '2024-12-31T15:30:00Z',
        });

        expect(task.validate()).toBe(true);
        expect(task.plannedTime).toBeInstanceOf(Date);
      });

      it('should accept null plannedTime', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          planned_time: null,
        });

        expect(task.validate()).toBe(true);
        expect(task.plannedTime).toBeNull();
      });

      it('should reject non-Date plannedTime', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
        });
        task.plannedTime = '2024-12-31T15:30:00Z';

        expect(task.validate()).toBe(false);
      });

      it('should reject invalid Date object', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
        });
        task.plannedTime = new Date('invalid');

        expect(task.validate()).toBe(false);
      });
    });

    describe('duration validation', () => {
      it('should accept positive duration', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          duration: 60,
        });

        expect(task.validate()).toBe(true);
        expect(task.duration).toBe(60);
      });

      it('should accept null duration', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          duration: null,
        });

        expect(task.validate()).toBe(true);
        expect(task.duration).toBeNull();
      });

      it('should reject zero duration', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          duration: 0,
        });

        expect(task.validate()).toBe(false);
      });

      it('should reject negative duration', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          duration: -30,
        });

        expect(task.validate()).toBe(false);
      });

      it('should reject non-numeric duration', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
        });
        task.duration = '60';

        expect(task.validate()).toBe(false);
      });
    });

    describe('labels validation', () => {
      it('should accept valid string array', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          labels: ['urgent', 'bug', 'feature'],
        });

        expect(task.validate()).toBe(true);
        expect(task.labels).toEqual(['urgent', 'bug', 'feature']);
      });

      it('should accept empty array', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          labels: [],
        });

        expect(task.validate()).toBe(true);
        expect(task.labels).toEqual([]);
      });

      it('should reject non-array labels', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
        });
        task.labels = 'urgent,bug';

        expect(task.validate()).toBe(false);
      });

      it('should reject array with non-string elements', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
        });
        task.labels = ['urgent', 123, 'bug'];

        expect(task.validate()).toBe(false);
      });
    });

    describe('dependencies validation', () => {
      it('should accept valid string array', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          dependencies: ['task-2', 'task-3', 'task-4'],
        });

        expect(task.validate()).toBe(true);
        expect(task.dependencies).toEqual(['task-2', 'task-3', 'task-4']);
      });

      it('should accept empty array', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          dependencies: [],
        });

        expect(task.validate()).toBe(true);
        expect(task.dependencies).toEqual([]);
      });

      it('should reject non-array dependencies', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
        });
        task.dependencies = 'task-2,task-3';

        expect(task.validate()).toBe(false);
      });

      it('should reject array with non-string elements', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
        });
        task.dependencies = ['task-2', 123, 'task-3'];

        expect(task.validate()).toBe(false);
      });
    });

    describe('dueDate range validation', () => {
      it('should accept dueDate equal to createdAt', () => {
        const createdAt = '2024-01-15T10:00:00Z';
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          created_at: createdAt,
          due_date: '2024-01-15',
        });

        expect(task.validate()).toBe(true);
      });

      it('should accept dueDate after createdAt', () => {
        const createdAt = '2024-01-15T10:00:00Z';
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          created_at: createdAt,
          due_date: '2024-12-31',
        });

        expect(task.validate()).toBe(true);
      });

      it('should reject dueDate before createdAt', () => {
        const createdAt = '2024-01-15T10:00:00Z';
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          created_at: createdAt,
        });
        task.dueDate = '2024-01-10';

        expect(task.validate()).toBe(false);
      });

      it('should skip validation when dueDate is null', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          due_date: null,
        });

        expect(task.validate()).toBe(true);
      });
    });

    describe('plannedTime range validation', () => {
      it('should accept plannedTime equal to createdAt', () => {
        const createdAt = '2024-01-15T10:00:00Z';
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          created_at: createdAt,
          planned_time: createdAt,
        });

        expect(task.validate()).toBe(true);
      });

      it('should accept plannedTime after createdAt', () => {
        const createdAt = '2024-01-15T10:00:00Z';
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          created_at: createdAt,
          planned_time: '2024-12-31T15:30:00Z',
        });

        expect(task.validate()).toBe(true);
      });

      it('should reject plannedTime before createdAt', () => {
        const createdAt = '2024-01-15T10:00:00Z';
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          created_at: createdAt,
        });
        task.plannedTime = new Date('2024-01-10T10:00:00Z');

        expect(task.validate()).toBe(false);
      });

      it('should skip validation when plannedTime is null', () => {
        const task = new Task({
          name: 'Test Task',
          project_id: 'project-1',
          planned_time: null,
        });

        expect(task.validate()).toBe(true);
      });
    });

    describe('combined validation scenarios', () => {
      it('should validate task with all optional fields set correctly', () => {
        const task = new Task({
          name: 'Complete Task',
          project_id: 'project-1',
          created_at: '2024-01-01T10:00:00Z',
          duration: 120,
          due_date: '2024-12-31',
          planned_time: '2024-12-31T15:30:00Z',
          labels: ['urgent', 'feature'],
          dependencies: ['task-2'],
          status: STATUS.DOING,
          priority: PRIORITY.HIGH,
        });

        expect(task.validate()).toBe(true);
      });

      it('should fail validation on first error (name missing)', () => {
        const task = new Task({
          project_id: 'project-1',
          duration: -30, // Invalid
          due_date: 'invalid', // Invalid
          labels: 'not-array', // Invalid
        });

        expect(task.validate()).toBe(false);
        // Should log name error first
      });
    });
  });

  describe('toDatabase', () => {
    it('should convert task to database format', () => {
      const task = new Task({
        id: 'task-1',
        name: 'Test Task',
        description: 'Test description',
        duration: 60,
        project_id: 'project-1',
        dependencies: ['task-2', 'task-3'],
        status: STATUS.DOING,
        labels: ['urgent', 'bug'],
        priority: PRIORITY.HIGH,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-02T11:00:00Z',
        due_date: '2024-12-31',
        planned_time: '2024-01-15T14:30:00Z',
      });

      const dbData = task.toDatabase();

      expect(dbData).toEqual({
        id: 'task-1',
        name: 'Test Task',
        description: 'Test description',
        duration: 60,
        due_date: '2024-12-31',
        planned_time: '2024-01-15T14:30:00.000Z',
        project_id: 'project-1',
        dependencies: JSON.stringify(['task-2', 'task-3']),
        status: STATUS.DOING,
        labels: JSON.stringify(['urgent', 'bug']),
        priority: PRIORITY.HIGH,
        created_at: '2024-01-01T10:00:00.000Z',
        updated_at: '2024-01-02T11:00:00.000Z',
      });
    });

    it('should handle null optional fields', () => {
      const task = new Task({
        name: 'Test Task',
        project_id: 'project-1',
      });

      const dbData = task.toDatabase();

      expect(dbData.duration).toBeNull();
      expect(dbData.due_date).toBeNull();
      expect(dbData.planned_time).toBeNull();
      expect(dbData.dependencies).toBe(JSON.stringify([]));
      expect(dbData.labels).toBe(JSON.stringify([]));
    });
  });

  describe('fromDatabase', () => {
    it('should create task from database data', () => {
      const dbData = {
        id: 'task-1',
        name: 'Test Task',
        description: 'Test description',
        duration: 60,
        due_date: '2024-12-31',
        planned_time: '2024-01-15T14:30:00.000Z',
        project_id: 'project-1',
        dependencies: '["task-2", "task-3"]',
        status: STATUS.DOING,
        labels: '["urgent", "bug"]',
        priority: PRIORITY.HIGH,
        created_at: '2024-01-01T10:00:00.000Z',
        updated_at: '2024-01-02T11:00:00.000Z',
      };

      const task = Task.fromDatabase(dbData);

      expect(task).toBeInstanceOf(Task);
      expect(task.id).toBe('task-1');
      expect(task.name).toBe('Test Task');
      expect(task.description).toBe('Test description');
      expect(task.duration).toBe(60);
      expect(task.dueDate).toBe('2024-12-31');
      expect(task.plannedTime).toBeInstanceOf(Date);
      expect(task.projectId).toBe('project-1');
      expect(task.dependencies).toEqual(['task-2', 'task-3']);
      expect(task.labels).toEqual(['urgent', 'bug']);
      expect(task.status).toBe(STATUS.DOING);
      expect(task.priority).toBe(PRIORITY.HIGH);
    });
  });

  describe('update', () => {
    it('should update task properties', () => {
      const task = new Task({
        name: 'Original Task',
        project_id: 'project-1',
      });

      task.update({
        name: 'Updated Task',
        duration: 90,
        dueDate: '2024-12-31',
        labels: ['updated'],
      });

      expect(task.name).toBe('Updated Task');
      expect(task.duration).toBe(90);
      expect(task.dueDate).toBe('2024-12-31');
      expect(task.labels).toEqual(['updated']);
    });

    it('should not update undefined properties', () => {
      const task = new Task({
        name: 'Test Task',
        project_id: 'project-1',
        duration: 60,
      });

      const originalDuration = task.duration;

      task.update({ name: 'Updated Task' });

      expect(task.name).toBe('Updated Task');
      expect(task.duration).toBe(originalDuration);
    });

    it('should update updatedAt timestamp', async () => {
      const task = new Task({
        name: 'Test Task',
        project_id: 'project-1',
      });

      const originalUpdatedAt = task.updatedAt;
      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      task.update({ name: 'Updated Task' });

      expect(task.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});
