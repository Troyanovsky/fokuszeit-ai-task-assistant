/**
 * Task Form Transform Composable
 *
 * Responsibility:
 * - Provide functions for transforming between task data and form data
 * - Handles bidirectional conversion between domain models and form representations
 * - Used in TaskForm component for task creation and editing
 *
 * Usage:
 *   const { toDateInputValue, toTimeInputValue, buildTaskData, applyTaskToFormData } = useTaskFormTransform();
 */

import { coerceDateOnly, formatDateOnlyLocal } from '../../../../shared/utils/dateTime.js';
import logger from '../../../services/logger.js';

/**
 * Convert Date to YYYY-MM-DD string for date input
 * @param {Date} date - Date object
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function toDateInputValue(date) {
  return formatDateOnlyLocal(date);
}

/**
 * Convert Date to HH:MM string for time input
 * @param {Date} date - Date object
 * @returns {string} Time string in HH:MM format
 */
export function toTimeInputValue(date) {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Build Date object from date and time input strings
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @param {string} timeString - Time string in HH:MM format
 * @returns {Date} Date object
 */
export function buildDateTimeFromInput(dateString, timeString) {
  const [year, month, day] = dateString.split('-');
  const [hours, minutes] = timeString.split(':');

  return new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hours, 10),
    parseInt(minutes, 10)
  );
}

/**
 * Apply task data to form reactive object
 * @param {Object} task - Task object
 * @param {Object} formData - Form reactive object to populate
 */
export function applyTaskToFormData(task, formData) {
  formData.name = task.name;
  formData.description = task.description || '';
  formData.status = task.status;
  formData.priority = task.priority;
  formData.duration = task.duration !== null ? task.duration : 0;

  if (task.dueDate) {
    formData.dueDate = coerceDateOnly(task.dueDate) ?? '';
  }

  if (task.plannedTime) {
    const plannedDateTime = new Date(task.plannedTime);
    const localDate = plannedDateTime.toLocaleDateString('en-CA');
    const localTime = toTimeInputValue(plannedDateTime);
    formData.plannedDate = localDate;
    formData.plannedTime = localTime;
    logger.info(
      `Converted UTC plannedTime ${task.plannedTime} to local: ${localDate} ${localTime}`
    );
  }
}

/**
 * Build task data object from form data
 * @param {Object} formData - Form reactive object
 * @param {string} projectId - Project ID
 * @param {Object|null} existingTask - Existing task object (for updates)
 * @returns {Object} Task data object
 */
export function buildTaskData(formData, projectId, existingTask) {
  const taskData = {
    name: formData.name.trim(),
    description: formData.description.trim(),
    status: formData.status,
    priority: formData.priority,
    projectId,
    duration: formData.duration !== '' ? Number(formData.duration) : 0,
    dueDate: formData.dueDate || null,
    plannedTime: null,
  };

  if (formData.plannedDate && formData.plannedTime) {
    const plannedDateTime = buildDateTimeFromInput(formData.plannedDate, formData.plannedTime);
    taskData.plannedTime = plannedDateTime.toISOString();
    logger.info(
      `Saving plannedTime: Local ${plannedDateTime.toString()} as UTC ${taskData.plannedTime}`
    );
  }

  if (existingTask) {
    taskData.id = existingTask.id;
    taskData.createdAt = existingTask.createdAt;
  }

  return taskData;
}

/**
 * Reset form data to initial state
 * @param {Object} formData - Form reactive object to reset
 */
export function resetFormData(formData) {
  formData.name = '';
  formData.description = '';
  formData.dueDate = '';
  formData.duration = 0;
  formData.plannedDate = '';
  formData.plannedTime = '';
}

/**
 * Task form transform composable
 * Provides functions for transforming between task and form data
 *
 * @returns {Object} Transform functions
 */
export function useTaskFormTransform() {
  return {
    toDateInputValue,
    toTimeInputValue,
    buildDateTimeFromInput,
    applyTaskToFormData,
    buildTaskData,
    resetFormData,
  };
}
