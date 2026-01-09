/**
 * Tests for useTaskFilters composable
 */

import { describe, it, expect } from 'vitest';
import { filterTasksByStatus, filterTasksByPriority, filterTasksBySearchTerm, applyTaskFilters } from '../useTaskFilters.js';

describe('useTaskFilters', () => {
  const mockTasks = [
    { id: '1', name: 'Task 1', status: 'planning', priority: 'high', description: 'Important task' },
    { id: '2', name: 'Task 2', status: 'doing', priority: 'medium', description: 'Work in progress' },
    { id: '3', name: 'Task 3', status: 'done', priority: 'low', description: 'Completed task' },
    { id: '4', name: 'Bug Fix', status: 'planning', priority: 'high', description: 'Fix critical bug' },
  ];

  describe('filterTasksByStatus', () => {
    it('should return all tasks when status is "all"', () => {
      const result = filterTasksByStatus(mockTasks, 'all');
      expect(result).toHaveLength(4);
    });

    it('should filter tasks by status', () => {
      const result = filterTasksByStatus(mockTasks, 'planning');
      expect(result).toHaveLength(2);
      expect(result.every((task) => task.status === 'planning')).toBe(true);
    });

    it('should return empty array when no tasks match', () => {
      const result = filterTasksByStatus(mockTasks, 'doing');
      expect(result).toHaveLength(1);
    });
  });

  describe('filterTasksByPriority', () => {
    it('should return all tasks when priority is "all"', () => {
      const result = filterTasksByPriority(mockTasks, 'all');
      expect(result).toHaveLength(4);
    });

    it('should filter tasks by priority', () => {
      const result = filterTasksByPriority(mockTasks, 'high');
      expect(result).toHaveLength(2);
      expect(result.every((task) => task.priority === 'high')).toBe(true);
    });

    it('should return empty array when no tasks match', () => {
      const result = filterTasksByPriority(mockTasks, 'low');
      expect(result).toHaveLength(1);
    });
  });

  describe('filterTasksBySearchTerm', () => {
    it('should return all tasks when search term is empty', () => {
      const result = filterTasksBySearchTerm(mockTasks, '');
      expect(result).toHaveLength(4);
    });

    it('should filter tasks by name', () => {
      const result = filterTasksBySearchTerm(mockTasks, 'Bug');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bug Fix');
    });

    it('should filter tasks by description', () => {
      const result = filterTasksBySearchTerm(mockTasks, 'critical');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bug Fix');
    });

    it('should be case insensitive', () => {
      const result = filterTasksBySearchTerm(mockTasks, 'TASK');
      expect(result).toHaveLength(3);
    });

    it('should return empty array when no tasks match', () => {
      const result = filterTasksBySearchTerm(mockTasks, 'nonexistent');
      expect(result).toHaveLength(0);
    });
  });

  describe('applyTaskFilters', () => {
    it('should apply all filters together', () => {
      const filters = {
        status: 'planning',
        priority: 'high',
        search: 'Task',
      };

      const result = applyTaskFilters(mockTasks, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should apply partial filters', () => {
      const filters = {
        status: 'planning',
        priority: 'all',
        search: '',
      };

      const result = applyTaskFilters(mockTasks, filters);
      expect(result).toHaveLength(2);
      expect(result.every((task) => task.status === 'planning')).toBe(true);
    });

    it('should return all tasks when all filters are "all" or empty', () => {
      const filters = {
        status: 'all',
        priority: 'all',
        search: '',
      };

      const result = applyTaskFilters(mockTasks, filters);
      expect(result).toHaveLength(4);
    });
  });
});
