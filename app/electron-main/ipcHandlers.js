/**
 * Consolidated IPC handler registration for the main process.
 *
 * This module orchestrates the registration of all IPC (Inter-Process Communication) handlers
 * that facilitate communication between the main process and renderer process. It delegates
 * to domain-specific registrar modules for projects, tasks, notifications, recurrence rules,
 * preferences, and AI operations.
 *
 * Each domain-specific registrar module is responsible for:
 * - Registering handlers for its specific domain
 * - Handling errors and logging appropriately
 * - Emitting UI refresh events when data changes
 *
 * The main process uses ipcMain.handle() for request/response patterns and ipcMain.on()
 * for event-based communication. All renderer communication must go through the
 * context-isolated preload script (preload.cjs) for security.
 *
 * @see ../preload.cjs - Context-isolated IPC bridge
 * @see ipc/ - Domain-specific IPC registrar modules
 */

import { registerProjectHandlers } from './ipc/projectIpc.js';
import { registerTaskCrudHandlers } from './ipc/taskCrudIpc.js';
import { registerTaskSchedulingHandlers } from './ipc/taskSchedulingIpc.js';
import { registerNotificationHandlers } from './ipc/notificationIpc.js';
import { registerRecurrenceHandlers } from './ipc/recurrenceIpc.js';
import { registerPreferencesHandlers } from './ipc/preferencesIpc.js';
import { registerAiHandlers } from './ipc/aiIpc.js';

/**
 * Set up IPC handlers for all application operations.
 *
 * This function registers all IPC handlers by delegating to domain-specific registrars.
 * Each registrar handles a specific domain (projects, tasks, notifications, etc.) and
 * is responsible for error handling, logging, and emitting appropriate UI refresh events.
 *
 * @param {BrowserWindow} mainWindow - The main application window for sending events
 * @param {Object} aiService - The AI service module for chat and configuration operations
 */
export function setupIpcHandlers(mainWindow, aiService) {
  registerProjectHandlers();
  registerTaskCrudHandlers();
  registerTaskSchedulingHandlers(mainWindow);
  registerNotificationHandlers(mainWindow);
  registerRecurrenceHandlers(mainWindow);
  registerPreferencesHandlers();
  registerAiHandlers(mainWindow, aiService);
}
