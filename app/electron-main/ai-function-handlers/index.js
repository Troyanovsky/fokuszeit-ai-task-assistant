/**
 * Main AI function handler registry and dispatcher.
 * Replaces the 42-case switch statement with a registry pattern.
 */

// Import domain handlers
import * as taskHandlers from './taskHandlers.js';
import * as projectHandlers from './projectHandlers.js';
import * as notificationHandlers from './notificationHandlers.js';
import * as recurrenceHandlers from './recurrenceHandlers.js';

// Import query handlers
import { handleQueryTasks } from './queryHandlers/taskQueryHandler.js';
import { handleQueryNotifications } from './queryHandlers/notificationQueryHandler.js';

/**
 * Handler registry mapping function names to their implementations.
 * Each entry specifies the module and method to call for a given function.
 */
const handlerRegistry = {
  // Task handlers
  addTask: { handler: taskHandlers.handleAddTask },
  updateTask: { handler: taskHandlers.handleUpdateTask },
  deleteTask: { handler: taskHandlers.handleDeleteTask },
  getTasks: { handler: taskHandlers.handleGetTasks },
  queryTasks: { handler: handleQueryTasks },
  planDay: { handler: taskHandlers.handlePlanDay },

  // Project handlers
  addProject: { handler: projectHandlers.handleAddProject },
  getProjects: { handler: projectHandlers.handleGetProjects },
  updateProject: { handler: projectHandlers.handleUpdateProject },
  deleteProject: { handler: projectHandlers.handleDeleteProject },

  // Notification handlers
  addNotification: { handler: notificationHandlers.handleAddNotification },
  updateNotification: { handler: notificationHandlers.handleUpdateNotification },
  deleteNotification: { handler: notificationHandlers.handleDeleteNotification },
  getNotifications: { handler: notificationHandlers.handleGetNotifications },
  getNotificationsByTask: { handler: notificationHandlers.handleGetNotificationsByTask },
  queryNotifications: { handler: handleQueryNotifications },

  // Recurrence handlers
  setTaskRecurrence: { handler: recurrenceHandlers.handleSetTaskRecurrence },
  removeTaskRecurrence: { handler: recurrenceHandlers.handleRemoveTaskRecurrence },
  getTaskRecurrence: { handler: recurrenceHandlers.handleGetTaskRecurrence }
};

/**
 * Main function handler dispatcher.
 * Routes function calls to their appropriate handlers using the registry.
 *
 * @param {string} functionName - Name of the function to handle
 * @param {Object} args - Function arguments
 * @param {Object} baseResult - Base result object
 * @returns {Promise<Object>} - Function result
 * @throws {Error} - If function is not available
 */
export async function handleFunctionCall(functionName, args, baseResult) {
  const registration = handlerRegistry[functionName];

  if (!registration) {
    throw new Error(`Function "${functionName}" is not available`);
  }

  return registration.handler(args, baseResult);
}

/**
 * Get the list of available function names.
 * @returns {string[]} - Array of function names
 */
export function getAvailableFunctions() {
  return Object.keys(handlerRegistry);
}

/**
 * Check if a function is available.
 * @param {string} functionName - Function name to check
 * @returns {boolean} - Whether the function is available
 */
export function hasFunction(functionName) {
  return functionName in handlerRegistry;
}
