/**
 * Complex notification query handler for AI function calls.
 * Handles notification filtering with multiple criteria.
 */

import notificationService from '../../services/notification.js';
import logger from '../../logger.js';
import { isDebugLoggingEnabled, shouldLogRaw } from '../../../shared/utils/loggingConfig.js';
import { summarizeNotifications } from '../../../shared/utils/loggingSanitizers.js';
import { formatNotificationForAI } from '../utils/dateTimeParsers.js';

/**
 * Notification query handler class with modular filter methods.
 */
class NotificationQueryHandler {
  constructor() {
    this.filters = {
      byIds: this.filterByIds.bind(this),
      byTaskIds: this.filterByTaskIds.bind(this),
      byTimeRange: this.filterByTimeRange.bind(this)
    };
  }

  /**
   * Filter notifications by specific IDs.
   * @param {Array} notifications - Notifications to filter
   * @param {Array} ids - IDs to include
   * @returns {Array} - Filtered notifications
   */
  filterByIds(notifications, ids) {
    return notifications.filter(notification => ids.includes(notification.id));
  }

  /**
   * Filter notifications by task IDs.
   * @param {Array} notifications - Notifications to filter
   * @param {Array} taskIds - Task IDs to include
   * @returns {Array} - Filtered notifications
   */
  filterByTaskIds(notifications, taskIds) {
    return notifications.filter(notification =>
      taskIds.includes(notification.taskId)
    );
  }

  /**
   * Filter notifications by time range.
   * @param {Array} notifications - Notifications to filter
   * @param {string} timeStart - Start time (inclusive)
   * @param {string} timeEnd - End time (inclusive)
   * @returns {Array} - Filtered notifications
   */
  filterByTimeRange(notifications, timeStart, timeEnd) {
    let filtered = notifications;

    if (timeStart) {
      try {
        const startTime = new Date(timeStart);
        if (!isNaN(startTime)) {
          // For date-only inputs, set to beginning of day
          if (!timeStart.includes('T') && !timeStart.includes(':')) {
            startTime.setHours(0, 0, 0, 0);
          }
          filtered = filtered.filter(notification => {
            if (!notification.time) return false;
            const notificationTime = new Date(notification.time);
            return notificationTime >= startTime;
          });
        }
      } catch (error) {
        logger.logError(error, 'Error parsing timeStart');
      }
    }

    if (timeEnd) {
      try {
        const endTime = new Date(timeEnd);
        if (!isNaN(endTime)) {
          // For date-only inputs, set to end of day
          if (!timeEnd.includes('T') && !timeEnd.includes(':')) {
            endTime.setHours(23, 59, 59, 999);
          }
          filtered = filtered.filter(notification => {
            if (!notification.time) return false;
            const notificationTime = new Date(notification.time);
            return notificationTime <= endTime;
          });
        }
      } catch (error) {
        logger.logError(error, 'Error parsing timeEnd');
      }
    }

    return filtered;
  }

  /**
   * Apply limit to notification results.
   * @param {Array} notifications - Notifications to limit
   * @param {number} limit - Maximum number of notifications
   * @returns {Array} - Limited notifications
   */
  applyLimit(notifications, limit) {
    const maxLimit = limit || 20;
    if (notifications.length > maxLimit) {
      return notifications.slice(0, maxLimit);
    }
    return notifications;
  }

  /**
   * Format notifications for AI readability.
   * @param {Array} notifications - Notifications to format
   * @returns {Array} - Formatted notifications
   */
  formatNotifications(notifications) {
    return notifications.map(notification => formatNotificationForAI(notification));
  }

  /**
   * Main query orchestration method.
   * @param {Object} args - Query arguments
   * @param {Object} baseResult - Base result object
   * @returns {Promise<Object>} - Query result
   */
  async query(args, baseResult) {
    const requestId = baseResult?.functionCallId;
    const debugEnabled = isDebugLoggingEnabled();
    const rawEnabled = shouldLogRaw(requestId);

    // Start with all notifications
    let allNotifications = await notificationService.getNotifications();
    const allNotificationsSummary = summarizeNotifications(allNotifications);
    logger.info('QueryNotifications - Retrieved notifications', {
      requestId,
      total: allNotificationsSummary.count
    });
    if (debugEnabled) {
      logger.debug('QueryNotifications summary', { requestId, summary: allNotificationsSummary });
      if (rawEnabled) {
        logger.debug('QueryNotifications raw notifications', { requestId, notifications: allNotifications });
      }
    }

    let filteredNotifications = [...allNotifications];
    let filteringApplied = false;

    // Apply filters sequentially
    if (args.ids && Array.isArray(args.ids) && args.ids.length > 0) {
      filteredNotifications = this.filters.byIds(filteredNotifications, args.ids);
      filteringApplied = true;
    }

    if (args.taskIds && Array.isArray(args.taskIds) && args.taskIds.length > 0) {
      filteredNotifications = this.filters.byTaskIds(filteredNotifications, args.taskIds);
      filteringApplied = true;
    }

    if (args.timeStart || args.timeEnd) {
      filteredNotifications = this.filters.byTimeRange(filteredNotifications, args.timeStart, args.timeEnd);
      filteringApplied = true;
    }

    // Apply limit
    const notificationLimit = args.limit || 20;
    filteredNotifications = this.applyLimit(filteredNotifications, notificationLimit);

    logger.info('QueryNotifications - Filtered notifications', {
      requestId,
      total: filteredNotifications.length,
      limit: notificationLimit
    });
    if (debugEnabled) {
      logger.debug('QueryNotifications filtered summary', {
        requestId,
        summary: summarizeNotifications(filteredNotifications)
      });
    }

    // Format notifications for AI readability
    const formattedNotifications = this.formatNotifications(filteredNotifications);

    return {
      ...baseResult,
      success: true,
      notifications: formattedNotifications,
      notificationIds: formattedNotifications.map(notification => notification.id),
      message: formattedNotifications.length > 0
        ? `Found ${formattedNotifications.length} notifications${filteringApplied ? ' matching your criteria' : ''}.${formattedNotifications.length === notificationLimit ? ' (Result limit reached)' : ''}`
        : 'No notifications found matching your criteria.'
    };
  }
}

// Export a singleton instance
const notificationQueryHandler = new NotificationQueryHandler();

/**
 * Handle queryNotifications function call.
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
export async function handleQueryNotifications(args, baseResult) {
  return notificationQueryHandler.query(args, baseResult);
}
