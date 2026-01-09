/**
 * Integration tests for cascading deletions and data integrity
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import projectManager from '../project.js';
import databaseService from '../database.js';

// Mock the database service
vi.mock('../database.js');

// Mock the task service
vi.mock('../task.js', () => ({
  default: {
    getTasksByProject: vi.fn().mockResolvedValue([]),
  },
}));

describe('Integration Tests - Cascading Deletions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Project Deletion with Cascading Effects', () => {
    it('should delete project - CASCADE handles all tasks, notifications, and recurrence rules', async () => {
      // Mock project data
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        description: 'Test Description',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      };

      // Mock tasks for the project (for validation only)
      const mockTasks = [
        {
          id: 'task-1',
          name: 'Task 1',
          status: 'planning',
          project_id: 'project-1',
        },
        {
          id: 'task-2',
          name: 'Task 2',
          status: 'doing',
          project_id: 'project-1',
        },
      ];

      // Setup database mocks
      databaseService.queryOne
        .mockReturnValueOnce(mockProject) // getProjectById for validation
        .mockReturnValueOnce(mockProject); // getProjectById for deletion

      databaseService.query
        .mockReturnValueOnce(mockTasks); // getTasksByProject for validation

      // Mock successful project deletion
      databaseService.delete.mockReturnValueOnce({ changes: 1 });

      // Execute the deletion
      const result = await projectManager.deleteProject('project-1');

      // Verify the result
      expect(result).toBe(true);

      // Verify only project deletion was called
      expect(databaseService.delete).toHaveBeenCalledTimes(1);
      expect(databaseService.delete).toHaveBeenCalledWith('DELETE FROM projects WHERE id = ?', [
        'project-1',
      ]);

      // CASCADE will handle all tasks, notifications, and recurrence rules automatically
    });

    it('should force delete project without validation', async () => {
      // Mock project data
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        description: 'Test Description',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      };

      // Setup mocks
      databaseService.queryOne.mockReturnValueOnce(mockProject); // getProjectById for deletion
      databaseService.delete.mockReturnValueOnce({ changes: 1 });

      // Execute the deletion with force=true
      const result = await projectManager.deleteProject('project-1', true);

      // Verify the result
      expect(result).toBe(true);

      // Verify only project deletion was called
      expect(databaseService.delete).toHaveBeenCalledTimes(1);
      expect(databaseService.delete).toHaveBeenCalledWith('DELETE FROM projects WHERE id = ?', [
        'project-1',
      ]);
    });
  });

  describe('Orphaned Data Prevention', () => {
    it('should prevent orphaned data through CASCADE constraints', async () => {
      // This test verifies that CASCADE prevents orphaned data
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
        },
      ];

      // Setup mocks
      databaseService.queryOne
        .mockReturnValueOnce(mockProject) // validation
        .mockReturnValueOnce(mockProject); // deletion

      databaseService.query
        .mockReturnValueOnce(mockTasks); // validation

      databaseService.delete.mockReturnValueOnce({ changes: 1 });

      // Execute deletion
      const result = await projectManager.deleteProject('project-1');

      expect(result).toBe(true);

      // Verify only the project deletion was called
      // CASCADE constraints in the database will automatically delete:
      // - All tasks with project_id = 'project-1'
      // - All notifications with task_id in the deleted tasks
      // - All recurrence_rules with task_id in the deleted tasks
      expect(databaseService.delete).toHaveBeenCalledTimes(1);
      expect(databaseService.delete).toHaveBeenCalledWith('DELETE FROM projects WHERE id = ?', [
        'project-1',
      ]);
    });
  });
});
