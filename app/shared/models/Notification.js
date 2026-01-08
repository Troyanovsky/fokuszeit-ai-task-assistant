/**
 * Notification Model
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

// Notification type constants
export const TYPE = {
  REMINDER: 'reminder',
  DUE_DATE: 'due_date',
  STATUS_CHANGE: 'status_change',
  PLANNED_TIME: 'PLANNED_TIME',
};

class Notification {
  /**
   * Create a new Notification instance
   * @param {Object} data - Notification data
   */
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    // Handle both taskId and task_id for flexibility
    this.taskId = data.taskId || data.task_id || '';
    this.time = data.time ? new Date(data.time) : new Date();
    this.type = data.type || TYPE.REMINDER;
    this.message = data.message || '';
    this.createdAt = data.created_at ? new Date(data.created_at) : new Date();
    this.sentAt = data.sentAt || data.sent_at ? new Date(data.sentAt || data.sent_at) : null;
  }

  /**
   * Validate the notification data
   * @returns {boolean} - Validation result
   */
  validate() {
    if (!this.taskId) {
      logger.error('Notification validation failed: missing taskId');
      return false;
    }
    if (!this.time) {
      logger.error('Notification validation failed: missing time');
      return false;
    }
    if (!Object.values(TYPE).includes(this.type)) {
      logger.error(`Notification validation failed: invalid type ${this.type}`);
      return false;
    }
    return true;
  }

  /**
   * Convert the notification instance to a database-ready object
   * @returns {Object} - Database object
   */
  toDatabase() {
    return {
      id: this.id,
      task_id: this.taskId,
      time: this.time.toISOString(),
      type: this.type,
      message: this.message,
      created_at: this.createdAt.toISOString(),
      sent_at: this.sentAt ? this.sentAt.toISOString() : null,
    };
  }

  /**
   * Create a Notification instance from a database object
   * @param {Object} data - Database object
   * @returns {Notification} - Notification instance
   */
  static fromDatabase(data) {
    return new Notification(data);
  }

  /**
   * Update notification properties
   * @param {Object} data - Updated data
   */
  update(data) {
    if (data.taskId !== undefined) this.taskId = data.taskId;
    if (data.task_id !== undefined) this.taskId = data.task_id;
    if (data.time !== undefined) this.time = data.time;
    if (data.type !== undefined) this.type = data.type;
    if (data.message !== undefined) this.message = data.message;
    if (data.sent_at !== undefined) this.sentAt = data.sent_at ? new Date(data.sent_at) : null;
    if (data.sentAt !== undefined) this.sentAt = data.sentAt;
  }
}

export { Notification };
