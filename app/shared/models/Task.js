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
    this.duration = this._initDuration(data.duration);
    this.projectId = this._initProjectId(data.project_id || data.projectId);
    this.dependencies = this._initDependencies(data.dependencies);
    this.status = data.status || STATUS.PLANNING;
    this.labels = this._initLabels(data.labels);
    this.priority = data.priority || PRIORITY.MEDIUM;
    this.createdAt = this._initCreatedAt(data.created_at);
    this.updatedAt = this._initUpdatedAt(data.updated_at);
    this.dueDate = this._initDueDate(data.dueDate || data.due_date);
    this.plannedTime = this._initPlannedTime(data.plannedTime || data.planned_time);
  }

  /**
   * Initialize duration from data
   * @param {*} durationValue - Duration value from data
   * @returns {number|null} - Duration or null
   * @private
   */
  _initDuration(durationValue) {
    return durationValue !== undefined ? durationValue : null;
  }

  /**
   * Initialize project ID from data
   * @param {string} projectIdValue - Project ID from data
   * @returns {string} - Project ID or empty string
   * @private
   */
  _initProjectId(projectIdValue) {
    return projectIdValue || '';
  }

  /**
   * Initialize dependencies from data
   * @param {*} dependenciesValue - Dependencies from data
   * @returns {Array} - Dependencies array
   * @private
   */
  _initDependencies(dependenciesValue) {
    return dependenciesValue ? this.parseDependencies(dependenciesValue) : [];
  }

  /**
   * Initialize labels from data
   * @param {*} labelsValue - Labels from data
   * @returns {Array} - Labels array
   * @private
   */
  _initLabels(labelsValue) {
    return labelsValue ? this.parseLabels(labelsValue) : [];
  }

  /**
   * Initialize createdAt from data
   * @param {string} createdAtValue - Created at timestamp from data
   * @returns {Date} - Created at date
   * @private
   */
  _initCreatedAt(createdAtValue) {
    return createdAtValue ? new Date(createdAtValue) : new Date();
  }

  /**
   * Initialize updatedAt from data
   * @param {string} updatedAtValue - Updated at timestamp from data
   * @returns {Date} - Updated at date
   * @private
   */
  _initUpdatedAt(updatedAtValue) {
    return updatedAtValue ? new Date(updatedAtValue) : new Date();
  }

  /**
   * Initialize dueDate from data
   * @param {*} dateValue - Due date from data
   * @returns {string|null} - Due date in YYYY-MM-DD format or null
   * @private
   */
  _initDueDate(dateValue) {
    return coerceDateOnly(dateValue);
  }

  /**
   * Initialize plannedTime from data
   * @param {*} timeValue - Planned time from data
   * @returns {Date|null} - Planned time or null
   * @private
   */
  _initPlannedTime(timeValue) {
    if (timeValue) {
      return typeof timeValue === 'string' ? new Date(timeValue) : timeValue;
    }
    return null;
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
    return (
      this._validateName() &&
      this._validateProjectId() &&
      this._validateStatus() &&
      this._validatePriority() &&
      this._validateDueDate() &&
      this._validatePlannedTime() &&
      this._validateDuration() &&
      this._validateLabels() &&
      this._validateDependencies()
    );
  }

  /**
   * Validate task name
   * @returns {boolean} - Validation result
   * @private
   */
  _validateName() {
    if (!this.name || this.name.trim() === '') {
      logger.error('Task validation failed: name is required');
      return false;
    }
    return true;
  }

  /**
   * Validate project ID
   * @returns {boolean} - Validation result
   * @private
   */
  _validateProjectId() {
    if (!this.projectId) {
      logger.error('Task validation failed: projectId is required');
      return false;
    }
    return true;
  }

  /**
   * Validate task status
   * @returns {boolean} - Validation result
   * @private
   */
  _validateStatus() {
    if (!Object.values(STATUS).includes(this.status)) {
      logger.error(`Task validation failed: invalid status "${this.status}"`);
      return false;
    }
    return true;
  }

  /**
   * Validate task priority
   * @returns {boolean} - Validation result
   * @private
   */
  _validatePriority() {
    if (!Object.values(PRIORITY).includes(this.priority)) {
      logger.error(`Task validation failed: invalid priority "${this.priority}"`);
      return false;
    }
    return true;
  }

  /**
   * Validate due date format and range
   * @returns {boolean} - Validation result
   * @private
   */
  _validateDueDate() {
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
      const createdAtDateOnly = coerceDateOnly(this.createdAt);
      if (createdAtDateOnly && this.dueDate < createdAtDateOnly) {
        logger.error(`Task validation failed: dueDate "${this.dueDate}" must be >= createdAt "${createdAtDateOnly}"`);
        return false;
      }
    }
    return true;
  }

  /**
   * Validate planned time format and range
   * @returns {boolean} - Validation result
   * @private
   */
  _validatePlannedTime() {
    if (this.plannedTime !== null) {
      if (!(this.plannedTime instanceof Date)) {
        logger.error(`Task validation failed: plannedTime must be Date object or null, got ${typeof this.plannedTime}`);
        return false;
      }
      if (isNaN(this.plannedTime.getTime())) {
        logger.error(`Task validation failed: plannedTime is invalid Date object`);
        return false;
      }
      if (this.plannedTime < this.createdAt) {
        logger.error(`Task validation failed: plannedTime "${this.plannedTime.toISOString()}" must be >= createdAt "${this.createdAt.toISOString()}"`);
        return false;
      }
    }
    return true;
  }

  /**
   * Validate duration
   * @returns {boolean} - Validation result
   * @private
   */
  _validateDuration() {
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
    return true;
  }

  /**
   * Validate labels array
   * @returns {boolean} - Validation result
   * @private
   */
  _validateLabels() {
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
    return true;
  }

  /**
   * Validate dependencies array
   * @returns {boolean} - Validation result
   * @private
   */
  _validateDependencies() {
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
   * Get the next status in the cycle (planning -> doing -> done -> planning)
   * @returns {string} Next status
   */
  cycleStatus() {
    switch (this.status) {
      case STATUS.PLANNING:
        return STATUS.DOING;
      case STATUS.DOING:
        return STATUS.DONE;
      case STATUS.DONE:
        return STATUS.PLANNING;
      default:
        return STATUS.PLANNING;
    }
  }

  /**
   * Update task properties
   * @param {Object} data - Updated data
   */
  update(data) {
    this._updateBasicProperties(data);
    this._updateDateProperties(data);
    this._updateMetadataProperties(data);
    this.updatedAt = new Date();
  }

  /**
   * Update basic string properties
   * @param {Object} data - Updated data
   * @private
   */
  _updateBasicProperties(data) {
    if (data.name !== undefined) this.name = data.name;
    if (data.description !== undefined) this.description = data.description;
    if (data.projectId !== undefined) this.projectId = data.projectId;
  }

  /**
   * Update date and time properties
   * @param {Object} data - Updated data
   * @private
   */
  _updateDateProperties(data) {
    if (data.duration !== undefined) this.duration = data.duration;
    if (data.dueDate !== undefined) this._setDueDateForUpdate(data.dueDate);
    if (data.plannedTime !== undefined) this.plannedTime = data.plannedTime;
  }

  /**
   * Update metadata properties
   * @param {Object} data - Updated data
   * @private
   */
  _updateMetadataProperties(data) {
    if (data.dependencies !== undefined) this.dependencies = data.dependencies;
    if (data.status !== undefined) this.status = data.status;
    if (data.labels !== undefined) this.labels = data.labels;
    if (data.priority !== undefined) this.priority = data.priority;
  }

  /**
   * Parses and sets the dueDate property for update.
   * @param {string|Date|null|undefined} dateValue - The value to parse for dueDate.
   * @private
   */
  _setDueDateForUpdate(dateValue) {
    this.dueDate = dateValue === null ? null : coerceDateOnly(dateValue);
  }
}

export { Task };
