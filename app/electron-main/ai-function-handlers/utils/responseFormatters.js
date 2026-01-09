/**
 * Standardized response builders for AI function handler results.
 * Provides consistent response structure across all handlers.
 */

/**
 * Build a task-related response.
 * @param {Object} baseResult - Base result object
 * @param {boolean} success - Whether the operation succeeded
 * @param {Object} task - Task object (optional)
 * @param {string} message - Response message
 * @returns {Object} - Formatted response object
 */
export function buildTaskResponse(baseResult, success, task, message) {
  return {
    ...baseResult,
    success,
    ...(task && { task, taskId: task.id }),
    message
  };
}

/**
 * Build a project-related response.
 * @param {Object} baseResult - Base result object
 * @param {boolean} success - Whether the operation succeeded
 * @param {Object} project - Project object (optional)
 * @param {string} message - Response message
 * @returns {Object} - Formatted response object
 */
export function buildProjectResponse(baseResult, success, project, message) {
  return {
    ...baseResult,
    success,
    ...(project && { project, projectId: project.id }),
    message
  };
}

/**
 * Build a notification-related response.
 * @param {Object} baseResult - Base result object
 * @param {boolean} success - Whether the operation succeeded
 * @param {Object} notification - Notification object (optional)
 * @param {string} message - Response message
 * @returns {Object} - Formatted response object
 */
export function buildNotificationResponse(baseResult, success, notification, message) {
  return {
    ...baseResult,
    success,
    ...(notification && { notification, notificationId: notification.id }),
    message
  };
}

/**
 * Build a recurrence-related response.
 * @param {Object} baseResult - Base result object
 * @param {boolean} success - Whether the operation succeeded
 * @param {Object} recurrenceRule - Recurrence rule object (optional)
 * @param {string} taskId - Task ID
 * @param {string} message - Response message
 * @returns {Object} - Formatted response object
 */
export function buildRecurrenceResponse(baseResult, success, recurrenceRule, taskId, message) {
  return {
    ...baseResult,
    success,
    ...(recurrenceRule && { recurrenceRule }),
    taskId,
    message
  };
}

/**
 * Build an error response.
 * @param {Object} baseResult - Base result object
 * @param {string} error - Error message
 * @param {string} message - User-friendly error message
 * @returns {Object} - Formatted error response object
 */
export function buildErrorResponse(baseResult, error, message) {
  return {
    ...baseResult,
    success: false,
    error,
    message
  };
}

/**
 * Build a query response for multiple items.
 * @param {Object} baseResult - Base result object
 * @param {Array} items - Array of items (tasks, projects, notifications)
 * @param {string} itemType - Type of items (for message formatting)
 * @param {number} limit - Result limit applied (if any)
 * @param {boolean} filteringApplied - Whether filters were applied
 * @returns {Object} - Formatted query response object
 */
export function buildQueryResponse(baseResult, items, itemType, limit = null, filteringApplied = false) {
  const itemPlural = itemType === 'notification' ? 'notifications' : `${itemType}s`;
  const itemIdsKey = itemType === 'notification' ? 'notificationIds' : `${itemType}Ids`;

  return {
    ...baseResult,
    success: true,
    [itemPlural]: items,
    [itemIdsKey]: items.map(item => item.id),
    message: items.length > 0
      ? `Found ${items.length} ${itemPlural}${filteringApplied ? ' matching your criteria' : ''}.${limit && items.length === limit ? ' (Result limit reached)' : ''}`
      : `No ${itemPlural} found matching your criteria.`
  };
}
