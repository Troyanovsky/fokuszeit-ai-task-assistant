/**
 * AI function handlers for task, project, and notification operations.
 */

import Project from '../src/models/Project.js';
import projectManager from '../src/services/project.js';
import taskManager from '../src/services/task.js';
import notificationService from '../src/services/notification.js';
import { Notification, TYPE } from '../src/models/Notification.js';
import logger from './logger.js';
import { isDebugLoggingEnabled, shouldLogRaw } from '../src/utils/loggingConfig.js';
import { summarizeTasks, summarizeNotifications } from '../src/utils/loggingSanitizers.js';

/**
 * Utility function to resolve a project ID from a name or ID
 * @param {string} projectId - Project ID or name
 * @returns {Promise<string|null>} - Resolved project ID or null if not found
 */
async function resolveProjectId(projectId) {
  // If it's already a UUID format (contains hyphens), return it as is
  if (typeof projectId === 'string' && projectId.includes('-')) {
    return projectId;
  }
  
  // It's likely a project name, look up the project by name
  logger.info(`Looking up project ID for project name: ${projectId}`);
  const projects = await projectManager.getProjects();
  const project = projects.find(p => p.name.toLowerCase() === projectId.toLowerCase());
  
  if (project) {
    logger.info(`Found project ID ${project.id} for name: ${projectId}`);
    return project.id;
  }
  
  logger.info(`No project found for name: ${projectId}`);
  return null;
}

/**
 * Utility function to format a date string to YYYY-MM-DD format
 * @param {string} dateString - Date string to format
 * @returns {string|null} - Formatted date string or null if invalid
 */
function formatToYYYYMMDD(dateString) {
  try {
    logger.info(`Original date input: ${dateString}`);
    
    // If it already has time component, extract just the date part
    if (dateString.includes('T')) {
      dateString = dateString.split('T')[0];
      logger.info(`Extracted date part from ISO string: ${dateString}`);
    }
    
    // Validate the date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      // If not in YYYY-MM-DD format, try to convert it
      logger.info(`Date ${dateString} doesn't match YYYY-MM-DD format, parsing as Date`);
      
      // Fix: Create date with UTC to prevent timezone issues
      const [year, month, day] = dateString.split('-');
      if (year && month && day) {
        // Ensure month and day are zero-padded
        const paddedMonth = month.padStart(2, '0');
        const paddedDay = day.padStart(2, '0');
        dateString = `${year}-${paddedMonth}-${paddedDay}`;
        logger.info(`Formatted date with padding: ${dateString}`);
      } else {
        // If we can't split it, use the Date object but force UTC
        const parsedDate = new Date(dateString);
        if (!isNaN(parsedDate)) {
          // Use UTC methods to avoid timezone issues
          const utcYear = parsedDate.getUTCFullYear();
          const utcMonth = String(parsedDate.getUTCMonth() + 1).padStart(2, '0');
          const utcDay = String(parsedDate.getUTCDate()).padStart(2, '0');
          dateString = `${utcYear}-${utcMonth}-${utcDay}`;
          logger.info(`Parsed and formatted date using UTC: ${dateString}`);
        } else {
          logger.info(`Invalid date format: ${dateString}`);
          return null;
        }
      }
    } else {
      logger.info(`Date already in correct YYYY-MM-DD format: ${dateString}`);
    }
    
    return dateString;
  } catch (error) {
    logger.logError(error, 'Error parsing date');
    return null;
  }
}

/**
 * Utility function to parse a date-time string to ISO format
 * @param {string} timeString - Date-time string to parse
 * @param {string} context - Context for logging
 * @returns {string|null} - Parsed date-time in ISO format or null if invalid
 */
function parseToISODateTime(timeString, context = 'date-time') {
  try {
    // Try parsing as ISO first to see if it's already in ISO format
    let parsedTime = new Date(timeString);
    
    // If invalid or looks like a local date format, try parsing it as a local date
    if (isNaN(parsedTime) || !timeString.includes('T')) {
      // This is likely a local date format (e.g., "May 31, 2023 15:30" or "5/31/2023 15:30")
      logger.info(`Converting local date format for ${context}: ${timeString}`);
      
      // Try to parse date using more flexible approach
      parsedTime = new Date(timeString);
      
      // If still invalid, try some common formats
      if (isNaN(parsedTime)) {
        logger.info(`Failed to parse date directly, attempting structured parsing`);
        // Try to extract date and time components from common formats
        const dateTimeParts = timeString.split(/,\s*| /);
        if (dateTimeParts.length >= 2) {
          // Last part is likely the time
          const timePart = dateTimeParts[dateTimeParts.length - 1];
          // Join the rest as the date part
          const datePart = dateTimeParts.slice(0, dateTimeParts.length - 1).join(' ');
          parsedTime = new Date(`${datePart} ${timePart}`);
        }
      }
    }

    if (isNaN(parsedTime)) {
      logger.info(`Failed to parse ${context}: ${timeString}`);
      return null;
    }

    // Convert to ISO string
    const isoString = parsedTime.toISOString();
    logger.info(`Parsed ${context} from "${timeString}" to ISO: ${isoString}`);
    return isoString;
  } catch (error) {
    logger.logError(error, `Error parsing ${context}`);
    return null;
  }
}

/**
 * Process common task arguments (dates, project resolution)
 * @param {Object} args - Task arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Processed arguments or error result
 */
async function processTaskArguments(args, baseResult) {
  // Resolve project ID if provided
  if (args.projectId && typeof args.projectId === 'string') {
    const resolvedProjectId = await resolveProjectId(args.projectId);
    if (resolvedProjectId) {
      args.projectId = resolvedProjectId;
    } else {
      return {
        ...baseResult,
        success: false,
        error: `Project "${args.projectId}" not found`,
        message: `I couldn't find a project named "${args.projectId}". Please specify a valid project name or ID.`
      };
    }
  }

  // Handle dueDate as YYYY-MM-DD string format
  if (args.dueDate && typeof args.dueDate === 'string') {
    args.dueDate = formatToYYYYMMDD(args.dueDate);
  }

  // Convert local time string to ISO format if provided for plannedTime
  if (args.plannedTime && typeof args.plannedTime === 'string') {
    const isoDateTime = parseToISODateTime(args.plannedTime, 'planned time');
    if (isoDateTime) {
      args.plannedTime = isoDateTime;
    } else {
      return {
        ...baseResult,
        success: false,
        error: `Could not parse date/time from: ${args.plannedTime}`,
        message: `I couldn't process the planned time because the format is invalid: ${args.plannedTime}`
      };
    }
  }

  return null; // No error, processing successful
}

/**
 * Handle addTask function call
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
async function handleAddTask(args, baseResult) {
  const processResult = await processTaskArguments(args, baseResult);
  if (processResult) return processResult;

  const task = await taskManager.addTask(args);
  return {
    ...baseResult,
    success: true,
    task,
    taskId: task.id,
    message: `Task "${args.name}" has been created with ID: ${task.id}.`
  };
}

/**
 * Handle updateTask function call
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
async function handleUpdateTask(args, baseResult) {
  // Handle dueDate as YYYY-MM-DD string format
  if (args.dueDate && typeof args.dueDate === 'string') {
    args.dueDate = formatToYYYYMMDD(args.dueDate);
  }

  // Convert local time string to ISO format if provided for plannedTime
  if (args.plannedTime && typeof args.plannedTime === 'string') {
    const isoDateTime = parseToISODateTime(args.plannedTime, 'planned time');
    if (isoDateTime) {
      args.plannedTime = isoDateTime;
    } else {
      return {
        ...baseResult,
        success: false,
        error: `Could not parse date/time from: ${args.plannedTime}`,
        message: `I couldn't update the task because the planned time format is invalid: ${args.plannedTime}`
      };
    }
  }

  await taskManager.updateTask(args);
  return {
    ...baseResult,
    success: true,
    taskId: args.id,
    message: `Task "${args.id}" has been updated.`
  };
}

/**
 * Handle deleteTask function call
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
async function handleDeleteTask(args, baseResult) {
  const deleteResult = await taskManager.deleteTask(args.id);
  if (!deleteResult) {
    return {
      ...baseResult,
      success: false,
      taskId: args.id,
      message: `Task with ID ${args.id} not found or couldn't be deleted.`
    };
  }
  return {
    ...baseResult,
    success: true,
    taskId: args.id,
    message: `Task with ID ${args.id} has been deleted.`
  };
}

/**
 * Handle getTasks function call
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
async function handleGetTasks(args, baseResult) {
  // Legacy function for backward compatibility
  let tasks = await taskManager.getRecentTasks();

  if (args.projectId) {
    // Resolve project ID if provided
    const resolvedProjectId = await resolveProjectId(args.projectId);
    if (resolvedProjectId) {
      args.projectId = resolvedProjectId;
    } else {
      return {
        ...baseResult,
        success: false,
        error: `Project "${args.projectId}" not found`,
        message: `I couldn't find a project named "${args.projectId}". Please specify a valid project name or ID.`
      };
    }

    tasks = tasks.filter(task => task.projectId === args.projectId);
  }

  if (args.status) {
    tasks = tasks.filter(task => task.status === args.status);
  }

  if (args.priority) {
    tasks = tasks.filter(task => task.priority === args.priority);
  }

  return {
    ...baseResult,
    success: true,
    tasks,
    taskIds: tasks.map(task => task.id),
    message: tasks.length > 0
      ? `Found ${tasks.length} tasks.`
      : 'No tasks found matching your criteria.'
  };
}

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
    const projectIds = [];
    for (const projectId of args.projectIds) {
      const resolvedId = await resolveProjectId(projectId);
      if (resolvedId) {
        projectIds.push(resolvedId);
      }
    }

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
  const formattedTasks = filteredTasks.map(task => {
    const formattedTask = { ...task };

    // Ensure dueDate is consistently in YYYY-MM-DD format
    if (formattedTask.dueDate) {
      // If it has time component, extract just the date part
      if (typeof formattedTask.dueDate === 'string' && formattedTask.dueDate.includes('T')) {
        formattedTask.dueDate = formattedTask.dueDate.split('T')[0];
      } else if (formattedTask.dueDate instanceof Date) {
        // Convert Date object to YYYY-MM-DD string
        formattedTask.dueDate = formattedTask.dueDate.toISOString().split('T')[0];
      }
    }

    // Convert plannedTime to user-friendly local time string if it exists
    if (formattedTask.plannedTime) {
      const plannedTime = new Date(formattedTask.plannedTime);
      // Format with date and time components for better readability
      const dateOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
      const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
      formattedTask.plannedTime = `${plannedTime.toLocaleDateString(undefined, dateOptions)} at ${plannedTime.toLocaleTimeString(undefined, timeOptions)}`;
    }

    return formattedTask;
  });

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
 * Handle planDay function call
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
async function handlePlanDay(args, baseResult) {
  const plannedTasks = await taskManager.planDay(args);
  const taskIds = plannedTasks.map(task => task.id);

  return {
    ...baseResult,
    success: true,
    plannedTasks,
    taskIds,
    message: `Day planned with ${plannedTasks.length} tasks.`
  };
}

/**
 * Handle addProject function call
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
async function handleAddProject(args, baseResult) {
  const project = new Project(args);
  await projectManager.addProject(project);
  return {
    ...baseResult,
    success: true,
    project: project,
    projectId: project.id,
    message: `Project "${args.name}" has been created with ID: ${project.id}.`
  };
}

/**
 * Handle getProjects function call
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
async function handleGetProjects(args, baseResult) {
  const projects = await projectManager.getProjects();
  const projectIds = projects.map(project => project.id);
  return {
    ...baseResult,
    success: true,
    projects,
    projectIds,
    message: `Found ${projects.length} projects.`
  };
}

/**
 * Handle updateProject function call
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
async function handleUpdateProject(args, baseResult) {
  const updatedProject = new Project(args);
  const updateProjectResult = await projectManager.updateProject(updatedProject);
  return {
    ...baseResult,
    success: updateProjectResult,
    projectId: updatedProject.id,
    message: updateProjectResult
      ? `Project "${args.name}" (ID: ${updatedProject.id}) has been updated.`
      : `Failed to update project "${args.name}" (ID: ${updatedProject.id}).`
  };
}

/**
 * Handle deleteProject function call
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
async function handleDeleteProject(args, baseResult) {
  const deleteProjectResult = await projectManager.deleteProject(args.id);
  return {
    ...baseResult,
    success: deleteProjectResult,
    projectId: args.id,
    message: deleteProjectResult
      ? `Project with ID ${args.id} has been deleted.`
      : `Failed to delete project with ID ${args.id}.`
  };
}

/**
 * Handle addNotification function call
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
async function handleAddNotification(args, baseResult) {
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

  // Validate notification type
  if (!Object.values(TYPE).includes(args.type)) {
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
 * Handle updateNotification function call
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
async function handleUpdateNotification(args, baseResult) {
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

  // Validate notification type if provided
  if (args.type && !Object.values(TYPE).includes(args.type)) {
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
 * Handle deleteNotification function call
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
async function handleDeleteNotification(args, baseResult) {
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
 * Handle getNotifications function call
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
async function handleGetNotifications(args, baseResult) {
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
 * Handle getNotificationsByTask function call
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
async function handleGetNotificationsByTask(args, baseResult) {
  const notifications = await notificationService.getNotificationsByTask(args.taskId);
  return {
    ...baseResult,
    success: true,
    notifications,
    notificationIds: notifications.map(notification => notification.id),
    message: notifications.length > 0
      ? `Found ${notifications.length} notifications for task ${args.taskId}.`
      : `No notifications found for task ${args.taskId}.`
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
  const formattedNotifications = filteredNotifications.map(notification => {
    const formattedNotification = { ...notification };

    // Convert notification time to local time string if it exists
    if (formattedNotification.time) {
      const time = new Date(formattedNotification.time);
      formattedNotification.time = time.toLocaleString();
    }

    return formattedNotification;
  });

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
      return handleAddTask(args, baseResult);
    case 'updateTask':
      return handleUpdateTask(args, baseResult);
    case 'deleteTask':
      return handleDeleteTask(args, baseResult);
    case 'getTasks':
      return handleGetTasks(args, baseResult);
    case 'queryTasks':
      return handleQueryTasks(args, baseResult);
    case 'planDay':
      return handlePlanDay(args, baseResult);
    case 'addProject':
      return handleAddProject(args, baseResult);
    case 'getProjects':
      return handleGetProjects(args, baseResult);
    case 'updateProject':
      return handleUpdateProject(args, baseResult);
    case 'deleteProject':
      return handleDeleteProject(args, baseResult);
    case 'addNotification':
      return handleAddNotification(args, baseResult);
    case 'updateNotification':
      return handleUpdateNotification(args, baseResult);
    case 'deleteNotification':
      return handleDeleteNotification(args, baseResult);
    case 'getNotifications':
      return handleGetNotifications(args, baseResult);
    case 'getNotificationsByTask':
      return handleGetNotificationsByTask(args, baseResult);
    case 'queryNotifications':
      return handleQueryNotifications(args, baseResult);
    default:
      throw new Error(`Function "${functionName}" is not available`);
  }
}
