import { ipcMain } from 'electron';
import Project from '../shared/models/Project.js';
import projectManager from './services/project.js';
import taskManager from './services/task.js';
import notificationService from './services/notification.js';
import preferencesService from './services/preferences.js';
import recurrenceService from './services/recurrence.js';
import logger from './logger.js';

/**
 * Set up IPC handlers for project and task operations
 * @param {BrowserWindow} mainWindow - The main application window
 * @param {Object} aiService - The AI service module
 */
export function setupIpcHandlers(mainWindow, aiService) {
  // Project operations
  ipcMain.handle('projects:getAll', async () => {
    try {
      return await projectManager.getProjects();
    } catch (error) {
      logger.logError(error, 'IPC Error - getProjects');
      return [];
    }
  });

  ipcMain.handle('projects:add', async (_, projectData) => {
    try {
      const project = new Project(projectData);
      return await projectManager.addProject(project);
    } catch (error) {
      logger.logError(error, 'IPC Error - addProject');
      return false;
    }
  });

  ipcMain.handle('projects:update', async (_, projectData) => {
    try {
      logger.debug('Received project update request:', projectData);
      const project = new Project(projectData);
      logger.debug('Created project instance:', project);
      const result = await projectManager.updateProject(project);
      logger.debug('Update result:', result);
      return result;
    } catch (error) {
      logger.logError(error, 'IPC Error - updateProject');
      return false;
    }
  });

  ipcMain.handle('projects:delete', async (_, projectId) => {
    try {
      return await projectManager.deleteProject(projectId);
    } catch (error) {
      logger.logError(error, 'IPC Error - deleteProject');
      return false;
    }
  });

  // Task operations
  ipcMain.handle('tasks:getAll', async () => {
    try {
      return await taskManager.getTasks();
    } catch (error) {
      logger.logError(error, 'IPC Error - getTasks');
      return [];
    }
  });

  ipcMain.handle('tasks:getRecent', async () => {
    try {
      return await taskManager.getRecentTasks();
    } catch (error) {
      logger.logError(error, 'IPC Error - getRecentTasks');
      return [];
    }
  });

  ipcMain.handle('tasks:getByProject', async (_, projectId) => {
    try {
      return await taskManager.getTasksByProject(projectId);
    } catch (error) {
      logger.logError(error, `IPC Error - getTasksByProject for ${projectId}`);
      return [];
    }
  });

  ipcMain.handle('tasks:getRecentByProject', async (_, projectId) => {
    try {
      return await taskManager.getRecentTasksByProject(projectId);
    } catch (error) {
      logger.logError(error, `IPC Error - getRecentTasksByProject for ${projectId}`);
      return [];
    }
  });

  ipcMain.handle('tasks:add', async (_, taskData) => {
    try {
      const result = await taskManager.addTask(taskData);
      return result;
    } catch (error) {
      logger.logError(error, 'IPC Error - addTask');
      return false;
    }
  });

  ipcMain.handle('tasks:update', async (_, taskData) => {
    try {
      return await taskManager.updateTask(taskData);
    } catch (error) {
      logger.logError(error, 'IPC Error - updateTask');
      return false;
    }
  });

  ipcMain.handle('tasks:delete', async (_, taskId) => {
    try {
      return await taskManager.deleteTask(taskId);
    } catch (error) {
      logger.logError(error, `IPC Error - deleteTask for ${taskId}`);
      return false;
    }
  });

  ipcMain.handle('tasks:updateStatus', async (_, taskId, status) => {
    try {
      const result = await taskManager.updateTaskStatus(taskId, status);

      // If a new recurring task was created, notify the frontend
      if (result && typeof result === 'object' && result.newTask) {
        // Emit task refresh event to update the UI
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('tasks:refresh');
          mainWindow.webContents.send('task:recurring-created', {
            originalTaskId: taskId,
            newTask: result.newTask
          });
        }
        return result.success;
      }

      return result;
    } catch (error) {
      logger.logError(error, `IPC Error - updateTaskStatus for ${taskId}`);
      return false;
    }
  });

  ipcMain.handle('tasks:rescheduleOverdue', async () => {
    try {
      const result = await taskManager.rescheduleOverdueTasksToToday();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tasks:refresh');
      }
      return result;
    } catch (error) {
      logger.logError(error, 'IPC Error - rescheduleOverdueTasks');
      return false;
    }
  });

  ipcMain.handle('tasks:planMyDay', async () => {
    try {
      // Get user preferences for working hours and buffer time
      const preferences = await preferencesService.getPreferences();

      // Plan the day using the task manager with complete preferences
      const result = await taskManager.planMyDay(preferences);

      // Notify the renderer to refresh tasks
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tasks:refresh');
      }

      return result;
    } catch (error) {
      logger.logError(error, 'IPC Error - planMyDay');
      return {
        scheduled: [],
        unscheduled: [],
        message: `Error planning day: ${error.message}`
      };
    }
  });

  // Notification operations
  ipcMain.handle('notifications:getByTask', async (_, taskId) => {
    try {
      return await notificationService.getNotificationsByTask(taskId);
    } catch (error) {
      logger.logError(error, `IPC Error - getNotificationsByTask for ${taskId}`);
      return [];
    }
  });

  ipcMain.handle('notifications:add', async (_, notificationData) => {
    try {
      const result = await notificationService.addNotification(notificationData);
      if (result) {
        // Emit notification changed event with the task ID
        mainWindow.webContents.send('notifications:changed', notificationData.taskId || notificationData.task_id);
        mainWindow.webContents.send('notifications:refresh');
      }
      return result;
    } catch (error) {
      logger.logError(error, 'IPC Error - addNotification');
      return false;
    }
  });

  ipcMain.handle('notifications:update', async (_, notificationData) => {
    try {
      const result = await notificationService.updateNotification(notificationData);
      if (result) {
        // Emit notification changed event with the task ID
        mainWindow.webContents.send('notifications:changed', notificationData.taskId || notificationData.task_id);
        mainWindow.webContents.send('notifications:refresh');
      }
      return result;
    } catch (error) {
      logger.logError(error, `IPC Error - updateNotification for ${notificationData.id}`);
      return false;
    }
  });

  ipcMain.handle('notifications:delete', async (_, notificationId) => {
    try {
      // Get the specific notification to know which task it belongs to
      const notification = await notificationService.getNotificationById(notificationId);
      const taskId = notification ? notification.taskId || notification.task_id : null;
      
      const result = await notificationService.deleteNotification(notificationId);
      if (result && taskId) {
        // Emit notification changed event with the task ID
        mainWindow.webContents.send('notifications:changed', taskId);
        mainWindow.webContents.send('notifications:refresh');
      }
      return result;
    } catch (error) {
      logger.logError(error, `IPC Error - deleteNotification for ${notificationId}`);
      return false;
    }
  });

  // Set up notification event listener
  ipcMain.on('notification', (event, notification) => {
    // Forward notification to renderer process
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('notification:received', notification);
    }
  });

  // Recurrence operations
  ipcMain.handle('recurrence:add', async (_, ruleData) => {
    try {
      const result = await recurrenceService.addRecurrenceRule(ruleData);
      if (result) {
        // Emit recurrence changed event with the task ID
        mainWindow.webContents.send('recurrence:changed', ruleData.taskId || ruleData.task_id);
      }
      return result;
    } catch (error) {
      logger.logError(error, 'IPC Error - addRecurrenceRule');
      return false;
    }
  });

  ipcMain.handle('recurrence:getByTask', async (_, taskId) => {
    try {
      return await recurrenceService.getRecurrenceRuleByTaskId(taskId);
    } catch (error) {
      logger.logError(error, `IPC Error - getRecurrenceRuleByTaskId for ${taskId}`);
      return null;
    }
  });

  ipcMain.handle('recurrence:getById', async (_, ruleId) => {
    try {
      return await recurrenceService.getRecurrenceRuleById(ruleId);
    } catch (error) {
      logger.logError(error, `IPC Error - getRecurrenceRuleById for ${ruleId}`);
      return null;
    }
  });

  ipcMain.handle('recurrence:update', async (_, ruleId, updateData) => {
    try {
      const result = await recurrenceService.updateRecurrenceRule(ruleId, updateData);
      if (result) {
        // Get the rule to find the task ID for the event
        const rule = await recurrenceService.getRecurrenceRuleById(ruleId);
        if (rule) {
          mainWindow.webContents.send('recurrence:changed', rule.taskId);
        }
      }
      return result;
    } catch (error) {
      logger.logError(error, `IPC Error - updateRecurrenceRule for ${ruleId}`);
      return false;
    }
  });

  ipcMain.handle('recurrence:delete', async (_, ruleId) => {
    try {
      // Get the rule to find the task ID before deletion
      const rule = await recurrenceService.getRecurrenceRuleById(ruleId);
      const taskId = rule ? rule.taskId : null;

      const result = await recurrenceService.deleteRecurrenceRule(ruleId);
      if (result && taskId) {
        // Emit recurrence changed event with the task ID
        mainWindow.webContents.send('recurrence:changed', taskId);
      }
      return result;
    } catch (error) {
      logger.logError(error, `IPC Error - deleteRecurrenceRule for ${ruleId}`);
      return false;
    }
  });

  ipcMain.handle('recurrence:deleteByTask', async (_, taskId) => {
    try {
      const result = await recurrenceService.deleteRecurrenceRuleByTaskId(taskId);
      if (result) {
        // Emit recurrence changed event with the task ID
        mainWindow.webContents.send('recurrence:changed', taskId);
      }
      return result;
    } catch (error) {
      logger.logError(error, `IPC Error - deleteRecurrenceRuleByTaskId for ${taskId}`);
      return false;
    }
  });

  // Preferences operations
  ipcMain.handle('preferences:get', async () => {
    try {
      return preferencesService.getPreferences();
    } catch (error) {
      logger.logError(error, 'IPC Error - getPreferences');
      return {
        workingHours: {
          startTime: '10:00',
          endTime: '19:00'
        }
      };
    }
  });

  ipcMain.handle('preferences:updateWorkingHours', async (_, workingHours) => {
    try {
      return preferencesService.updateWorkingHours(workingHours);
    } catch (error) {
      logger.logError(error, 'IPC Error - updateWorkingHours');
      return false;
    }
  });

  ipcMain.handle('preferences:updateBufferTime', async (_, bufferTime) => {
    try {
      return preferencesService.updateBufferTime(bufferTime);
    } catch (error) {
      logger.logError(error, 'IPC Error - updateBufferTime');
      return false;
    }
  });

  // AI operations
  ipcMain.handle('ai:configure', async (_, config) => {
    return aiService.configureAI(config);
  });

  ipcMain.handle('ai:getChatHistory', () => {
    return aiService.getChatHistory();
  });

  ipcMain.handle('ai:clearHistory', () => {
    return aiService.clearHistory();
  });

  ipcMain.handle('ai:sendMessage', async (_, message) => {
    return aiService.sendMessage(message, mainWindow);
  });
} 