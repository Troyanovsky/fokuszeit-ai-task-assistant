/**
 * Database Service
 * Handles all database operations using better-sqlite3
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import * as initialMigration from '../../database/migrations/initial.js';
import * as notificationTrackingMigration from '../../database/migrations/002_add_notification_tracking.js';
import logger from '../../electron-main/logger.js';

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = '';
  }

  /**
   * Initialize the database connection
   * @returns {boolean} - Success status
   */
  async init() {
    try {
      // Determine the database file path
      this.dbPath = path.join(
        app ? app.getPath('userData') : process.cwd(),
        'ai-task-assistant.db'
      );

      // Create directory if it doesn't exist
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Connect to the database
      this.db = new Database(this.dbPath, {
        verbose: (message) => logger.debug(`SQLite: ${message}`),
        fileMustExist: false,
      });

      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');

      // Run migrations
      await this.runMigrations();

      logger.info('Database initialized successfully');
      return true;
    } catch (error) {
      logger.logError(error, 'Error initializing database');
      return false;
    }
  }

  /**
   * Run database migrations
   * @returns {boolean} - Success status
   */
  async runMigrations() {
    try {
      // Create migrations tracking table if it doesn't exist
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version TEXT PRIMARY KEY,
          applied_at TEXT NOT NULL
        );
      `);

      // Helper function to run migration if not already applied
      const runMigration = async (version, migrationFn) => {
        const applied = this.queryOne('SELECT version FROM schema_migrations WHERE version = ?', [version]);

        if (!applied) {
          logger.info(`Running migration: ${version}`);
          const success = await migrationFn(this.db);
          if (success) {
            this.insert(
              'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
              [version, new Date().toISOString()]
            );
            logger.info(`Migration ${version} completed successfully`);
          } else {
            throw new Error(`Migration ${version} failed`);
          }
        } else {
          logger.info(`Migration ${version} already applied, skipping`);
        }
      };

      // Run migrations in order
      await runMigration('001_initial', async (db) => initialMigration.up(db));
      await runMigration('002_add_notification_tracking', async (db) => notificationTrackingMigration.up(db));

      return true;
    } catch (error) {
      logger.logError(error, 'Error running migrations');
      return false;
    }
  }

  /**
   * Close the database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('Database connection closed');
    }
  }

  /**
   * Execute a SQL query with parameters
   * @param {string} sql - SQL query
   * @param {Object} params - Query parameters
   * @returns {Array|Object} - Query results
   */
  query(sql, params = {}) {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(params);
    } catch (error) {
      logger.logError(error, 'Error executing query');
      throw error;
    }
  }

  /**
   * Execute a SQL query and return the first result
   * @param {string} sql - SQL query
   * @param {Object} params - Query parameters
   * @returns {Object|null} - First result or null
   */
  queryOne(sql, params = {}) {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(params);
    } catch (error) {
      logger.logError(error, 'Error executing query');
      throw error;
    }
  }

  /**
   * Execute an insert query
   * @param {string} sql - SQL query
   * @param {Object} params - Query parameters
   * @returns {Object} - Result with lastInsertRowid
   */
  insert(sql, params = {}) {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(params);
      return result;
    } catch (error) {
      logger.logError(error, 'Error executing insert');
      throw error;
    }
  }

  /**
   * Execute an update query
   * @param {string} sql - SQL query
   * @param {Object} params - Query parameters
   * @returns {Object} - Result with changes count
   */
  update(sql, params = {}) {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(params);
      return result;
    } catch (error) {
      logger.logError(error, 'Error executing update');
      throw error;
    }
  }

  /**
   * Execute a delete query
   * @param {string} sql - SQL query
   * @param {Object} params - Query parameters
   * @returns {Object} - Result with changes count
   */
  delete(sql, params = {}) {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(params);
      return result;
    } catch (error) {
      logger.logError(error, 'Error executing delete');
      throw error;
    }
  }

  /**
   * Begin a transaction
   * @returns {Object} - Transaction object
   */
  beginTransaction() {
    return this.db.transaction(() => {});
  }
}

// Create singleton instance
const databaseService = new DatabaseService();

export default databaseService;
