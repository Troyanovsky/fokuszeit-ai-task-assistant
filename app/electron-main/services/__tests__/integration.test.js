/**
 * Integration tests for cascading deletions and data integrity
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import projectManager from '../project.js';
import notificationService from '../notification.js';
import databaseService from '../database.js';

// Mock the database service
vi.mock('../database.js');
vi.mock('../notification.js');

describe('Integration Tests - Cascading Deletions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Project Deletion with Cascading Effects', () => {
    it('should delete project with all associated tasks, notifications, and recurrence rules', async () => {
      // Mock project data
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        description: 'Test Description',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      };

      // Mock tasks for the project
      const mockTasks = [
        {
          id: 'task-1',
          name: 'Task 1',
          status: 'planning',
          project_id: 'project-1',
          toDatabase: () => ({ id: 'task-1', name: 'Task 1', project_id: 'project-1' }),
        },
        {
          id: 'task-2',
          name: 'Task 2',
          status: 'doing',
          project_id: 'project-1',
          toDatabase: () => ({ id: 'task-2', name: 'Task 2', project_id: 'project-1' }),
        },
      ];

      // Mock notifications for tasks
      const mockNotifications = [
        { id: 'notif-1', taskId: 'task-1' },
        { id: 'notif-2', taskId: 'task-1' },
        { id: 'notif-3', taskId: 'task-2' },
      ];

      // Mock recurrence rules for tasks
      const mockRecurrenceRules = [
        { id: 'rule-1', task_id: 'task-1' },
        { id: 'rule-2', task_id: 'task-2' },
      ];

      // Setup database mocks
      databaseService.queryOne
        .mockReturnValueOnce(mockProject) // getProjectById for validation
        .mockReturnValueOnce(mockProject) // getProjectById for deletion
        .mockReturnValueOnce({ id: 'task-1', name: 'Task 1' }) // getTaskById for task-1
        .mockReturnValueOnce({ id: 'task-2', name: 'Task 2' }); // getTaskById for task-2

      databaseService.query
        .mockReturnValueOnce(mockTasks) // getTasksByProject for validation
        .mockReturnValueOnce(mockTasks) // getTasksByProject for deletion
        .mockReturnValueOnce([mockRecurrenceRules[0]]) // recurrence rules for task-1
        .mockReturnValueOnce([mockRecurrenceRules[1]]); // recurrence rules for task-2

      // Mock notification service
      notificationService.getNotificationsByTask
        .mockResolvedValueOnce([mockNotifications[0], mockNotifications[1]]) // notifications for task-1
        .mockResolvedValueOnce([mockNotifications[2]]); // notifications for task-2

      notificationService.deleteNotification.mockResolvedValue(true);

      // Mock successful deletions
      databaseService.delete
        .mockReturnValueOnce({ changes: 1 }) // recurrence rule deletion for task-1
        .mockReturnValueOnce({ changes: 1 }) // task-1 deletion
        .mockReturnValueOnce({ changes: 1 }) // recurrence rule deletion for task-2
        .mockReturnValueOnce({ changes: 1 }) // task-2 deletion
        .mockReturnValueOnce({ changes: 1 }); // project deletion

      // Execute the deletion
      const result = await projectManager.deleteProject('project-1');

      // Verify the result
      expect(result).toBe(true);

      // Verify all notifications were deleted
      expect(notificationService.deleteNotification).toHaveBeenCalledWith('notif-1');
      expect(notificationService.deleteNotification).toHaveBeenCalledWith('notif-2');
      expect(notificationService.deleteNotification).toHaveBeenCalledWith('notif-3');

      // Verify all recurrence rules were deleted
      expect(databaseService.delete).toHaveBeenCalledWith(
        'DELETE FROM recurrence_rules WHERE id = ?',
        ['rule-1']
      );
      expect(databaseService.delete).toHaveBeenCalledWith(
        'DELETE FROM recurrence_rules WHERE id = ?',
        ['rule-2']
      );

      // Verify all tasks were deleted
      expect(databaseService.delete).toHaveBeenCalledWith('DELETE FROM tasks WHERE id = ?', [
        'task-1',
      ]);
      expect(databaseService.delete).toHaveBeenCalledWith('DELETE FROM tasks WHERE id = ?', [
        'task-2',
      ]);

      // Verify project was deleted
      expect(databaseService.delete).toHaveBeenCalledWith('DELETE FROM projects WHERE id = ?', [
        'project-1',
      ]);
    });

    it('should handle partial failures gracefully', async () => {
      // Mock project and tasks
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        description: 'Test Description',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      };

      const mockTasks = [
        {
          id: 'task-1',
          name: 'Task 1',
          status: 'planning',
          project_id: 'project-1',
          toDatabase: () => ({ id: 'task-1', name: 'Task 1', project_id: 'project-1' }),
        },
      ];

      // Setup mocks
      databaseService.queryOne
        .mockReturnValueOnce(mockProject) // validation
        .mockReturnValueOnce(mockProject) // deletion
        .mockReturnValueOnce({ id: 'task-1', name: 'Task 1' }); // getTaskById

      databaseService.query
        .mockReturnValueOnce(mockTasks) // validation
        .mockReturnValueOnce(mockTasks) // deletion
        .mockReturnValueOnce([]); // no recurrence rules

      // Mock notification deletion failure
      notificationService.getNotificationsByTask.mockResolvedValue([{ id: 'notif-1' }]);
      notificationService.deleteNotification.mockRejectedValue(
        new Error('Notification deletion failed')
      );

      // Mock successful task and project deletion
      databaseService.delete
        .mockReturnValueOnce({ changes: 1 }) // task deletion
        .mockReturnValueOnce({ changes: 1 }); // project deletion

      // Execute deletion
      const result = await projectManager.deleteProject('project-1');

      // Should still succeed despite notification deletion failure
      expect(result).toBe(true);

      // Verify project was still deleted
      expect(databaseService.delete).toHaveBeenCalledWith('DELETE FROM projects WHERE id = ?', [
        'project-1',
      ]);
    });
  });

  describe('Orphaned Data Prevention', () => {
    it('should prevent orphaned tasks by proper cascading deletion', async () => {
      // This test verifies that our fix prevents the original issue
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        description: 'Test Description',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      };

      const mockTasks = [
        {
          id: 'task-1',
          name: 'Orphaned Task',
          status: 'planning',
          project_id: 'project-1',
          toDatabase: () => ({ id: 'task-1', name: 'Orphaned Task', project_id: 'project-1' }),
        },
      ];

      // Setup mocks
      databaseService.queryOne
        .mockReturnValueOnce(mockProject) // validation
        .mockReturnValueOnce(mockProject) // deletion
        .mockReturnValueOnce({ id: 'task-1', name: 'Orphaned Task' }); // getTaskById

      databaseService.query
        .mockReturnValueOnce(mockTasks) // validation
        .mockReturnValueOnce(mockTasks) // deletion
        .mockReturnValueOnce([]); // no recurrence rules

      notificationService.getNotificationsByTask.mockResolvedValue([]);

      databaseService.delete
        .mockReturnValueOnce({ changes: 1 }) // task deletion
        .mockReturnValueOnce({ changes: 1 }); // project deletion

      // Execute deletion
      const result = await projectManager.deleteProject('project-1');

      expect(result).toBe(true);

      // Verify that the task was explicitly deleted before the project
      const deleteCallOrder = databaseService.delete.mock.calls;
      expect(deleteCallOrder[0]).toEqual(['DELETE FROM tasks WHERE id = ?', ['task-1']]);
      expect(deleteCallOrder[1]).toEqual(['DELETE FROM projects WHERE id = ?', ['project-1']]);
    });
  });
});
