/**
 * Task Model
 *
 * Responsibility:
 * - Represent a task entity with properties for scheduling, dependencies, and metadata
 * - Validate task data before database operations
 * - Transform between application (camelCase) and database (snake_case) formats
 *
 * Validation Rules:
 * - name: Non-empty string required
 * - projectId: Non-empty string required
 * - status: Must be one of STATUS.PLANNING, STATUS.DOING, STATUS.DONE
 * - priority: Must be one of PRIORITY.LOW, PRIORITY.MEDIUM, PRIORITY.HIGH
 * - dueDate: If present, must be valid YYYY-MM-DD format and >= createdAt (local calendar)
 * - plannedTime: If present, must be valid ISO 8601 timestamp and >= createdAt (UTC)
 * - duration: If present, must be > 0 (minutes)
 * - labels: If present, must be array of strings
 * - dependencies: If present, must be array of task IDs (strings)
 */

import { v4 as uuidv4 } from 'uuid';
import { coerceDateOnly } from '../utils/dateTime.js';
import logger from '../logger.js';

// Task status constants
export const STATUS = {
  PLANNING: 'planning',
  DOING: 'doing',
  DONE: 'done',
};

// Task priority constants
export const PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

class Task {
  /**
   * Create a new Task instance
   * @param {Object} data - Task data
   */
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.name = data.name || '';
    this.description = data.description || '';
    this.duration = data.duration !== undefined ? data.duration : null;
    this.projectId = data.project_id || data.projectId || '';
    this.dependencies = data.dependencies ? this.parseDependencies(data.dependencies) : [];
    this.status = data.status || STATUS.PLANNING;
    this.labels = data.labels ? this.parseLabels(data.labels) : [];
    this.priority = data.priority || PRIORITY.MEDIUM;
    this.createdAt = data.created_at ? new Date(data.created_at) : new Date();
    this.updatedAt = data.updated_at ? new Date(data.updated_at) : new Date();

    this._setDueDate(data.dueDate || data.due_date);
    this._setPlannedTime(data.plannedTime || data.planned_time);
  }

  /**
   * Parses and sets the dueDate property.
   * @param {string|Date|null|undefined} dateValue - The value to parse for dueDate.
   * @private
   */
  _setDueDate(dateValue) {
    this.dueDate = coerceDateOnly(dateValue);
  }

  /**
   * Parses and sets the plannedTime property.
   * @param {string|Date|null|undefined} timeValue - The value to parse for plannedTime.
   * @private
   */
  _setPlannedTime(timeValue) {
    if (timeValue) {
      this.plannedTime = typeof timeValue === 'string' ? new Date(timeValue) : timeValue;
    } else {
      this.plannedTime = null;
    }
  }

  /**
   * Parse dependencies from JSON string or array
   * @param {string|Array} dependencies - Dependencies data
   * @returns {Array} - Dependencies array
   */
  parseDependencies(dependencies) {
    if (Array.isArray(dependencies)) {
      return dependencies;
    }
    try {
      return JSON.parse(dependencies);
    } catch {
      return [];
    }
  }

  /**
   * Parse labels from JSON string or array
   * @param {string|Array} labels - Labels data
   * @returns {Array} - Labels array
   */
  parseLabels(labels) {
    if (Array.isArray(labels)) {
      return labels;
    }
    try {
      return JSON.parse(labels);
    } catch {
      return [];
    }
  }

  /**
   * Validate the task data
   * @returns {boolean} - Validation result
   */
  validate() {
    // Existing validation: name
    if (!this.name || this.name.trim() === '') {
      logger.error('Task validation failed: name is required');
      return false;
    }

    // Existing validation: projectId
    if (!this.projectId) {
      logger.error('Task validation failed: projectId is required');
      return false;
    }

    // Existing validation: status
    if (!Object.values(STATUS).includes(this.status)) {
      logger.error(`Task validation failed: invalid status "${this.status}"`);
      return false;
    }

    // Existing validation: priority
    if (!Object.values(PRIORITY).includes(this.priority)) {
      logger.error(`Task validation failed: invalid priority "${this.priority}"`);
      return false;
    }

    // NEW: dueDate format validation (YYYY-MM-DD or null)
    if (this.dueDate !== null) {
      if (typeof this.dueDate !== 'string') {
        logger.error(`Task validation failed: dueDate must be YYYY-MM-DD string or null, got ${typeof this.dueDate}`);
        return false;
      }
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!datePattern.test(this.dueDate)) {
        logger.error(`Task validation failed: dueDate must be YYYY-MM-DD format, got "${this.dueDate}"`);
        return false;
      }
    }

    // NEW: plannedTime format validation (ISO 8601 Date object or null)
    if (this.plannedTime !== null) {
      if (!(this.plannedTime instanceof Date)) {
        logger.error(`Task validation failed: plannedTime must be Date object or null, got ${typeof this.plannedTime}`);
        return false;
      }
      if (isNaN(this.plannedTime.getTime())) {
        logger.error(`Task validation failed: plannedTime is invalid Date object`);
        return false;
      }
    }

    // NEW: duration validation (must be > 0 if present)
    if (this.duration !== null && this.duration !== undefined) {
      if (typeof this.duration !== 'number') {
        logger.error(`Task validation failed: duration must be number or null, got ${typeof this.duration}`);
        return false;
      }
      if (this.duration <= 0) {
        logger.error(`Task validation failed: duration must be > 0, got ${this.duration}`);
        return false;
      }
    }

    // NEW: labels validation (array of strings or empty array)
    if (this.labels !== null && this.labels !== undefined) {
      if (!Array.isArray(this.labels)) {
        logger.error(`Task validation failed: labels must be array, got ${typeof this.labels}`);
        return false;
      }
      for (const label of this.labels) {
        if (typeof label !== 'string') {
          logger.error(`Task validation failed: labels must contain only strings, found ${typeof label}`);
          return false;
        }
      }
    }

    // NEW: dependencies validation (array of task IDs or empty array)
    if (this.dependencies !== null && this.dependencies !== undefined) {
      if (!Array.isArray(this.dependencies)) {
        logger.error(`Task validation failed: dependencies must be array, got ${typeof this.dependencies}`);
        return false;
      }
      for (const depId of this.dependencies) {
        if (typeof depId !== 'string') {
          logger.error(`Task validation failed: dependencies must contain only strings (task IDs), found ${typeof depId}`);
          return false;
        }
      }
    }

    // NEW: dueDate range validation (must be >= createdAt as local calendar dates)
    if (this.dueDate !== null) {
      const createdAtDateOnly = coerceDateOnly(this.createdAt);
      if (createdAtDateOnly && this.dueDate < createdAtDateOnly) {
        logger.error(`Task validation failed: dueDate "${this.dueDate}" must be >= createdAt "${createdAtDateOnly}"`);
        return false;
      }
    }

    // NEW: plannedTime range validation (must be >= createdAt as timestamps)
    if (this.plannedTime !== null) {
      if (this.plannedTime < this.createdAt) {
        logger.error(`Task validation failed: plannedTime "${this.plannedTime.toISOString()}" must be >= createdAt "${this.createdAt.toISOString()}"`);
        return false;
      }
    }

    return true;
  }

  /**
   * Convert the task instance to a database-ready object
   * @returns {Object} - Database object
   */
  toDatabase() {
    const dueDateStr = coerceDateOnly(this.dueDate);

    return {
      id: this.id,
      name: this.name,
      description: this.description,
      duration: this.duration,
      due_date: dueDateStr, // Use the converted string
      planned_time: this.plannedTime ? this.plannedTime.toISOString() : null,
      project_id: this.projectId,
      dependencies: JSON.stringify(this.dependencies),
      status: this.status,
      labels: JSON.stringify(this.labels),
      priority: this.priority,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
    };
  }

  /**
   * Create a Task instance from a database object
   * @param {Object} data - Database object
   * @returns {Task} - Task instance
   */
  static fromDatabase(data) {
    // logger.info('Creating Task from database data:', data);
    const task = new Task(data);
    // logger.info('Task created with projectId:', task.projectId);
    return task;
  }

  /**
   * Update task properties
   * @param {Object} data - Updated data
   */
  update(data) {
    if (data.name !== undefined) this.name = data.name;
    if (data.description !== undefined) this.description = data.description;
    if (data.duration !== undefined) this.duration = data.duration;

    // Handle dueDate updates consistently
    this._setDueDateForUpdate(data.dueDate);

    if (data.plannedTime !== undefined) this.plannedTime = data.plannedTime;
    if (data.projectId !== undefined) this.projectId = data.projectId;
    if (data.dependencies !== undefined) this.dependencies = data.dependencies;
    if (data.status !== undefined) this.status = data.status;
    if (data.labels !== undefined) this.labels = data.labels;
    if (data.priority !== undefined) this.priority = data.priority;
    this.updatedAt = new Date();
  }

  /**
   * Parses and sets the dueDate property for update.
   * @param {string|Date|null|undefined} dateValue - The value to parse for dueDate.
   * @private
   */
  _setDueDateForUpdate(dateValue) {
    if (dateValue === null) {
      this.dueDate = null;
    } else if (dateValue !== undefined) {
      this.dueDate = coerceDateOnly(dateValue);
    }
  }
}

export { Task };
