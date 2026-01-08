/**
 * Database Migration: Add Notification Delivery Tracking
 *
 * Purpose: Add sent_at column to track when notifications were delivered.
 * This enables idempotent notification sending and prevents duplicates
 * after app restarts or system events (clock changes, sleep/wake).
 */

import logger from '../../electron-main/logger.js';

/**
 * Run the migration to add notification tracking
 * @param {Object} db - better-sqlite3 database instance
 * @returns {Promise<boolean>} - Success status
 */
async function up(db) {
  try {
    // Check if sent_at column already exists
    const columns = db.pragma('table_info(notifications)');
    const hasSentAtColumn = columns.some((col) => col.name === 'sent_at');

    if (!hasSentAtColumn) {
      db.exec('ALTER TABLE notifications ADD COLUMN sent_at TEXT;');
      logger.info('Added sent_at column to notifications table');
    } else {
      logger.info('sent_at column already exists, skipping migration');
    }

    // Index creation is already idempotent with IF NOT EXISTS
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_notifications_sent
      ON notifications(sent_at);
    `);

    logger.info('Notification tracking migration completed successfully');
    return true;
  } catch (error) {
    logger.logError(error, 'Error during notification tracking migration');
    return false;
  }
}

export { up };
