import { ipcMain } from 'electron';
import taskManager from '../services/task.js';
import preferencesService from '../services/preferences.js';
import logger from '../logger.js';

/**
 * Register IPC handlers for task status update, rescheduling, and day planning operations.
 * @param {BrowserWindow} mainWindow - The main application window
 */
export function registerTaskSchedulingHandlers(mainWindow) {
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
}
