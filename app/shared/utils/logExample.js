import logger from '../logger.js';

/**
 * This file demonstrates how to use the centralized logger
 * throughout the application.
 */

// Different logging levels
function demonstrateLoggingLevels() {
  logger.error('This is an error message');
  logger.warn('This is a warning message');
  logger.info('This is an info message');
  logger.debug('This is a debug message');
  logger.verbose('This is a verbose message');
  logger.silly('This is a silly message');
}

// Logging with additional data
function demonstrateLoggingWithData() {
  const userData = { id: 1, name: 'John Doe', email: 'john@example.com' };
  logger.info('User logged in', userData);
}

// Logging errors with stack traces
function demonstrateErrorLogging() {
  try {
    // Simulate an error
    throw new Error('Something went wrong');
  } catch (error) {
    // Log the error with context
    logger.logError(error, 'Error during operation');
  }
}

export { demonstrateLoggingLevels, demonstrateLoggingWithData, demonstrateErrorLogging };
