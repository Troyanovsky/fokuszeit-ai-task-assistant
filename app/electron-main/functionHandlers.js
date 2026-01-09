/**
 * AI function handlers for task, project, and notification operations.
 */

// Import extracted domain handlers from ai-function-handlers
import * as projectHandlers from './ai-function-handlers/projectHandlers.js';
import * as taskHandlers from './ai-function-handlers/taskHandlers.js';
import * as notificationHandlers from './ai-function-handlers/notificationHandlers.js';
import * as recurrenceHandlers from './ai-function-handlers/recurrenceHandlers.js';

// Import extracted query handlers from ai-function-handlers
import { handleQueryTasks } from './ai-function-handlers/queryHandlers/taskQueryHandler.js';
import { handleQueryNotifications } from './ai-function-handlers/queryHandlers/notificationQueryHandler.js';

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
      return recurrenceHandlers.handleSetTaskRecurrence(args, baseResult);
    case 'removeTaskRecurrence':
      return recurrenceHandlers.handleRemoveTaskRecurrence(args, baseResult);
    case 'getTaskRecurrence':
      return recurrenceHandlers.handleGetTaskRecurrence(args, baseResult);
    default:
      throw new Error(`Function "${functionName}" is not available`);
  }
}
