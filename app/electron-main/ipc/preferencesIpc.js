import { ipcMain } from 'electron';
import preferencesService from '../services/preferences.js';
import logger from '../logger.js';

/**
 * Register IPC handlers for user preferences operations.
 */
export function registerPreferencesHandlers() {
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
}
