/**
 * Task Formatting Composable
 *
 * Responsibility:
 * - Provide date/time formatting functions for task display
 * - Handles relative date formatting ("Today", "Tomorrow")
 * - Provides duration and time formatting
 *
 * Usage:
 *   const { formatTaskDate, formatTaskDateTime, formatTaskDuration } = useTaskFormatting();
 */

import { parseDateOnlyLocal } from '../../../../shared/utils/dateTime.js';
import logger from '../../../services/logger.js';

/**
 * Format date for display
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date
 */
export function formatTaskDate(dateString) {
  const parsed = parseDateOnlyLocal(dateString);
  if (parsed) {
    return parsed.toLocaleDateString();
  }
  const fallback = new Date(dateString);
  return isNaN(fallback.getTime()) ? 'Invalid date' : fallback.toLocaleDateString();
}

/**
 * Format date-time with relative "Today"/"Tomorrow" labels
 * @param {string} dateTimeString - ISO 8601 date-time string
 * @returns {string} Formatted date-time with relative label
 */
export function formatTaskDateTime(dateTimeString) {
  // Ensure we're working with a valid date
  const date = new Date(dateTimeString);
  if (isNaN(date)) {
    logger.error(`Invalid date string: ${dateTimeString}`);
    return 'Invalid date';
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Format time in user's local time zone
  const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
  const timeStr = date.toLocaleTimeString(undefined, timeOptions);

  // Check if it's today
  if (date.toDateString() === today.toDateString()) {
    return `Today, ${timeStr}`;
  }

  // Check if it's tomorrow
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow, ${timeStr}`;
  }

  // Otherwise, show date and time
  const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${date.toLocaleDateString(undefined, dateOptions)}, ${timeStr}`;
}

/**
 * Format duration in minutes to human-readable format
 * @param {number|null} minutes - Duration in minutes
 * @returns {string} Formatted duration (e.g., "30m", "1h 30m", "2h")
 */
export function formatTaskDuration(minutes) {
  const mins = minutes !== null ? minutes : 30;
  if (mins < 60) {
    return `${mins} min`;
  } else {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  }
}

/**
 * Format time as HH:MM
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted time
 */
export function formatTime(dateInput) {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format hour only (HH:MM)
 * @param {Date} date - Date object
 * @returns {string} Formatted time
 */
export function formatHour(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Calculate and format end time based on start time and duration
 * @param {string} startTimeStr - Start time as ISO 8601 string
 * @param {number|null} duration - Duration in minutes
 * @returns {string} Formatted end time
 */
export function formatEndTime(startTimeStr, duration) {
  const startTime = new Date(startTimeStr);
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + (duration !== null ? duration : 30));
  return endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Capitalize first letter of string
 * @param {string} str - Input string
 * @returns {string} String with first letter capitalized
 */
export function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Task formatting composable
 * Provides formatting functions for task display
 *
 * @returns {Object} Formatting functions
 */
export function useTaskFormatting() {
  return {
    formatTaskDate,
    formatTaskDateTime,
    formatTaskDuration,
    formatTime,
    formatHour,
    formatEndTime,
    capitalizeFirst,
  };
}
