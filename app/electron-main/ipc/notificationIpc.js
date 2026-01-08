import { ipcMain } from 'electron';
import notificationService from '../services/notification.js';
import logger from '../logger.js';

/**
 * Register IPC handlers for notification CRUD operations and events.
 * @param {BrowserWindow} mainWindow - The main application window
 */
export function registerNotificationHandlers(mainWindow) {
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
}
