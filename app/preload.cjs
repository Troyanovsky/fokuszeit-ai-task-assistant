/**
 * Electron preload bridge.
 *
 * Exposes a minimal, whitelisted IPC API to the renderer via `contextBridge`,
 * keeping IPC access explicit and constrained under context isolation.
 */
const { contextBridge, ipcRenderer } = require('electron');

let electronLog;
try {
  electronLog = require('electron-log');
  
  // Configure renderer process logger
  electronLog.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
  electronLog.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
  electronLog.transports.console.format = '[{level}] {text}';
} catch (error) {
  // Create fallback logger if electron-log is not available
  electronLog = {
    error: (...args) => console.error(...args),
    warn: (...args) => console.warn(...args),
    info: (...args) => console.info(...args),
    verbose: (...args) => console.debug(...args),
    debug: (...args) => console.debug(...args),
    silly: (...args) => console.debug(...args),
    transports: { file: {}, console: {} }
  };
  electronLog.warn('electron-log not available, using console fallback', error);
}

const VALID_IPC_CHANNELS = [
  'projects:refresh',
  'tasks:refresh',
  'ai:chatHistoryUpdate',
  'notification:received',
  'notifications:changed',
  'notifications:refresh',
  'preferences:refresh',
  'recurrence:changed',
  'task:recurring-created'
];

// Expose logger to renderer process
contextBridge.exposeInMainWorld(
  'logger', {
    error: (message, ...args) => electronLog.error(message, ...args),
    warn: (message, ...args) => electronLog.warn(message, ...args),
    info: (message, ...args) => electronLog.info(message, ...args),
    verbose: (message, ...args) => electronLog.verbose(message, ...args),
    debug: (message, ...args) => electronLog.debug(message, ...args),
    silly: (message, ...args) => electronLog.silly(message, ...args),
    
    // Helper for logging errors with stack traces
    logError: (error, context = '') => {
      if (error instanceof Error) {
        electronLog.error(`${context}: ${error.message}`, error.stack);
      } else {
        electronLog.error(`${context}: ${error}`);
      }
    }
  }
);

// Expose project-related methods
contextBridge.exposeInMainWorld(
  'electron', {
    getProjects: () => ipcRenderer.invoke('projects:getAll'),
    addProject: (project) => ipcRenderer.invoke('projects:add', project),
    updateProject: (project) => ipcRenderer.invoke('projects:update', project),
    deleteProject: (projectId) => ipcRenderer.invoke('projects:delete', projectId),
    
    getTasks: () => ipcRenderer.invoke('tasks:getAll'),
    getRecentTasks: () => ipcRenderer.invoke('tasks:getRecent'),
    getTasksByProject: (projectId) => ipcRenderer.invoke('tasks:getByProject', projectId),
    getRecentTasksByProject: (projectId) => ipcRenderer.invoke('tasks:getRecentByProject', projectId),
    addTask: (task) => ipcRenderer.invoke('tasks:add', task),
    updateTask: (task) => ipcRenderer.invoke('tasks:update', task),
    deleteTask: (taskId) => ipcRenderer.invoke('tasks:delete', taskId),
    updateTaskStatus: (taskId, status) => ipcRenderer.invoke('tasks:updateStatus', taskId, status),
    planMyDay: () => ipcRenderer.invoke('tasks:planMyDay'),
    rescheduleOverdueTasksToToday: () => ipcRenderer.invoke('tasks:rescheduleOverdue'),
    
    getNotificationsByTask: (taskId) => ipcRenderer.invoke('notifications:getByTask', taskId),
    addNotification: (notification) => ipcRenderer.invoke('notifications:add', notification),
    updateNotification: (notification) => ipcRenderer.invoke('notifications:update', notification),
    deleteNotification: (notificationId) => ipcRenderer.invoke('notifications:delete', notificationId),

    getRecurrenceRuleByTask: (taskId) => ipcRenderer.invoke('recurrence:getByTask', taskId),
    getRecurrenceRuleById: (ruleId) => ipcRenderer.invoke('recurrence:getById', ruleId),
    addRecurrenceRule: (ruleData) => ipcRenderer.invoke('recurrence:add', ruleData),
    updateRecurrenceRule: (ruleId, updateData) => ipcRenderer.invoke('recurrence:update', ruleId, updateData),
    deleteRecurrenceRule: (ruleId) => ipcRenderer.invoke('recurrence:delete', ruleId),
    deleteRecurrenceRuleByTask: (taskId) => ipcRenderer.invoke('recurrence:deleteByTask', taskId),
    
    getPreferences: () => ipcRenderer.invoke('preferences:get'),
    updateWorkingHours: (workingHours) => ipcRenderer.invoke('preferences:updateWorkingHours', workingHours),
    updateBufferTime: (bufferTime) => ipcRenderer.invoke('preferences:updateBufferTime', bufferTime),
    
    configureAI: (config) => ipcRenderer.invoke('ai:configure', config),
    sendMessage: (message) => ipcRenderer.invoke('ai:sendMessage', message),
    getChatHistory: () => ipcRenderer.invoke('ai:getChatHistory'),
    clearChatHistory: () => ipcRenderer.invoke('ai:clearHistory'),
    
    // Event handling
    receive: (channel, func) => {
      if (VALID_IPC_CHANNELS.includes(channel)) {
        // Create a wrapper function that we can reference for removal
        const wrappedFunc = (event, ...args) => func(...args);
        ipcRenderer.on(channel, wrappedFunc);
        // Return the wrapped function so it can be used for removal
        return wrappedFunc;
      }
    },
    removeListener: (channel, func) => {
      if (VALID_IPC_CHANNELS.includes(channel) && func) {
        ipcRenderer.removeListener(channel, func);
      }
    },
    removeAllListeners: (channel) => {
      if (VALID_IPC_CHANNELS.includes(channel)) {
        ipcRenderer.removeAllListeners(channel);
      }
    }
  }
);
