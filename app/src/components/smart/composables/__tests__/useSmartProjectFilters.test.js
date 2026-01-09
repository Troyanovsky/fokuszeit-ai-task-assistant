/**
 * Tests for useSmartProjectFilters composable
 */

import { describe, it, expect } from 'vitest';
import { getTodayTasks, getOverdueTasks } from '../useSmartProjectFilters.js';

describe('useSmartProjectFilters', () => {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const mockTasks = [
    { id: '1', name: 'Task due today', dueDate: today, plannedTime: null, status: 'planning' },
    { id: '2', name: 'Task due yesterday', dueDate: yesterdayStr, plannedTime: null, status: 'planning' },
    { id: '3', name: 'Task due tomorrow', dueDate: tomorrowStr, plannedTime: null, status: 'planning' },
    { id: '4', name: 'Completed task', dueDate: yesterdayStr, plannedTime: null, status: 'done' },
    {
      id: '5',
      name: 'Task planned today',
      dueDate: null,
      plannedTime: new Date().toISOString(),
      status: 'planning',
    },
  ];

  describe('getTodayTasks', () => {
    it('should return empty array when no tasks', () => {
      const result = getTodayTasks([], today);
      expect(result).toHaveLength(0);
    });

    it('should return tasks due today', () => {
      const result = getTodayTasks(mockTasks, today);
      expect(result.some((task) => task.id === '1')).toBe(true);
    });

    it('should return tasks planned for today', () => {
      const result = getTodayTasks(mockTasks, today);
      expect(result.some((task) => task.id === '5')).toBe(true);
    });

    it('should not return tasks due on other days', () => {
      const result = getTodayTasks(mockTasks, today);
      expect(result.some((task) => task.id === '2')).toBe(false);
      expect(result.some((task) => task.id === '3')).toBe(false);
    });
  });

  describe('getOverdueTasks', () => {
    it('should return empty array when no tasks', () => {
      const result = getOverdueTasks([], today);
      expect(result).toHaveLength(0);
    });

    it('should return tasks with past due date and not done', () => {
      const result = getOverdueTasks(mockTasks, today);
      expect(result.some((task) => task.id === '2')).toBe(true);
    });

    it('should not return completed tasks', () => {
      const result = getOverdueTasks(mockTasks, today);
      expect(result.some((task) => task.id === '4')).toBe(false);
    });

    it('should not return tasks due today', () => {
      const result = getOverdueTasks(mockTasks, today);
      expect(result.some((task) => task.id === '1')).toBe(false);
    });

    it('should not return future tasks', () => {
      const result = getOverdueTasks(mockTasks, today);
      expect(result.some((task) => task.id === '3')).toBe(false);
    });
  });
});
