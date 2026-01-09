/**
 * Complex task query handler for AI function calls.
 * Handles task filtering with multiple criteria.
 */

import taskManager from '../../services/task.js';
import logger from '../../logger.js';
import { isDebugLoggingEnabled, shouldLogRaw } from '../../../shared/utils/loggingConfig.js';
import { summarizeTasks } from '../../../shared/utils/loggingSanitizers.js';
import { resolveProjectIds } from '../utils/projectResolvers.js';
import { formatTaskForAI } from '../utils/dateTimeParsers.js';

/**
 * Task query handler class with modular filter methods.
 */
class TaskQueryHandler {
  constructor() {
    this.filters = {
      byIds: this.filterByIds.bind(this),
      byNameContains: this.filterByNameContains.bind(this),
      byDescriptionContains: this.filterByDescriptionContains.bind(this),
      byProjectIds: this.filterByProjectIds.bind(this),
      byStatuses: this.filterByStatuses.bind(this),
      byPriorities: this.filterByPriorities.bind(this),
      byDueDateRange: this.filterByDueDateRange.bind(this),
      byPlannedTimeRange: this.filterByPlannedTimeRange.bind(this)
    };
  }

  /**
   * Filter tasks by specific IDs.
   * @param {Array} tasks - Tasks to filter
   * @param {Array} ids - IDs to include
   * @returns {Array} - Filtered tasks
   */
  filterByIds(tasks, ids) {
    return tasks.filter(task => ids.includes(task.id));
  }

  /**
   * Filter tasks by name substring.
   * @param {Array} tasks - Tasks to filter
   * @param {string} nameContains - Substring to search for
   * @returns {Array} - Filtered tasks
   */
  filterByNameContains(tasks, nameContains) {
    return tasks.filter(task =>
      task.name.toLowerCase().includes(nameContains.toLowerCase())
    );
  }

  /**
   * Filter tasks by description substring.
   * @param {Array} tasks - Tasks to filter
   * @param {string} descriptionContains - Substring to search for
   * @returns {Array} - Filtered tasks
   */
  filterByDescriptionContains(tasks, descriptionContains) {
    return tasks.filter(task =>
      task.description && task.description.toLowerCase().includes(descriptionContains.toLowerCase())
    );
  }

  /**
   * Filter tasks by project IDs.
   * @param {Array} tasks - Tasks to filter
   * @param {Array} projectIds - Project IDs to include
   * @returns {Array} - Filtered tasks
   */
  filterByProjectIds(tasks, projectIds) {
    return tasks.filter(task => projectIds.includes(task.projectId));
  }

  /**
   * Filter tasks by statuses.
   * @param {Array} tasks - Tasks to filter
   * @param {Array} statuses - Statuses to include
   * @returns {Array} - Filtered tasks
   */
  filterByStatuses(tasks, statuses) {
    return tasks.filter(task => statuses.includes(task.status));
  }

  /**
   * Filter tasks by priorities.
   * @param {Array} tasks - Tasks to filter
   * @param {Array} priorities - Priorities to include
   * @returns {Array} - Filtered tasks
   */
  filterByPriorities(tasks, priorities) {
    return tasks.filter(task => priorities.includes(task.priority));
  }

  /**
   * Filter tasks by due date range (start).
   * @param {Array} tasks - Tasks to filter
   * @param {string} dueDateStart - Start date (inclusive)
   * @returns {Array} - Filtered tasks
   */
  filterByDueDateRange(tasks, dueDateStart, dueDateEnd) {
    let filtered = tasks;

    if (dueDateStart) {
      try {
        const startDate = new Date(dueDateStart);
        if (!isNaN(startDate)) {
          startDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(task => {
            if (!task.dueDate) return false;
            const taskDueDate = new Date(task.dueDate);
            return taskDueDate >= startDate;
          });
        }
      } catch (error) {
        logger.logError(error, 'Error parsing dueDateStart');
      }
    }

    if (dueDateEnd) {
      try {
        const endDate = new Date(dueDateEnd);
        if (!isNaN(endDate)) {
          endDate.setHours(23, 59, 59, 999);
          filtered = filtered.filter(task => {
            if (!task.dueDate) return false;
            const taskDueDate = new Date(task.dueDate);
            return taskDueDate <= endDate;
          });
        }
      } catch (error) {
        logger.logError(error, 'Error parsing dueDateEnd');
      }
    }

    return filtered;
  }

  /**
   * Filter tasks by planned time range.
   * @param {Array} tasks - Tasks to filter
   * @param {string} plannedTimeStart - Start time (inclusive)
   * @param {string} plannedTimeEnd - End time (inclusive)
   * @returns {Array} - Filtered tasks
   */
  filterByPlannedTimeRange(tasks, plannedTimeStart, plannedTimeEnd) {
    let filtered = tasks;

    if (plannedTimeStart) {
      try {
        const startTime = new Date(plannedTimeStart);
        if (!isNaN(startTime)) {
          filtered = filtered.filter(task =>
            task.plannedTime && new Date(task.plannedTime) >= startTime
          );
        }
      } catch (error) {
        logger.logError(error, 'Error parsing plannedTimeStart');
      }
    }

    if (plannedTimeEnd) {
      try {
        const endTime = new Date(plannedTimeEnd);
        if (!isNaN(endTime)) {
          filtered = filtered.filter(task =>
            task.plannedTime && new Date(task.plannedTime) <= endTime
          );
        }
      } catch (error) {
        logger.logError(error, 'Error parsing plannedTimeEnd');
      }
    }

    return filtered;
  }

  /**
   * Apply limit to task results.
   * @param {Array} tasks - Tasks to limit
   * @param {number} limit - Maximum number of tasks
   * @returns {Array} - Limited tasks
   */
  applyLimit(tasks, limit) {
    const maxLimit = limit || 20;
    if (tasks.length > maxLimit) {
      return tasks.slice(0, maxLimit);
    }
    return tasks;
  }

  /**
   * Format tasks for AI readability.
   * @param {Array} tasks - Tasks to format
   * @returns {Array} - Formatted tasks
   */
  formatTasks(tasks) {
    return tasks.map(task => formatTaskForAI(task));
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

    // Start with all tasks
    let allTasks = await taskManager.getRecentTasks();
    const allTasksSummary = summarizeTasks(allTasks);
    logger.info('QueryTasks - Retrieved tasks', { requestId, total: allTasksSummary.count });
    if (debugEnabled) {
      logger.debug('QueryTasks summary', { requestId, summary: allTasksSummary });
      if (rawEnabled) {
        logger.debug('QueryTasks raw tasks', { requestId, tasks: allTasks });
      }
    }

    let filteredTasks = [...allTasks];
    let filteringApplied = false;

    // Apply filters sequentially
    if (args.ids && Array.isArray(args.ids) && args.ids.length > 0) {
      filteredTasks = this.filters.byIds(filteredTasks, args.ids);
      filteringApplied = true;
    }

    if (args.nameContains) {
      filteredTasks = this.filters.byNameContains(filteredTasks, args.nameContains);
      filteringApplied = true;
    }

    if (args.descriptionContains) {
      filteredTasks = this.filters.byDescriptionContains(filteredTasks, args.descriptionContains);
      filteringApplied = true;
    }

    if (args.projectIds && Array.isArray(args.projectIds) && args.projectIds.length > 0) {
      const projectIds = await resolveProjectIds(args.projectIds);
      filteredTasks = this.filters.byProjectIds(filteredTasks, projectIds);
      filteringApplied = true;
    }

    if (args.statuses && Array.isArray(args.statuses) && args.statuses.length > 0) {
      filteredTasks = this.filters.byStatuses(filteredTasks, args.statuses);
      filteringApplied = true;
    }

    if (args.priorities && Array.isArray(args.priorities) && args.priorities.length > 0) {
      filteredTasks = this.filters.byPriorities(filteredTasks, args.priorities);
      filteringApplied = true;
    }

    if (args.dueDateStart || args.dueDateEnd) {
      filteredTasks = this.filters.byDueDateRange(filteredTasks, args.dueDateStart, args.dueDateEnd);
      filteringApplied = true;
    }

    if (args.plannedTimeStart || args.plannedTimeEnd) {
      filteredTasks = this.filters.byPlannedTimeRange(filteredTasks, args.plannedTimeStart, args.plannedTimeEnd);
      filteringApplied = true;
    }

    // Apply limit
    const limit = args.limit || 20;
    filteredTasks = this.applyLimit(filteredTasks, limit);

    logger.info('QueryTasks - Filtered tasks', {
      requestId,
      total: filteredTasks.length,
      limit
    });
    if (debugEnabled) {
      logger.debug('QueryTasks filtered summary', {
        requestId,
        summary: summarizeTasks(filteredTasks)
      });
    }

    // Format tasks for AI readability
    const formattedTasks = this.formatTasks(filteredTasks);

    return {
      ...baseResult,
      success: true,
      tasks: formattedTasks,
      taskIds: formattedTasks.map(task => task.id),
      message: formattedTasks.length > 0
        ? `Found ${formattedTasks.length} tasks${filteringApplied ? ' matching your criteria' : ''}.${formattedTasks.length === limit ? ' (Result limit reached)' : ''}`
        : 'No tasks found matching your criteria.'
    };
  }
}

// Export a singleton instance
const taskQueryHandler = new TaskQueryHandler();

/**
 * Handle queryTasks function call.
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
export async function handleQueryTasks(args, baseResult) {
  return taskQueryHandler.query(args, baseResult);
}
