// Wrapper for the renderer process logger
// Uses the electron-log instance exposed via preload

const logger = {
  error: (message, ...args) => {
    try {
      if (typeof window !== 'undefined' && window.logger) {
        return window.logger.error(message, ...args);
      }
    } catch {
      // Fallback to console during initialization or when logger is not available
    }
    return console.error(message, ...args);
  },
  warn: (message, ...args) => {
    try {
      if (typeof window !== 'undefined' && window.logger) {
        return window.logger.warn(message, ...args);
      }
    } catch {
      // Fallback to console during initialization or when logger is not available
    }
    return console.warn(message, ...args);
  },
  info: (message, ...args) => {
    try {
      if (typeof window !== 'undefined' && window.logger) {
        return window.logger.info(message, ...args);
      }
    } catch {
      // Fallback to console during initialization or when logger is not available
    }
    return console.info(message, ...args);
  },
  verbose: (message, ...args) => {
    try {
      if (typeof window !== 'undefined' && window.logger) {
        return window.logger.verbose(message, ...args);
      }
    } catch {
      // Fallback to console during initialization or when logger is not available
    }
    return console.debug(message, ...args);
  },
  debug: (message, ...args) => {
    try {
      if (typeof window !== 'undefined' && window.logger) {
        return window.logger.debug(message, ...args);
      }
    } catch {
      // Fallback to console during initialization or when logger is not available
    }
    return console.debug(message, ...args);
  },
  silly: (message, ...args) => {
    try {
      if (typeof window !== 'undefined' && window.logger) {
        return window.logger.silly(message, ...args);
      }
    } catch {
      // Fallback to console during initialization or when logger is not available
    }
    return console.debug(message, ...args);
  },

  // Helper for logging errors with stack traces
  logError: (error, context = '') => {
    try {
      if (typeof window !== 'undefined' && window.logger) {
        return window.logger.logError(error, context);
      }
    } catch {
      // Fallback to console during initialization or when logger is not available
    }

    if (error instanceof Error) {
      console.error(`${context}: ${error.message}`, error.stack);
    } else {
      console.error(`${context}: ${error}`);
    }
  },
};

export default logger;
