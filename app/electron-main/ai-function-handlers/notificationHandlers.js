/**
 * Notification handlers for AI function calls.
 * Handles all notification-related operations (CRUD).
 */

import { Notification, TYPE } from '../../shared/models/Notification.js';
import notificationService from '../services/notification.js';
import { buildNotificationResponse, buildQueryResponse } from './utils/responseFormatters.js';

/**
 * Handle addNotification function call.
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
export async function handleAddNotification(args, baseResult) {
  // Import parseToISODateTime dynamically to avoid circular dependency
  const { parseToISODateTime } = await import('./utils/dateTimeParsers.js');

  // Convert local time string to ISO format if provided
  if (args.time && typeof args.time === 'string') {
    const isoDateTime = parseToISODateTime(args.time, 'notification time');
    if (isoDateTime) {
      args.time = isoDateTime;
    } else {
      return {
        ...baseResult,
        success: false,
        error: `Invalid date format for notification time: ${args.time}`,
        message: `I couldn't create the notification because the time format is invalid.`
      };
    }
  }

  // Import validateNotificationType dynamically
  const { validateNotificationType } = await import('./utils/argumentParsers.js');

  // Validate notification type
  if (!validateNotificationType(args.type)) {
    return {
      ...baseResult,
      success: false,
      error: `Invalid notification type: ${args.type}`,
      message: `I couldn't create the notification because "${args.type}" is not a valid notification type. Valid types are: ${Object.values(TYPE).join(', ')}`
    };
  }

  // Create notification
  const notification = new Notification({
    taskId: args.taskId,
    time: args.time,
    type: args.type,
    message: args.message || ''
  });

  const addResult = await notificationService.addNotification(notification);
  return {
    ...baseResult,
    success: addResult,
    notification,
    notificationId: notification.id,
    message: addResult
      ? `Notification has been created for task ${args.taskId}.`
      : `Failed to create notification for task ${args.taskId}.`
  };
}

/**
 * Handle updateNotification function call.
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
export async function handleUpdateNotification(args, baseResult) {
  // Import parseToISODateTime dynamically to avoid circular dependency
  const { parseToISODateTime } = await import('./utils/dateTimeParsers.js');

  // Convert local time string to ISO format if provided
  if (args.time && typeof args.time === 'string') {
    const isoDateTime = parseToISODateTime(args.time, 'notification time');
    if (isoDateTime) {
      args.time = isoDateTime;
    } else {
      return {
        ...baseResult,
        success: false,
        error: `Invalid date format for notification: ${args.time}`,
        message: `I couldn't update the notification because the time format is invalid.`
      };
    }
  }

  // Import validateNotificationType dynamically
  const { validateNotificationType } = await import('./utils/argumentParsers.js');

  // Validate notification type if provided
  if (args.type && !validateNotificationType(args.type)) {
    return {
      ...baseResult,
      success: false,
      error: `Invalid notification type: ${args.type}`,
      message: `I couldn't update the notification because "${args.type}" is not a valid notification type. Valid types are: ${Object.values(TYPE).join(', ')}`
    };
  }

  const updateNotificationResult = await notificationService.updateNotification(args);
  return {
    ...baseResult,
    success: updateNotificationResult,
    notificationId: args.id,
    message: updateNotificationResult
      ? `Notification with ID ${args.id} has been updated.`
      : `Failed to update notification with ID ${args.id}.`
  };
}

/**
 * Handle deleteNotification function call.
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
export async function handleDeleteNotification(args, baseResult) {
  const deleteNotificationResult = await notificationService.deleteNotification(args.id);
  return {
    ...baseResult,
    success: deleteNotificationResult,
    notificationId: args.id,
    message: deleteNotificationResult
      ? `Notification with ID ${args.id} has been deleted.`
      : `Failed to delete notification with ID ${args.id}.`
  };
}

/**
 * Handle getNotifications function call.
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
export async function handleGetNotifications(args, baseResult) {
  const notifications = await notificationService.getNotifications(args);
  const formattedNotifications = notifications.map(notification => ({
    id: notification.id,
    title: notification.title,
    message: notification.message,
    time: notification.time,
    type: notification.type,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt
  }));

  const notifFilteringApplied = Object.keys(args).some(key =>
    ['ids', 'titleContains', 'messageContains', 'type', 'isRead', 'timeBefore', 'timeAfter'].includes(key)
  );

  const notificationLimit = args.limit || 50;

  return {
    ...baseResult,
    success: true,
    notifications: formattedNotifications,
    notificationIds: formattedNotifications.map(notification => notification.id),
    message: formattedNotifications.length > 0
      ? `Found ${formattedNotifications.length} notifications${notifFilteringApplied ? ' matching your criteria' : ''}.${formattedNotifications.length === notificationLimit ? ' (Result limit reached)' : ''}`
      : 'No notifications found matching your criteria.'
  };
}

/**
 * Handle getNotificationsByTask function call.
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
export async function handleGetNotificationsByTask(args, baseResult) {
  const notifications = await notificationService.getNotificationsByTask(args.taskId);
  return buildQueryResponse(baseResult, notifications, 'notification', null, false);
}
