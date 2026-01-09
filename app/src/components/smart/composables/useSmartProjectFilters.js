/**
 * Smart Project Filters Composable
 *
 * Responsibility:
 * - Provide filtering functions for smart projects (Today, Overdue)
 * - Encapsulates business rules for identifying today and overdue tasks
 * - Used in SmartProjectBase and other smart project components
 *
 * Usage:
 *   const { getTodayTasks, getOverdueTasks } = useSmartProjectFilters();
 */

import { formatDateOnlyLocal } from '../../../../shared/utils/dateTime.js';

/**
 * Get tasks due today or planned for today
 * @param {Array} tasks - Array of task objects
 * @param {string} todayDateStr - Today's date in YYYY-MM-DD format
 * @returns {Array} Tasks due today or planned for today
 */
export function getTodayTasks(tasks, todayDateStr) {
  if (!tasks.length) return [];

  return tasks.filter((task) => {
    // Check if due date is today
    if (task.dueDate === todayDateStr) {
      return true;
    }

    // Check if planned time is today
    if (task.plannedTime) {
      const plannedDate = task.plannedTime instanceof Date ? task.plannedTime : new Date(task.plannedTime);
      const plannedDateOnlyLocal = formatDateOnlyLocal(plannedDate);
      return plannedDateOnlyLocal === todayDateStr;
    }

    return false;
  });
}

/**
 * Get overdue tasks (due before today and not done)
 * @param {Array} tasks - Array of task objects
 * @param {string} todayDateStr - Today's date in YYYY-MM-DD format
 * @returns {Array} Overdue tasks
 */
export function getOverdueTasks(tasks, todayDateStr) {
  if (!tasks.length) return [];

  return tasks.filter((task) => {
    // Check if due date is before today and task is not done
    if (task.dueDate && task.dueDate < todayDateStr && task.status !== 'done') {
      return true;
    }

    // Feature parity: planned time before today also counts as overdue (local calendar date)
    if (task.plannedTime && task.status !== 'done') {
      const plannedDate = task.plannedTime instanceof Date ? task.plannedTime : new Date(task.plannedTime);
      const plannedDateOnlyLocal = formatDateOnlyLocal(plannedDate);
      return plannedDateOnlyLocal !== null && plannedDateOnlyLocal < todayDateStr;
    }

    return false;
  });
}

/**
 * Smart project filters composable
 * Provides filtering functions for smart projects
 *
 * @returns {Object} Filter functions
 */
export function useSmartProjectFilters() {
  return {
    getTodayTasks,
    getOverdueTasks,
  };
}
