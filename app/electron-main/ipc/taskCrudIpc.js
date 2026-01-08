import { ipcMain } from 'electron';
import taskManager from '../services/task.js';
import logger from '../logger.js';

/**
 * Register IPC handlers for task CRUD operations (get, add, update, delete).
 */
export function registerTaskCrudHandlers() {
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
}
