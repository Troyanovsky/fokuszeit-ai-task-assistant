/**
 * Task Validation Composable
 *
 * Responsibility:
 * - Provide date/time validation functions for tasks
 * - Encapsulates business rules about task timing and deadlines
 * - Used across TaskForm, TaskItem, and other task-related components
 *
 * Usage:
 *   const { isPlannedTimeAfterDueDate, isTaskOverdue, isMissedPlannedTime } = useTaskValidation();
 */

import {
  endOfDayLocalFromDateOnly,
  getTodayDateOnlyLocal,
  parseDateOnlyLocal,
} from '../../../../shared/utils/dateTime.js';

/**
 * Check if planned time is after due date
 * @param {string|null} dueDate - Due date in YYYY-MM-DD format
 * @param {string|null} plannedDate - Planned date in YYYY-MM-DD format
 * @param {string|null} plannedTime - Planned time in HH:MM format
 * @returns {boolean} True if planned time is after due date
 */
export function isPlannedTimeAfterDueDate(dueDate, plannedDate, plannedTime) {
  // Only validate if both due date and planned time are set
  if (!dueDate || !plannedDate || !plannedTime) {
    return false;
  }

  const dueEnd = endOfDayLocalFromDateOnly(dueDate);
  if (!dueEnd) return false;

  const plannedDateTime = buildDateTimeFromInput(plannedDate, plannedTime);

  return plannedDateTime > dueEnd;
}

/**
 * Check if due date is in the past
 * @param {string|null} dueDate - Due date in YYYY-MM-DD format
 * @returns {boolean} True if due date is in the past
 */
export function isDueDateInPast(dueDate) {
  if (!dueDate) {
    return false;
  }

  const dueStart = parseDateOnlyLocal(dueDate);
  if (!dueStart) return false;

  const todayStart = parseDateOnlyLocal(getTodayDateOnlyLocal());
  if (!todayStart) return false;

  // Compare dates (allow today)
  return dueStart < todayStart;
}

/**
 * Check if planned time is in the past
 * @param {string|null} plannedDate - Planned date in YYYY-MM-DD format
 * @param {string|null} plannedTime - Planned time in HH:MM format
 * @returns {boolean} True if planned time is in the past
 */
export function isPlannedTimeInPast(plannedDate, plannedTime) {
  if (!plannedDate || !plannedTime) {
    return false;
  }

  const plannedDateTime = buildDateTimeFromInput(plannedDate, plannedTime);
  const now = new Date();

  return plannedDateTime < now;
}

/**
 * Check if task is overdue (past due date and not done)
 * @param {Object} task - Task object
 * @returns {boolean} True if task is overdue
 */
export function isTaskOverdue(task) {
  if (!task.dueDate || task.status === 'done') {
    return false;
  }

  const dueEnd = endOfDayLocalFromDateOnly(task.dueDate);
  if (!dueEnd) {
    return false;
  }
  const now = new Date();

  return now > dueEnd;
}

/**
 * Check if planned time is in the past but task is not started or completed
 * @param {Object} task - Task object
 * @returns {boolean} True if planned time was missed
 */
export function isMissedPlannedTime(task) {
  if (!task.plannedTime || task.status === 'doing' || task.status === 'done') {
    return false;
  }

  const plannedDateTime = new Date(task.plannedTime);
  const now = new Date();

  return now > plannedDateTime;
}

/**
 * Build Date object from date and time input strings
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @param {string} timeString - Time string in HH:MM format
 * @returns {Date} Date object
 */
function buildDateTimeFromInput(dateString, timeString) {
  const [year, month, day] = dateString.split('-');
  const [hours, minutes] = timeString.split(':');

  return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hours, 10), parseInt(minutes, 10));
}

/**
 * Task validation composable
 * Provides validation functions for task dates and timing
 *
 * @returns {Object} Validation functions
 */
export function useTaskValidation() {
  return {
    isPlannedTimeAfterDueDate,
    isDueDateInPast,
    isPlannedTimeInPast,
    isTaskOverdue,
    isMissedPlannedTime,
  };
}
