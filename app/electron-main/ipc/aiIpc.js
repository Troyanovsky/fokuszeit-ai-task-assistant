import { ipcMain } from 'electron';

/**
 * Register IPC handlers for AI service operations.
 * @param {BrowserWindow} mainWindow - The main application window
 * @param {Object} aiService - The AI service module
 */
export function registerAiHandlers(mainWindow, aiService) {
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
