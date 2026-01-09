/**
 * Tests for responseFormatters utility module.
 */

import { describe, expect, it } from 'vitest';
import {
  buildTaskResponse,
  buildProjectResponse,
  buildNotificationResponse,
  buildRecurrenceResponse,
  buildErrorResponse,
  buildQueryResponse
} from '../../../ai-function-handlers/utils/responseFormatters.js';

const baseResult = { queryId: 'test-query', timestamp: Date.now() };

describe('responseFormatters', () => {
  describe('buildTaskResponse', () => {
    it('builds successful response with task', () => {
      const task = { id: 'task-1', name: 'Test Task' };
      const result = buildTaskResponse(baseResult, true, task, 'Task created successfully');

      expect(result).toEqual({
        ...baseResult,
        success: true,
        task: { id: 'task-1', name: 'Test Task' },
        taskId: 'task-1',
        message: 'Task created successfully'
      });
    });

    it('builds successful response without task', () => {
      const result = buildTaskResponse(baseResult, true, null, 'Task deleted');

      expect(result).toEqual({
        ...baseResult,
        success: true,
        message: 'Task deleted'
      });
      expect(result).not.toHaveProperty('task');
      expect(result).not.toHaveProperty('taskId');
    });

    it('builds error response', () => {
      const result = buildTaskResponse(baseResult, false, null, 'Task not found');

      expect(result).toEqual({
        ...baseResult,
        success: false,
        message: 'Task not found'
      });
    });
  });

  describe('buildProjectResponse', () => {
    it('builds successful response with project', () => {
      const project = { id: 'proj-1', name: 'Test Project' };
      const result = buildProjectResponse(baseResult, true, project, 'Project created');

      expect(result).toEqual({
        ...baseResult,
        success: true,
        project: { id: 'proj-1', name: 'Test Project' },
        projectId: 'proj-1',
        message: 'Project created'
      });
    });

    it('builds successful response without project', () => {
      const result = buildProjectResponse(baseResult, true, null, 'Project deleted');

      expect(result).toEqual({
        ...baseResult,
        success: true,
        message: 'Project deleted'
      });
      expect(result).not.toHaveProperty('project');
      expect(result).not.toHaveProperty('projectId');
    });
  });

  describe('buildNotificationResponse', () => {
    it('builds successful response with notification', () => {
      const notification = { id: 'notif-1', message: 'Test notification' };
      const result = buildNotificationResponse(baseResult, true, notification, 'Notification added');

      expect(result).toEqual({
        ...baseResult,
        success: true,
        notification: { id: 'notif-1', message: 'Test notification' },
        notificationId: 'notif-1',
        message: 'Notification added'
      });
    });

    it('builds successful response without notification', () => {
      const result = buildNotificationResponse(baseResult, true, null, 'Notification deleted');

      expect(result).toEqual({
        ...baseResult,
        success: true,
        message: 'Notification deleted'
      });
      expect(result).not.toHaveProperty('notification');
      expect(result).not.toHaveProperty('notificationId');
    });
  });

  describe('buildRecurrenceResponse', () => {
    it('builds successful response with recurrence rule', () => {
      const recurrenceRule = { id: 'rule-1', frequency: 'daily' };
      const result = buildRecurrenceResponse(baseResult, true, recurrenceRule, 'task-1', 'Recurrence set');

      expect(result).toEqual({
        ...baseResult,
        success: true,
        recurrenceRule: { id: 'rule-1', frequency: 'daily' },
        taskId: 'task-1',
        message: 'Recurrence set'
      });
    });

    it('builds successful response without recurrence rule', () => {
      const result = buildRecurrenceResponse(baseResult, true, null, 'task-1', 'Recurrence removed');

      expect(result).toEqual({
        ...baseResult,
        success: true,
        taskId: 'task-1',
        message: 'Recurrence removed'
      });
      expect(result).not.toHaveProperty('recurrenceRule');
    });
  });

  describe('buildErrorResponse', () => {
    it('builds error response with error and message', () => {
      const result = buildErrorResponse(baseResult, 'Validation failed', 'Invalid input data');

      expect(result).toEqual({
        ...baseResult,
        success: false,
        error: 'Validation failed',
        message: 'Invalid input data'
      });
    });

    it('always sets success to false', () => {
      const result = buildErrorResponse({ ...baseResult, success: true }, 'Error', 'Error message');

      expect(result.success).toBe(false);
    });
  });

  describe('buildQueryResponse', () => {
    it('builds response with items found', () => {
      const tasks = [
        { id: 'task-1', name: 'Task 1' },
        { id: 'task-2', name: 'Task 2' }
      ];
      const result = buildQueryResponse(baseResult, tasks, 'task', 10, true);

      expect(result).toEqual({
        ...baseResult,
        success: true,
        tasks: [
          { id: 'task-1', name: 'Task 1' },
          { id: 'task-2', name: 'Task 2' }
        ],
        taskIds: ['task-1', 'task-2'],
        message: 'Found 2 tasks matching your criteria.'
      });
    });

    it('builds response with limit reached message', () => {
      const tasks = Array.from({ length: 10 }, (_, i) => ({ id: `task-${i}`, name: `Task ${i}` }));
      const result = buildQueryResponse(baseResult, tasks, 'task', 10, false);

      expect(result.message).toContain('Result limit reached');
      expect(result.message).toBe('Found 10 tasks. (Result limit reached)');
    });

    it('builds response with no items found', () => {
      const result = buildQueryResponse(baseResult, [], 'task', null, true);

      expect(result).toEqual({
        ...baseResult,
        success: true,
        tasks: [],
        taskIds: [],
        message: 'No tasks found matching your criteria.'
      });
    });

    it('handles notifications', () => {
      const notifications = [{ id: 'notif-1', message: 'Test' }];
      const result = buildQueryResponse(baseResult, notifications, 'notification');

      expect(result).toHaveProperty('notifications');
      expect(result).toHaveProperty('notificationIds');
      expect(result.message).toBe('Found 1 notifications.');
    });

    it('handles projects', () => {
      const projects = [{ id: 'proj-1', name: 'Project 1' }];
      const result = buildQueryResponse(baseResult, projects, 'project');

      expect(result).toHaveProperty('projects');
      expect(result).toHaveProperty('projectIds');
      expect(result.message).toBe('Found 1 projects.');
    });
  });
});
