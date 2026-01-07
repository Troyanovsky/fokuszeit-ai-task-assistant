/**
 * SQLite Error Handler Utility
 * Maps SQLite error codes to user-friendly messages and provides structured error information
 */

/**
 * Mapping of SQLite error codes to user-friendly messages
 * Based on better-sqlite3 error codes
 */
const SQLITE_ERROR_MESSAGES = {
  SQLITE_CONSTRAINT: 'A database constraint was violated',
  SQLITE_CONSTRAINT_NOTNULL: 'Required field is missing',
  SQLITE_CONSTRAINT_UNIQUE: 'Duplicate entry - this project already exists',
  SQLITE_CONSTRAINT_FOREIGNKEY: 'Referenced item does not exist',
  SQLITE_BUSY: 'Database is busy, please try again',
  SQLITE_CORRUPT: 'Database file is corrupted',
  SQLITE_CANTOPEN: 'Cannot open database file',
  SQLITE_READONLY: 'Database file is read-only',
  SQLITE_IOERR: 'Disk I/O error occurred',
  SQLITE_FULL: 'Database is full',
  SQLITE_TOOBIG: 'Data too large for database field',
  SQLITE_ERROR: 'A database error occurred',
};

/**
 * Parse SQLite error and return structured information
 * @param {Error} error - SQLite error object
 * @param {string} operation - Operation being performed (e.g., 'Get project by ID')
 * @param {Object} context - Additional context (id, name, etc.)
 * @returns {Object} - Structured error information
 */
export function parseSqliteError(error, operation, context = {}) {
  const errorCode = error.code || 'UNKNOWN';
  const userMessage = SQLITE_ERROR_MESSAGES[errorCode] || 'Unknown database error';

  return {
    type: 'database_error',
    code: errorCode,
    userMessage: `${operation} failed: ${userMessage}`,
    developerMessage: `${operation} failed for ${JSON.stringify(context)}: ${error.message}`,
    context,
    originalError: error,
  };
}

/**
 * Create a validation error object
 * @param {string} operation - Operation being performed
 * @param {string} userMessage - User-friendly error message
 * @param {Object} context - Additional context
 * @returns {Object} - Structured validation error information
 */
export function createValidationError(operation, userMessage, context = {}) {
  return {
    type: 'validation_error',
    code: 'VALIDATION_ERROR',
    userMessage,
    developerMessage: `${operation} failed: ${userMessage}`,
    context,
  };
}

/**
 * Create a "not found" error object
 * @param {string} operation - Operation being performed
 * @param {string} itemType - Type of item not found (e.g., 'Project')
 * @param {string} itemId - ID of the item
 * @returns {Object} - Structured not-found error information
 */
export function createNotFoundError(operation, itemType, itemId) {
  const userMessage = `${itemType} not found`;
  return {
    type: 'not_found_error',
    code: 'NOT_FOUND',
    userMessage,
    developerMessage: `${operation} failed: ${itemType} ${itemId} not found`,
    context: { itemType, itemId },
  };
}
