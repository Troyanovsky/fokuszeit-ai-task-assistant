/**
 * RecurrenceRule Model
 */

import { v4 as uuidv4 } from 'uuid';

// Frequency constants
export const FREQUENCY = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
};

class RecurrenceRule {
  /**
   * Create a new RecurrenceRule instance
   * @param {Object} data - RecurrenceRule data
   */
  constructor(data = {}) {
    this._initProperties(data);
  }

  /**
   * Initialize all properties from data
   * @param {Object} data - RecurrenceRule data
   * @private
   */
  _initProperties(data) {
    this.id = data.id || uuidv4();
    this.taskId = this._resolveTaskId(data);
    this.frequency = data.frequency || FREQUENCY.DAILY;
    this.interval = this._resolveInterval(data);
    this.endDate = this._resolveEndDate(data);
    this.count = this._resolveCount(data);
    this.createdAt = this._resolveCreatedAt(data);
  }

  /**
   * Resolve task ID from data (handles camelCase and snake_case)
   * @param {Object} data - RecurrenceRule data
   * @returns {string} - Task ID or empty string
   * @private
   */
  _resolveTaskId(data) {
    return data.taskId || data.task_id || '';
  }

  /**
   * Resolve interval from data
   * @param {Object} data - RecurrenceRule data
   * @returns {number} - Interval or 1
   * @private
   */
  _resolveInterval(data) {
    return data.interval !== undefined ? data.interval : 1;
  }

  /**
   * Resolve end date from data
   * @param {Object} data - RecurrenceRule data
   * @returns {Date|null} - Parsed end date or null
   * @private
   */
  _resolveEndDate(data) {
    return this._parseDate(data.endDate) || this._parseDate(data.end_date) || null;
  }

  /**
   * Resolve count from data
   * @param {Object} data - RecurrenceRule data
   * @returns {number|null} - Count or null
   * @private
   */
  _resolveCount(data) {
    return data.count !== undefined ? data.count : null;
  }

  /**
   * Resolve createdAt from data
   * @param {Object} data - RecurrenceRule data
   * @returns {Date} - Created at date
   * @private
   */
  _resolveCreatedAt(data) {
    return data.createdAt || (data.created_at ? new Date(data.created_at) : new Date());
  }

  /**
   * Validate the recurrence rule data
   * @returns {boolean} - Validation result
   */
  validate() {
    if (!this.taskId) {
      return false;
    }
    if (!Object.values(FREQUENCY).includes(this.frequency)) {
      return false;
    }
    if (this.interval <= 0) {
      return false;
    }
    // Count should be null or a positive number (total occurrences, including the current task)
    if (this.count !== null && this.count < 1) {
      return false;
    }
    return true;
  }

  /**
   * Convert the recurrence rule instance to a database-ready object
   * @returns {Object} - Database object
   */
  toDatabase() {
    return {
      id: this.id,
      task_id: this.taskId,
      frequency: this.frequency,
      interval: this.interval,
      end_date: this.endDate ? this._formatDateOnly(this.endDate) : null,
      count: this.count,
      created_at: this.createdAt.toISOString(),
    };
  }

  /**
   * Create a RecurrenceRule instance from a database object
   * @param {Object} data - Database object
   * @returns {RecurrenceRule} - RecurrenceRule instance
   */
  static fromDatabase(data) {
    return new RecurrenceRule(data);
  }

  /**
   * Update recurrence rule properties
   * @param {Object} data - Updated data
   */
  update(data) {
    if (data.taskId !== undefined) this.taskId = data.taskId;
    if (data.frequency !== undefined) this.frequency = data.frequency;
    if (data.interval !== undefined) this.interval = data.interval;
    if (data.endDate !== undefined) this.endDate = this._parseDate(data.endDate);
    if (data.count !== undefined) this.count = data.count;
  }

  /**
   * Calculate the next occurrence date
   * @param {Date} fromDate - Starting date
   * @returns {Date|null} - Next occurrence date or null if no more occurrences
   */
  getNextOccurrence(fromDate) {
    if (this.endDate && fromDate > this.endDate) {
      return null;
    }

    const nextDate = new Date(fromDate);

    switch (this.frequency) {
      case FREQUENCY.DAILY:
        nextDate.setDate(nextDate.getDate() + this.interval);
        break;
      case FREQUENCY.WEEKLY:
        nextDate.setDate(nextDate.getDate() + this.interval * 7);
        break;
      case FREQUENCY.MONTHLY:
        nextDate.setMonth(nextDate.getMonth() + this.interval);
        break;
      case FREQUENCY.YEARLY:
        nextDate.setFullYear(nextDate.getFullYear() + this.interval);
        break;
      default:
        return null;
    }

    if (this.endDate && nextDate > this.endDate) {
      return null;
    }

    return nextDate;
  }

  /**
   * Helper method to parse date values
   * @param {string|Date|null} dateValue - Date value to parse
   * @returns {Date|null} - Parsed Date object or null
   * @private
   */
  _parseDate(dateValue) {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;
    if (typeof dateValue === 'string') {
      const dateOnlyMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (dateOnlyMatch) {
        const year = Number(dateOnlyMatch[1]);
        const month = Number(dateOnlyMatch[2]);
        const day = Number(dateOnlyMatch[3]);
        return new Date(year, month - 1, day);
      }

      const parsed = new Date(dateValue);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  /**
   * Format a date as YYYY-MM-DD using local calendar values.
   * @param {Date} dateValue - Date value to format
   * @returns {string} - Formatted date string
   * @private
   */
  _formatDateOnly(dateValue) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

export { RecurrenceRule };
