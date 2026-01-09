/**
 * Date/time parsing and AI formatting utilities for AI function handlers.
 * Handles conversion between various date formats and AI-readable representations.
 */

import logger from '../../logger.js';
import { coerceDateOnly, formatDateOnlyLocal } from '../../../shared/utils/dateTime.js';

/**
 * Utility function to format a date string to YYYY-MM-DD format.
 * @param {string} dateString - Date string to format
 * @returns {string|null} - Formatted date string or null if invalid
 */
export function formatToYYYYMMDD(dateString) {
  try {
    logger.info(`Original date input: ${dateString}`);

    const formatted = coerceDateOnly(dateString);
    if (!formatted) {
      logger.info(`Invalid date format: ${dateString}`);
      return null;
    }

    logger.info(`Normalized date to YYYY-MM-DD (local calendar): ${formatted}`);
    return formatted;
  } catch (error) {
    logger.logError(error, 'Error parsing date');
    return null;
  }
}

/**
 * Utility function to format a Date to YYYY-MM-DD using local calendar values.
 * @param {Date} dateValue - Date value to format
 * @returns {string|null} - Formatted date string or null if invalid
 */
export function formatDateToYYYYMMDDLocal(dateValue) {
  return formatDateOnlyLocal(dateValue);
}

/**
 * Utility function to parse a date-time string to ISO format.
 * @param {string} timeString - Date-time string to parse
 * @param {string} context - Context for logging
 * @returns {string|null} - Parsed date-time in ISO format or null if invalid
 */
export function parseToISODateTime(timeString, context = 'date-time') {
  try {
    // Try parsing as ISO first to see if it's already in ISO format
    let parsedTime = new Date(timeString);

    // If invalid or looks like a local date format, try parsing it as a local date
    if (isNaN(parsedTime) || !timeString.includes('T')) {
      // This is likely a local date format (e.g., "May 31, 2023 15:30" or "5/31/2023 15:30")
      logger.info(`Converting local date format for ${context}: ${timeString}`);

      // Try to parse date using more flexible approach
      parsedTime = new Date(timeString);

      // If still invalid, try some common formats
      if (isNaN(parsedTime)) {
        logger.info(`Failed to parse date directly, attempting structured parsing`);
        // Try to extract date and time components from common formats
        const dateTimeParts = timeString.split(/,\s*| /);
        if (dateTimeParts.length >= 2) {
          // Last part is likely the time
          const timePart = dateTimeParts[dateTimeParts.length - 1];
          // Join the rest as the date part
          const datePart = dateTimeParts.slice(0, dateTimeParts.length - 1).join(' ');
          parsedTime = new Date(`${datePart} ${timePart}`);
        }
      }
    }

    if (isNaN(parsedTime)) {
      logger.info(`Failed to parse ${context}: ${timeString}`);
      return null;
    }

    // Convert to ISO string
    const isoString = parsedTime.toISOString();
    logger.info(`Parsed ${context} from "${timeString}" to ISO: ${isoString}`);
    return isoString;
  } catch (error) {
    logger.logError(error, `Error parsing ${context}`);
    return null;
  }
}

/**
 * Utility function to format a recurrence rule for AI responses.
 * @param {Object} rule - Recurrence rule instance
 * @returns {Object|null} - Formatted recurrence rule or null if invalid
 */
export function formatRecurrenceRuleForResponse(rule) {
  if (!rule) {
    return null;
  }

  let endDate = null;
  if (rule.endDate instanceof Date) {
    endDate = formatDateToYYYYMMDDLocal(rule.endDate);
  } else if (typeof rule.endDate === 'string') {
    endDate = formatToYYYYMMDD(rule.endDate);
  }

  return {
    taskId: rule.taskId || rule.task_id,
    frequency: rule.frequency,
    interval: rule.interval,
    endDate,
    count: rule.count ?? null
  };
}

/**
 * Format a task for AI readability with consistent date/time formats.
 * @param {Object} task - Task object to format
 * @returns {Object} - Formatted task with AI-readable date/time fields
 */
export function formatTaskForAI(task) {
  const formattedTask = { ...task };

  // Ensure dueDate is consistently in YYYY-MM-DD format
  if (formattedTask.dueDate) {
    // If it has time component, extract just the date part
    if (typeof formattedTask.dueDate === 'string' && formattedTask.dueDate.includes('T')) {
      formattedTask.dueDate = formattedTask.dueDate.split('T')[0];
    } else if (formattedTask.dueDate instanceof Date) {
      // Convert Date object to YYYY-MM-DD string
      formattedTask.dueDate = formatDateOnlyLocal(formattedTask.dueDate);
    }
  }

  // Convert plannedTime to user-friendly local time string if it exists
  if (formattedTask.plannedTime) {
    const plannedTime = new Date(formattedTask.plannedTime);
    // Format with date and time components for better readability
    const dateOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    formattedTask.plannedTime = `${plannedTime.toLocaleDateString(undefined, dateOptions)} at ${plannedTime.toLocaleTimeString(undefined, timeOptions)}`;
  }

  return formattedTask;
}

/**
 * Format a notification for AI readability with local time format.
 * @param {Object} notification - Notification object to format
 * @returns {Object} - Formatted notification with AI-readable time field
 */
export function formatNotificationForAI(notification) {
  const formattedNotification = { ...notification };

  // Convert notification time to local time string if it exists
  if (formattedNotification.time) {
    const time = new Date(formattedNotification.time);
    formattedNotification.time = time.toLocaleString();
  }

  return formattedNotification;
}
