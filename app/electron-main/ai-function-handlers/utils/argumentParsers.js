/**
 * Argument validation and transformation utilities for AI function handlers.
 * Handles common argument processing patterns.
 */

import { resolveProjectId } from './projectResolvers.js';
import { formatToYYYYMMDD, parseToISODateTime } from './dateTimeParsers.js';
import { TYPE } from '../../../shared/models/Notification.js';

/**
 * Process common task arguments (dates, project resolution).
 * @param {Object} args - Task arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object|null>} - Processed arguments or error result (null if no error)
 */
export async function processTaskArguments(args, baseResult) {
  // Resolve project ID if provided
  if (args.projectId && typeof args.projectId === 'string') {
    const resolvedProjectId = await resolveProjectId(args.projectId);
    if (resolvedProjectId) {
      args.projectId = resolvedProjectId;
    } else {
      return {
        ...baseResult,
        success: false,
        error: `Project "${args.projectId}" not found`,
        message: `I couldn't find a project named "${args.projectId}". Please specify a valid project name or ID.`
      };
    }
  }

  // Handle dueDate as YYYY-MM-DD string format
  if (args.dueDate && typeof args.dueDate === 'string') {
    args.dueDate = formatToYYYYMMDD(args.dueDate);
  }

  // Convert local time string to ISO format if provided for plannedTime
  if (args.plannedTime && typeof args.plannedTime === 'string') {
    const isoDateTime = parseToISODateTime(args.plannedTime, 'planned time');
    if (isoDateTime) {
      args.plannedTime = isoDateTime;
    } else {
      return {
        ...baseResult,
        success: false,
        error: `Could not parse date/time from: ${args.plannedTime}`,
        message: `I couldn't process the planned time because the format is invalid: ${args.plannedTime}`
      };
    }
  }

  return null; // No error, processing successful
}

/**
 * Validate a recurrence frequency value.
 * @param {string} frequency - Frequency value to validate
 * @returns {boolean} - Whether the frequency is valid
 */
export function validateFrequency(frequency) {
  const validFrequencies = ['daily', 'weekly', 'monthly', 'yearly'];
  return validFrequencies.includes(frequency);
}

/**
 * Validate a notification type value.
 * @param {string} type - Notification type to validate
 * @returns {boolean} - Whether the notification type is valid
 */
export function validateNotificationType(type) {
  return Object.values(TYPE).includes(type);
}
