import { ipcMain } from 'electron';
import recurrenceService from '../services/recurrence.js';
import logger from '../logger.js';

/**
 * Register IPC handlers for recurrence rule CRUD operations.
 * @param {BrowserWindow} mainWindow - The main application window
 */
export function registerRecurrenceHandlers(mainWindow) {
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
}
