/**
 * AI function handlers for task, project, and notification operations.
 */

import taskManager from './services/task.js';
import notificationService from './services/notification.js';
import logger from './logger.js';
import { isDebugLoggingEnabled, shouldLogRaw } from '../shared/utils/loggingConfig.js';
import { summarizeTasks, summarizeNotifications } from '../shared/utils/loggingSanitizers.js';

// Import extracted utilities from ai-function-handlers
import {
  formatToYYYYMMDD,
  formatDateToYYYYMMDDLocal,
  formatRecurrenceRuleForResponse,
  formatTaskForAI,
  formatNotificationForAI
} from './ai-function-handlers/utils/dateTimeParsers.js';
import {
  resolveProjectIds
} from './ai-function-handlers/utils/projectResolvers.js';
import {
  validateFrequency
} from './ai-function-handlers/utils/argumentParsers.js';

// Import extracted domain handlers from ai-function-handlers
import * as projectHandlers from './ai-function-handlers/projectHandlers.js';
import * as taskHandlers from './ai-function-handlers/taskHandlers.js';
import * as notificationHandlers from './ai-function-handlers/notificationHandlers.js';

/**
 * Handle queryTasks function call
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
// eslint-disable-next-line max-lines-per-function, complexity
async function handleQueryTasks(args, baseResult) {
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

  // Filter by specific IDs if provided
  if (args.ids && Array.isArray(args.ids) && args.ids.length > 0) {
    filteredTasks = filteredTasks.filter(task => args.ids.includes(task.id));
    filteringApplied = true;
  }

  // Filter by name substring
  if (args.nameContains) {
    filteredTasks = filteredTasks.filter(task =>
      task.name.toLowerCase().includes(args.nameContains.toLowerCase())
    );
    filteringApplied = true;
  }

  // Filter by description substring
  if (args.descriptionContains) {
    filteredTasks = filteredTasks.filter(task =>
      task.description && task.description.toLowerCase().includes(args.descriptionContains.toLowerCase())
    );
    filteringApplied = true;
  }

  // Filter by project IDs
  if (args.projectIds && Array.isArray(args.projectIds) && args.projectIds.length > 0) {
    // Convert project names to IDs if needed
    const projectIds = await resolveProjectIds(args.projectIds);

    filteredTasks = filteredTasks.filter(task => projectIds.includes(task.projectId));
    filteringApplied = true;
  }

  // Filter by statuses
  if (args.statuses && Array.isArray(args.statuses) && args.statuses.length > 0) {
    filteredTasks = filteredTasks.filter(task => args.statuses.includes(task.status));
    filteringApplied = true;
  }

  // Filter by priorities
  if (args.priorities && Array.isArray(args.priorities) && args.priorities.length > 0) {
    filteredTasks = filteredTasks.filter(task => args.priorities.includes(task.priority));
    filteringApplied = true;
  }

  // Filter by due date range
  if (args.dueDateStart) {
    try {
      const startDate = new Date(args.dueDateStart);
      logger.info('Filtering by due date start', { requestId, dueDateStart: args.dueDateStart });

      if (!isNaN(startDate)) {
        // Set the start date to the beginning of the day (00:00:00)
        startDate.setHours(0, 0, 0, 0);

        filteredTasks = filteredTasks.filter(task => {
          if (!task.dueDate) return false;

          // Parse task due date
          const taskDueDate = new Date(task.dueDate);

          // Compare dates ignoring time part
          return taskDueDate >= startDate;
        });

        filteringApplied = true;
      }
    } catch (error) {
      logger.logError(error, 'Error parsing dueDateStart');
    }
  }

  if (args.dueDateEnd) {
    try {
      const endDate = new Date(args.dueDateEnd);
      logger.info('Filtering by due date end', { requestId, dueDateEnd: args.dueDateEnd });

      if (!isNaN(endDate)) {
        // Set the end date to the end of the day (23:59:59.999)
        endDate.setHours(23, 59, 59, 999);

        filteredTasks = filteredTasks.filter(task => {
          if (!task.dueDate) return false;

          // Parse task due date
          const taskDueDate = new Date(task.dueDate);

          // Compare dates ignoring time part
          return taskDueDate <= endDate;
        });

        filteringApplied = true;
      }
    } catch (error) {
      logger.logError(error, 'Error parsing dueDateEnd');
    }
  }

  // Filter by planned time range
  if (args.plannedTimeStart) {
    try {
      const startTime = new Date(args.plannedTimeStart);
      if (!isNaN(startTime)) {
        filteredTasks = filteredTasks.filter(task =>
          task.plannedTime && new Date(task.plannedTime) >= startTime
        );
        filteringApplied = true;
      }
    } catch (error) {
      logger.logError(error, 'Error parsing plannedTimeStart');
    }
  }

  if (args.plannedTimeEnd) {
    try {
      const endTime = new Date(args.plannedTimeEnd);
      if (!isNaN(endTime)) {
        filteredTasks = filteredTasks.filter(task =>
          task.plannedTime && new Date(task.plannedTime) <= endTime
        );
        filteringApplied = true;
      }
    } catch (error) {
      logger.logError(error, 'Error parsing plannedTimeEnd');
    }
  }

  // Apply limit if provided
  const limit = args.limit || 20;
  if (filteredTasks.length > limit) {
    filteredTasks = filteredTasks.slice(0, limit);
  }

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

  // Format tasks consistently for AI readability
  const formattedTasks = filteredTasks.map(task => formatTaskForAI(task));

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

/**
 * Handle queryNotifications function call
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
// eslint-disable-next-line max-lines-per-function, complexity
async function handleQueryNotifications(args, baseResult) {
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
  let notifFilteringApplied = false;

  // Filter by specific IDs if provided
  if (args.ids && Array.isArray(args.ids) && args.ids.length > 0) {
    filteredNotifications = filteredNotifications.filter(notification =>
      args.ids.includes(notification.id)
    );
    notifFilteringApplied = true;
  }

  // Filter by task IDs
  if (args.taskIds && Array.isArray(args.taskIds) && args.taskIds.length > 0) {
    filteredNotifications = filteredNotifications.filter(notification =>
      args.taskIds.includes(notification.taskId)
    );
    notifFilteringApplied = true;
  }

  // Filter by time range
  if (args.timeStart) {
    try {
      const startTime = new Date(args.timeStart);
      logger.info('Filtering notifications by time start', { requestId, timeStart: args.timeStart });

      if (!isNaN(startTime)) {
        // For date-only inputs, set to beginning of day
        if (!args.timeStart.includes('T') && !args.timeStart.includes(':')) {
          startTime.setHours(0, 0, 0, 0);
        }

        filteredNotifications = filteredNotifications.filter(notification => {
          if (!notification.time) return false;

          // Parse notification time
          const notificationTime = new Date(notification.time);

          // Compare times
          return notificationTime >= startTime;
        });

        notifFilteringApplied = true;
      }
    } catch (error) {
      logger.logError(error, 'Error parsing timeStart');
    }
  }

  if (args.timeEnd) {
    try {
      const endTime = new Date(args.timeEnd);
      logger.info('Filtering notifications by time end', { requestId, timeEnd: args.timeEnd });

      if (!isNaN(endTime)) {
        // For date-only inputs, set to end of day
        if (!args.timeEnd.includes('T') && !args.timeEnd.includes(':')) {
          endTime.setHours(23, 59, 59, 999);
        }

        filteredNotifications = filteredNotifications.filter(notification => {
          if (!notification.time) return false;

          // Parse notification time
          const notificationTime = new Date(notification.time);

          // Compare times
          return notificationTime <= endTime;
        });

        notifFilteringApplied = true;
      }
    } catch (error) {
      logger.logError(error, 'Error parsing timeEnd');
    }
  }

  // Apply limit if provided
  const notificationLimit = args.limit || 20;
  if (filteredNotifications.length > notificationLimit) {
    filteredNotifications = filteredNotifications.slice(0, notificationLimit);
  }

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

  // Convert times to local time format for AI readability
  const formattedNotifications = filteredNotifications.map(notification => formatNotificationForAI(notification));

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
 * Handle setTaskRecurrence function call
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
async function handleSetTaskRecurrence(args, baseResult) {
  const recurrenceService = await import('./services/recurrence.js');

  // Validate required parameters
  if (!args.taskId || !args.frequency) {
    return {
      ...baseResult,
      success: false,
      error: 'Missing required parameters: taskId and frequency',
      message: 'I need a task ID and frequency to set recurrence.'
    };
  }

  // Validate frequency enum
  if (!validateFrequency(args.frequency)) {
    return {
      ...baseResult,
      success: false,
      error: `Invalid frequency: ${args.frequency}`,
      message: `I couldn't set recurrence because "${args.frequency}" is not a valid frequency. Valid options are: daily, weekly, monthly, yearly`
    };
  }

  // Build recurrence rule data
  const ruleData = {
    taskId: args.taskId,
    frequency: args.frequency
  };

  if (args.interval !== undefined && args.interval !== null) {
    ruleData.interval = args.interval;
  }

  // Add optional parameters
  if (args.endDate) {
    const formattedEndDate = formatToYYYYMMDD(args.endDate);
    if (formattedEndDate) {
      ruleData.endDate = formattedEndDate;
    } else {
      return {
        ...baseResult,
        success: false,
        error: `Invalid end date format: ${args.endDate}`,
        message: `I couldn't set recurrence because the end date format is invalid. Use YYYY-MM-DD format.`
      };
    }
  }

  if (args.count !== undefined && args.count !== null) {
    ruleData.count = args.count;
  }

  try {
    // Check if task already has a recurrence rule
    const existingRule = await recurrenceService.default.getRecurrenceRuleByTaskId(args.taskId);

    let result;
    let recurrenceRule = null;
    let ruleId = null;
    if (existingRule) {
      // Update existing rule
      result = await recurrenceService.default.updateRecurrenceRule(existingRule.id, ruleData);
      ruleId = existingRule.id;
    } else {
      // Add new rule
      if (ruleData.interval === undefined) {
        ruleData.interval = 1;
      }
      result = await recurrenceService.default.addRecurrenceRule(ruleData);
      ruleId = result?.id ?? null;
    }

    if (!result || !ruleId) {
      return {
        ...baseResult,
        success: false,
        error: 'Failed to save recurrence rule',
        message: `I couldn't save the recurrence rule for task "${args.taskId}". The operation may have failed validation or database constraints.`
      };
    }

    const savedRule = await recurrenceService.default.getRecurrenceRuleById(ruleId);
    recurrenceRule = formatRecurrenceRuleForResponse(savedRule);

    if (!recurrenceRule) {
      return {
        ...baseResult,
        success: false,
        error: 'Failed to save recurrence rule',
        message: `I couldn't save the recurrence rule for task "${args.taskId}". The operation may have failed validation or database constraints.`
      };
    }

    return {
      ...baseResult,
      success: true,
      recurrenceRule,
      taskId: args.taskId,
      message: `Task "${args.taskId}" has been set to repeat ${recurrenceRule.frequency}${recurrenceRule.interval > 1 ? ` every ${recurrenceRule.interval} ${recurrenceRule.frequency}s` : ''}.`
    };
  } catch (error) {
    logger.logError(error, 'Error setting task recurrence');
    return {
      ...baseResult,
      success: false,
      error: error.message,
      message: `I couldn't set recurrence for task "${args.taskId}": ${error.message}`
    };
  }
}

/**
 * Handle removeTaskRecurrence function call
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
async function handleRemoveTaskRecurrence(args, baseResult) {
  const recurrenceService = await import('./services/recurrence.js');

  if (!args.taskId) {
    return {
      ...baseResult,
      success: false,
      error: 'Missing required parameter: taskId',
      message: 'I need a task ID to remove recurrence.'
    };
  }

  try {
    const existingRule = await recurrenceService.default.getRecurrenceRuleByTaskId(args.taskId);
    if (!existingRule) {
      return {
        ...baseResult,
        success: true,
        taskId: args.taskId,
        hasRecurrence: false,
        message: `Task "${args.taskId}" does not have a recurrence rule to remove.`
      };
    }

    const removed = await recurrenceService.default.deleteRecurrenceRuleByTaskId(args.taskId);
    if (!removed) {
      return {
        ...baseResult,
        success: false,
        error: 'Failed to remove recurrence rule',
        message: `I couldn't remove recurrence from task "${args.taskId}". The delete operation failed.`
      };
    }

    return {
      ...baseResult,
      success: true,
      taskId: args.taskId,
      hasRecurrence: false,
      message: `Recurrence has been removed from task "${args.taskId}". The task will no longer repeat.`
    };
  } catch (error) {
    logger.logError(error, 'Error removing task recurrence');
    return {
      ...baseResult,
      success: false,
      error: error.message,
      message: `I couldn't remove recurrence from task "${args.taskId}": ${error.message}`
    };
  }
}

/**
 * Handle getTaskRecurrence function call
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
async function handleGetTaskRecurrence(args, baseResult) {
  const recurrenceService = await import('./services/recurrence.js');

  if (!args.taskId) {
    return {
      ...baseResult,
      success: false,
      error: 'Missing required parameter: taskId',
      message: 'I need a task ID to get recurrence information.'
    };
  }

  try {
    const rule = await recurrenceService.default.getRecurrenceRuleByTaskId(args.taskId);

    if (!rule) {
      return {
        ...baseResult,
        success: true,
        taskId: args.taskId,
        hasRecurrence: false,
        message: `Task "${args.taskId}" does not have a recurrence rule set.`
      };
    }

    // Format recurrence rule for AI readability
    const formattedRule = formatRecurrenceRuleForResponse(rule);

    // Build human-readable description
    const descriptionParts = [];
    descriptionParts.push(`Repeats ${rule.frequency}`);
    if (rule.interval > 1) {
      descriptionParts.push(`every ${rule.interval} ${rule.frequency}s`);
    }
    if (rule.endDate) {
      const formattedEndDate = formatDateToYYYYMMDDLocal(rule.endDate);
      if (formattedEndDate) {
        descriptionParts.push(`until ${formattedEndDate}`);
      }
    }
    if (rule.count) {
      descriptionParts.push(`for ${rule.count} total occurrences`);
    }

    return {
      ...baseResult,
      success: true,
      recurrenceRule: formattedRule,
      taskId: args.taskId,
      hasRecurrence: true,
      message: `Task "${args.taskId}" ${descriptionParts.join(' ')}.`
    };
  } catch (error) {
    logger.logError(error, 'Error getting task recurrence');
    return {
      ...baseResult,
      success: false,
      error: error.message,
      message: `I couldn't get recurrence information for task "${args.taskId}": ${error.message}`
    };
  }
}

/**
 * Main function handler dispatcher
 * @param {string} functionName - Name of the function to handle
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
// eslint-disable-next-line complexity
export async function handleFunctionCall(functionName, args, baseResult) {
  switch (functionName) {
    case 'addTask':
      return taskHandlers.handleAddTask(args, baseResult);
    case 'updateTask':
      return taskHandlers.handleUpdateTask(args, baseResult);
    case 'deleteTask':
      return taskHandlers.handleDeleteTask(args, baseResult);
    case 'getTasks':
      return taskHandlers.handleGetTasks(args, baseResult);
    case 'queryTasks':
      return handleQueryTasks(args, baseResult);
    case 'planDay':
      return taskHandlers.handlePlanDay(args, baseResult);
    case 'addProject':
      return projectHandlers.handleAddProject(args, baseResult);
    case 'getProjects':
      return projectHandlers.handleGetProjects(args, baseResult);
    case 'updateProject':
      return projectHandlers.handleUpdateProject(args, baseResult);
    case 'deleteProject':
      return projectHandlers.handleDeleteProject(args, baseResult);
    case 'addNotification':
      return notificationHandlers.handleAddNotification(args, baseResult);
    case 'updateNotification':
      return notificationHandlers.handleUpdateNotification(args, baseResult);
    case 'deleteNotification':
      return notificationHandlers.handleDeleteNotification(args, baseResult);
    case 'getNotifications':
      return notificationHandlers.handleGetNotifications(args, baseResult);
    case 'getNotificationsByTask':
      return notificationHandlers.handleGetNotificationsByTask(args, baseResult);
    case 'queryNotifications':
      return handleQueryNotifications(args, baseResult);
    case 'setTaskRecurrence':
      return handleSetTaskRecurrence(args, baseResult);
    case 'removeTaskRecurrence':
      return handleRemoveTaskRecurrence(args, baseResult);
    case 'getTaskRecurrence':
      return handleGetTaskRecurrence(args, baseResult);
    default:
      throw new Error(`Function "${functionName}" is not available`);
  }
}
