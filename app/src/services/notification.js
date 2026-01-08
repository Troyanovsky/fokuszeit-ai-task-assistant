/**
 * Notification Service
 * Handles notification-related operations
 */

import databaseService from './database.js';
import { Notification, TYPE } from '../models/Notification.js';
import { STATUS } from '../models/Task.js';
import { Notification as ElectronNotification, BrowserWindow } from 'electron';
import logger from '../../electron-main/logger.js';

class NotificationManager {
  constructor() {
    this.scheduledNotifications = new Map();
  }

  /**
   * Initialize the notification service
   */
  init() {
    // Load scheduled notifications from database
    this.loadScheduledNotifications();
  }

  /**
   * Load scheduled notifications from database
   */
  async loadScheduledNotifications() {
    try {
      const notifications = await this.getUpcomingNotifications();

      // Schedule all notifications
      notifications.forEach((notification) => {
        this.scheduleNotification(notification);
      });

      logger.info(`Loaded ${notifications.length} scheduled notifications`);
    } catch (error) {
      logger.logError(error, 'Error loading scheduled notifications');
    }
  }

  /**
   * Get all notifications
   * @returns {Array} - Array of Notification instances
   */
  async getNotifications() {
    try {
      const notifications = databaseService.query('SELECT * FROM notifications ORDER BY time ASC');
      return notifications.map((notification) => Notification.fromDatabase(notification));
    } catch (error) {
      logger.logError(error, 'Error getting notifications');
      return [];
    }
  }

  /**
   * Get notifications for a task
   * @param {string} taskId - Task ID
   * @returns {Array} - Array of Notification instances
   */
  async getNotificationsByTask(taskId) {
    try {
      logger.info(`Fetching notifications for task ${taskId}`);
      const notifications = databaseService.query(
        'SELECT * FROM notifications WHERE task_id = ? ORDER BY time ASC',
        [taskId]
      );
      logger.info(`Found ${notifications.length} notifications for task ${taskId}`);
      return notifications.map((notification) => Notification.fromDatabase(notification));
    } catch (error) {
      logger.logError(error, `Error getting notifications for task ${taskId}`);
      return [];
    }
  }

  /**
   * Get a single notification by ID
   * @param {string} id - Notification ID
   * @returns {Notification|null} - Notification instance or null if not found
   */
  async getNotificationById(id) {
    try {
      logger.info(`Fetching notification ${id}`);
      const notification = databaseService.queryOne('SELECT * FROM notifications WHERE id = ?', [
        id,
      ]);
      return notification ? Notification.fromDatabase(notification) : null;
    } catch (error) {
      logger.logError(error, `Error getting notification ${id}`);
      return null;
    }
  }

  /**
   * Get upcoming notifications (scheduled for the future)
   * @returns {Array} - Array of Notification instances
   */
  async getUpcomingNotifications() {
    try {
      const now = new Date();

      // Only load unsent notifications to prevent duplicates after restart
      const notifications = databaseService.query(
        'SELECT * FROM notifications WHERE time > ? AND sent_at IS NULL ORDER BY time ASC',
        [now.toISOString()]
      );
      return notifications.map((notification) => Notification.fromDatabase(notification));
    } catch (error) {
      logger.logError(error, 'Error getting upcoming notifications');
      return [];
    }
  }

  /**
   * Add a new notification
   * @param {Notification} notification - Notification instance
   * @returns {boolean} - Success status
   */
  async addNotification(notification) {
    try {
      // Create a Notification instance if the input is just data
      const notificationInstance =
        notification instanceof Notification ? notification : new Notification(notification);

      if (!notificationInstance.validate()) {
        logger.error('Invalid notification data');
        return false;
      }

      const data = notificationInstance.toDatabase();

      logger.info('Adding notification:', {
        id: data.id,
        taskId: data.task_id,
        time: data.time,
        type: data.type,
        message: data.message,
      });

      const result = databaseService.insert(
        'INSERT INTO notifications (id, task_id, time, type, message, created_at, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [data.id, data.task_id, data.time, data.type, data.message, data.created_at, data.sent_at]
      );

      if (result && result.changes > 0) {
        // Schedule the notification
        this.scheduleNotification(notificationInstance);
        logger.info(
          `✅ Notification created successfully: ${data.id} for task ${data.task_id} at ${new Date(data.time).toLocaleString()}`
        );
        return true;
      }

      return false;
    } catch (error) {
      logger.logError(error, 'Error adding notification');
      return false;
    }
  }

  /**
   * Update an existing notification
   * @param {Object} notificationData - Notification data
   * @returns {boolean} - Success status
   * @note The sent_at field is NOT updated to preserve notification delivery status.
   *       Updating a notification's content should not reset whether it was sent.
   */
  async updateNotification(notificationData) {
    try {
      logger.info('Updating notification:', notificationData);

      // Cancel the existing scheduled notification
      this.cancelNotification(notificationData.id);

      // Create a Notification instance
      const notification = new Notification(notificationData);

      if (!notification.validate()) {
        logger.error('Invalid notification data for update');
        return false;
      }

      const data = notification.toDatabase();
      logger.debug('Notification data for update:', {
        id: data.id,
        taskId: data.task_id,
        time: data.time,
        type: data.type,
        message: data.message,
      });

      // Note: sent_at is intentionally excluded to preserve delivery status
      const result = databaseService.update(
        'UPDATE notifications SET task_id = ?, time = ?, type = ?, message = ? WHERE id = ?',
        [data.task_id, data.time, data.type, data.message, data.id]
      );

      if (result && result.changes > 0) {
        // Re-schedule the notification
        this.scheduleNotification(notification);
        logger.info(
          `✅ Notification updated successfully: ${data.id} for task ${data.task_id} at ${new Date(data.time).toLocaleString()}`
        );
        return true;
      }

      return false;
    } catch (error) {
      logger.logError(error, `Error updating notification ${notificationData.id}`);
      return false;
    }
  }

  /**
   * Delete a notification
   * @param {string} id - Notification ID
   * @returns {boolean} - Success status
   */
  async deleteNotification(id) {
    try {
      // Cancel the scheduled notification
      this.cancelNotification(id);

      const result = databaseService.delete('DELETE FROM notifications WHERE id = ?', [id]);
      if (result && result.changes > 0) {
        logger.info(`✅ Notification deleted successfully: ${id}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.logError(error, `Error deleting notification ${id}`);
      return false;
    }
  }

  /**
   * Schedule a notification
   * @param {Notification} notification - Notification instance
   */
  scheduleNotification(notification) {
    try {
      // Cancel existing notification with the same ID
      this.cancelNotification(notification.id);

      const now = new Date();
      const notificationTime = notification.time;

      logger.debug(
        `Scheduling notification ${notification.id} for ${notificationTime.toLocaleString()}`
      );
      logger.debug(`Current time: ${now.toLocaleString()}`);

      // If the notification time is in the past, don't schedule it
      if (notificationTime <= now) {
        logger.warn(`⚠️ Notification ${notification.id} time is in the past, not scheduling`);
        return;
      }

      // Calculate delay in milliseconds
      const delay = notificationTime.getTime() - now.getTime();
      logger.debug(`Notification will trigger in ${Math.round(delay / 1000)} seconds`);

      // Schedule the notification
      const timeoutId = setTimeout(async () => {
        try {
          await this.sendNotification(notification);
        } catch (error) {
          logger.logError(error, `Error in scheduled notification ${notification.id}`);
        }
        this.scheduledNotifications.delete(notification.id);
      }, delay);

      // Store the timeout ID for later cancellation
      this.scheduledNotifications.set(notification.id, timeoutId);

      logger.info(
        `✅ Scheduled notification ${notification.id} for ${notificationTime.toLocaleString()}`
      );
    } catch (error) {
      logger.logError(error, `Error scheduling notification ${notification.id}`);
    }
  }

  /**
   * Cancel a scheduled notification
   * @param {string} id - Notification ID
   */
  cancelNotification(id) {
    try {
      const timeoutId = this.scheduledNotifications.get(id);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.scheduledNotifications.delete(id);
        logger.info(`Cancelled notification ${id}`);
      }
    } catch (error) {
      logger.logError(error, `Error cancelling notification ${id}`);
    }
  }

  /**
   * Send a notification
   * @param {Notification} notification - Notification instance
   */
  async sendNotification(notification) {
    try {
      // Check if already sent to prevent duplicates
      if (notification.sentAt) {
        logger.info(`Notification ${notification.id} already sent at ${notification.sentAt.toISOString()}, skipping`);
        return;
      }

      // Get the task details to include in the notification
      const task = databaseService.queryOne('SELECT name, status FROM tasks WHERE id = ?', [
        notification.taskId,
      ]);

      if (!task) {
        logger.error(`Task ${notification.taskId} not found for notification`);
        return;
      }

      // Check if task is marked as DONE - if so, don't send the notification
      if (task.status === STATUS.DONE) {
        logger.info(`Task ${notification.taskId} (${task.name}) is marked as DONE, skipping notification`);
        return;
      }

      logger.info(`Sending notification for task: ${task.name}`);

      // Create a system notification
      if (ElectronNotification.isSupported()) {
        const systemNotification = new ElectronNotification({
          title: `Task: ${task.name}`,
          body: notification.message || this.getDefaultMessage(notification.type, task.name),
          silent: false,
          timeoutType: 'default',
        });

        // Show the notification
        systemNotification.show();
        logger.info(`✅ System notification displayed for task: ${task.name}`);

        // Handle notification click
        systemNotification.on('click', () => {
          // Get all windows and send to the main window
          const mainWindow = BrowserWindow.getAllWindows()[0];
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('notification:focus-task', {
              taskId: notification.taskId,
            });
          }
        });
      } else {
        logger.warn('⚠️ System notifications are not supported on this platform');
      }

      // Send notification to renderer process using webContents
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('notification:received', notification);
        logger.info('Notification event sent to renderer process');
      } else {
        logger.warn('⚠️ No active window found to send notification');
      }

      logger.info(`✅ Notification ${notification.id} sent: ${notification.message}`);

      // Mark as sent in memory immediately to prevent duplicate sends, then persist to database
      const now = new Date();
      notification.sentAt = now;

      try {
        await this.markAsSent(notification.id, notification);
      } catch (error) {
        // Notification was already sent to user, but database update failed
        // The in-memory update above prevents duplicate sends in current session
        logger.logError(error, `Failed to mark notification ${notification.id} as sent in database (will retry on next load)`);
      }
    } catch (error) {
      logger.logError(error, `Error sending notification ${notification.id}`);
    }
  }

  /**
   * Mark a notification as sent
   * @param {string} id - Notification ID
   * @param {Notification} notificationObj - Optional in-memory notification object to update
   * @returns {Promise<{success: boolean, sentAt: Date|null}>} - Result with timestamp
   */
  async markAsSent(id, notificationObj = null) {
    try {
      const now = new Date().toISOString();
      const result = databaseService.update('UPDATE notifications SET sent_at = ? WHERE id = ?', [now, id]);

      if (result && result.changes > 0) {
        // Update in-memory object if provided
        if (notificationObj) {
          notificationObj.sentAt = new Date(now);
        }
        logger.info(`✅ Notification ${id} marked as sent at ${now}`);
        return { success: true, sentAt: new Date(now) };
      }
      return { success: false, sentAt: null };
    } catch (error) {
      logger.logError(error, `Error marking notification ${id} as sent`);
      return { success: false, sentAt: null };
    }
  }

  /**
   * Reschedule all pending notifications after clock change or system wake
   * @returns {Object} - Rescheduling statistics
   */
  async rescheduleAllPending() {
    try {
      logger.info('Rescheduling all pending notifications after system event');

      // Clear all existing timeouts
      for (const [, timeoutId] of this.scheduledNotifications) {
        clearTimeout(timeoutId);
      }
      this.scheduledNotifications.clear();

      // Reload and reschedule all unsent notifications
      const notifications = await this.getUpcomingNotifications();
      notifications.forEach((notification) => {
        this.scheduleNotification(notification);
      });

      logger.info(`✅ Rescheduled ${notifications.length} pending notifications`);
      return { success: true, count: notifications.length };
    } catch (error) {
      logger.logError(error, 'Error rescheduling notifications');
      return { success: false, count: 0 };
    }
  }

  /**
   * Clean up old sent notifications (optional maintenance task)
   * @param {number} daysToKeep - Number of days to keep sent notifications (default: 30)
   * @returns {boolean} - Success status
   * @example
   * // Clean notifications older than 30 days
   * await notificationService.cleanupOldSentNotifications();
   * @example
   * // Clean notifications older than 90 days
   * await notificationService.cleanupOldSentNotifications(90);
   */
  async cleanupOldSentNotifications(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = databaseService.delete(
        'DELETE FROM notifications WHERE sent_at IS NOT NULL AND sent_at < ?',
        [cutoffDate.toISOString()]
      );

      if (result && result.changes > 0) {
        logger.info(`✅ Cleaned up ${result.changes} old sent notifications`);
        return true;
      }
      return true; // No old notifications to clean up
    } catch (error) {
      logger.logError(error, 'Error cleaning up old notifications');
      return false;
    }
  }

  /**
   * Get a default message based on notification type
   * @param {string} type - Notification type
   * @param {string} taskName - Task name
   * @returns {string} - Default message
   */
  getDefaultMessage(type, taskName) {
    switch (type) {
      case TYPE.REMINDER:
        return `Reminder for task: ${taskName}`;
      case TYPE.DUE_DATE:
        return `Task due soon: ${taskName}`;
      case TYPE.STATUS_CHANGE:
        return `Status changed for task: ${taskName}`;
      case TYPE.PLANNED_TIME:
        return `It's time to work on: ${taskName}`;
      default:
        return `Notification for task: ${taskName}`;
    }
  }
}

// Create singleton instance
const notificationService = new NotificationManager();

export default notificationService;
