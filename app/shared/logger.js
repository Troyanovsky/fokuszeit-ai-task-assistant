/**
 * Shared logger adapter for code used in both main and renderer processes.
 *
 * Responsibility:
 * - Route log calls to the renderer logger when available
 * - Route log calls to the main-process logger when available
 * - Avoid direct imports of process-specific logger modules
 */

function resolveLogger() {
  if (typeof window !== 'undefined' && window.logger) {
    return window.logger;
  }

  if (globalThis?.electronLogger) {
    return globalThis.electronLogger;
  }

  return null;
}

function safeLog(method, ...args) {
  const logger = resolveLogger();
  if (logger && typeof logger[method] === 'function') {
    return logger[method](...args);
  }
  return undefined;
}

const logger = {
  error: (...args) => safeLog('error', ...args),
  warn: (...args) => safeLog('warn', ...args),
  info: (...args) => safeLog('info', ...args),
  verbose: (...args) => safeLog('verbose', ...args),
  debug: (...args) => safeLog('debug', ...args),
  silly: (...args) => safeLog('silly', ...args),
  logError: (error, context = '') => safeLog('logError', error, context),
};

export default logger;
