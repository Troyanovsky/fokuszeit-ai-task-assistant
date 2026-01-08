// Main process logger

import log from 'electron-log';
import { app } from 'electron';
import path from 'path';

// Configure electron-log for main process
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
log.transports.console.format = '[{level}] {text}';

// In test environments, disable file transport to avoid errors
if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
  log.transports.file.level = false;
}

// For normal environments, set app name to ensure logs are stored in the correct directory
if (!process.env.VITEST) {
  try {
    // In electron-log v5.x, we use resolvePathFn instead of getDefaultPath
    log.transports.file.resolvePathFn = () => {
      const appName = app?.getName() || 'FokusZeit';
      const userDataPath = app.getPath('userData');
      return path.join(userDataPath, 'logs', appName, 'main.log');
    };
  } catch (error) {
    // If we're in a testing environment where app might not be available
    // This is a fallback that should not normally be used
    log.warn('Could not set up electron-log file path with app name', error);
  }
}

// Define a wrapper with standard log levels
const logger = {
  error: (message, ...args) => log.error(message, ...args),
  warn: (message, ...args) => log.warn(message, ...args),
  info: (message, ...args) => log.info(message, ...args),
  verbose: (message, ...args) => log.verbose(message, ...args),
  debug: (message, ...args) => log.debug(message, ...args),
  silly: (message, ...args) => log.silly(message, ...args),
  
  // Helper for logging errors with stack traces
  logError: (error, context = '') => {
    if (error instanceof Error) {
      log.error(`${context}: ${error.message}`, error.stack);
    } else {
      log.error(`${context}: ${error}`);
    }
  }
};

globalThis.electronLogger = logger;

export default logger; 
