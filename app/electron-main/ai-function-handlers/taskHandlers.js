/**
 * Task handlers for AI function calls.
 * Handles all task-related operations (CRUD and day planning).
 */

import taskManager from '../services/task.js';
import { buildTaskResponse, buildQueryResponse } from './utils/responseFormatters.js';

/**
 * Handle addTask function call.
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
export async function handleAddTask(args, baseResult) {
  // Import processTaskArguments dynamically to avoid circular dependency
  const { processTaskArguments } = await import('./utils/argumentParsers.js');
  const processResult = await processTaskArguments(args, baseResult);
  if (processResult) return processResult;

  const task = await taskManager.addTask(args);
  return buildTaskResponse(
    baseResult,
    true,
    task,
    `Task "${args.name}" has been created with ID: ${task.id}.`
  );
}

/**
 * Handle updateTask function call.
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
export async function handleUpdateTask(args, baseResult) {
  // Import utilities dynamically to avoid circular dependency
  const { formatToYYYYMMDD, parseToISODateTime } = await import('./utils/dateTimeParsers.js');

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
 * Handle deleteTask function call.
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
export async function handleDeleteTask(args, baseResult) {
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
 * Handle getTasks function call (legacy function for backward compatibility).
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
export async function handleGetTasks(args, baseResult) {
  // Import resolveProjectId dynamically to avoid circular dependency
  const { resolveProjectId } = await import('./utils/projectResolvers.js');

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

  return buildQueryResponse(baseResult, tasks, 'task', null, false);
}

/**
 * Handle planDay function call.
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 */
export async function handlePlanDay(args, baseResult) {
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
