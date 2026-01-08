/**
 * Data Integrity Service
 * Provides utilities for checking and maintaining data consistency
 */

import databaseService from './database.js';
import recurrenceService from './recurrence.js';
import logger from '../logger.js';

class DataIntegrityService {
  /**
   * Check for orphaned tasks (tasks without valid project references)
   * @returns {Array} - Array of orphaned task records
   */
  async findOrphanedTasks() {
    try {
      const orphanedTasks = databaseService.query(`
        SELECT t.* 
        FROM tasks t 
        LEFT JOIN projects p ON t.project_id = p.id 
        WHERE p.id IS NULL
      `);

      if (orphanedTasks.length > 0) {
        logger.warn(`Found ${orphanedTasks.length} orphaned tasks`);
      }

      return orphanedTasks;
    } catch (error) {
      logger.error('Error finding orphaned tasks:', error);
      return [];
    }
  }

  /**
   * Check for orphaned notifications (notifications without valid task references)
   * @returns {Array} - Array of orphaned notification records
   */
  async findOrphanedNotifications() {
    try {
      const orphanedNotifications = databaseService.query(`
        SELECT n.* 
        FROM notifications n 
        LEFT JOIN tasks t ON n.task_id = t.id 
        WHERE t.id IS NULL
      `);

      if (orphanedNotifications.length > 0) {
        logger.warn(`Found ${orphanedNotifications.length} orphaned notifications`);
      }

      return orphanedNotifications;
    } catch (error) {
      logger.error('Error finding orphaned notifications:', error);
      return [];
    }
  }

  /**
   * Check for orphaned recurrence rules (rules without valid task references)
   * @returns {Array} - Array of orphaned recurrence rule records
   */
  async findOrphanedRecurrenceRules() {
    try {
      const orphanedRules = databaseService.query(`
        SELECT r.*
        FROM recurrence_rules r
        LEFT JOIN tasks t ON r.task_id = t.id
        WHERE t.id IS NULL
      `);

      if (orphanedRules.length > 0) {
        logger.warn(`Found ${orphanedRules.length} orphaned recurrence rules`);
      }

      return orphanedRules;
    } catch (error) {
      logger.error('Error finding orphaned recurrence rules:', error);
      return [];
    }
  }

  /**
   * Find expired recurrence rules that should be cleaned up
   * @returns {Array} - Array of expired recurrence rule records
   */
  async findExpiredRecurrenceRules() {
    try {
      const expiredRules = await recurrenceService.getExpiredRecurrenceRules();

      if (expiredRules.length > 0) {
        logger.warn(`Found ${expiredRules.length} expired recurrence rules`);
      }

      return expiredRules;
    } catch (error) {
      logger.error('Error finding expired recurrence rules:', error);
      return [];
    }
  }

  /**
   * Validate recurrence rule data integrity
   * @returns {Array} - Array of invalid recurrence rule records
   */
  async validateRecurrenceRules() {
    try {
      const allRules = databaseService.query('SELECT * FROM recurrence_rules');
      const invalidRules = [];

      for (const ruleData of allRules) {
        try {
          // Try to create a RecurrenceRule instance to validate the data
          const { RecurrenceRule } = await import('../../shared/models/RecurrenceRule.js');
          const rule = RecurrenceRule.fromDatabase(ruleData);

          if (!rule.validate()) {
            invalidRules.push({
              ...ruleData,
              validationError: 'Rule validation failed',
            });
          }
        } catch (error) {
          invalidRules.push({
            ...ruleData,
            validationError: error.message,
          });
        }
      }

      if (invalidRules.length > 0) {
        logger.warn(`Found ${invalidRules.length} invalid recurrence rules`);
      }

      return invalidRules;
    } catch (error) {
      logger.error('Error validating recurrence rules:', error);
      return [];
    }
  }

  /**
   * Find recurrence rules with inconsistent data
   * @returns {Array} - Array of inconsistent recurrence rule records
   */
  async findInconsistentRecurrenceRules() {
    try {
      const inconsistentRules = [];

      // Find rules with invalid intervals
      const invalidIntervalRules = databaseService.query(`
        SELECT * FROM recurrence_rules
        WHERE interval IS NULL OR interval <= 0 OR interval > 365
      `);

      // Find rules with invalid counts
      const invalidCountRules = databaseService.query(`
        SELECT * FROM recurrence_rules
        WHERE count IS NOT NULL AND count <= 0
      `);

      // Find rules with end dates in the past but still active
      const pastEndDateRules = databaseService.query(`
        SELECT * FROM recurrence_rules
        WHERE end_date IS NOT NULL AND end_date < date('now')
      `);

      inconsistentRules.push(
        ...invalidIntervalRules.map((rule) => ({ ...rule, issue: 'Invalid interval' })),
        ...invalidCountRules.map((rule) => ({ ...rule, issue: 'Invalid count' })),
        ...pastEndDateRules.map((rule) => ({ ...rule, issue: 'Past end date' }))
      );

      if (inconsistentRules.length > 0) {
        logger.warn(`Found ${inconsistentRules.length} inconsistent recurrence rules`);
      }

      return inconsistentRules;
    } catch (error) {
      logger.error('Error finding inconsistent recurrence rules:', error);
      return [];
    }
  }

  /**
   * Perform a comprehensive data integrity check
   * @returns {Object} - Integrity check results
   */
  async performIntegrityCheck() {
    try {
      logger.info('Starting comprehensive data integrity check...');

      const results = {
        orphanedTasks: await this.findOrphanedTasks(),
        orphanedNotifications: await this.findOrphanedNotifications(),
        orphanedRecurrenceRules: await this.findOrphanedRecurrenceRules(),
        expiredRecurrenceRules: await this.findExpiredRecurrenceRules(),
        invalidRecurrenceRules: await this.validateRecurrenceRules(),
        inconsistentRecurrenceRules: await this.findInconsistentRecurrenceRules(),
        timestamp: new Date().toISOString(),
      };

      const totalIssues =
        results.orphanedTasks.length +
        results.orphanedNotifications.length +
        results.orphanedRecurrenceRules.length +
        results.expiredRecurrenceRules.length +
        results.invalidRecurrenceRules.length +
        results.inconsistentRecurrenceRules.length;

      if (totalIssues === 0) {
        logger.info('✅ Data integrity check passed - no issues found');
      } else {
        logger.warn(`⚠️ Data integrity issues found: ${totalIssues} total issues`);
        logger.info(`  - Orphaned tasks: ${results.orphanedTasks.length}`);
        logger.info(`  - Orphaned notifications: ${results.orphanedNotifications.length}`);
        logger.info(`  - Orphaned recurrence rules: ${results.orphanedRecurrenceRules.length}`);
        logger.info(`  - Expired recurrence rules: ${results.expiredRecurrenceRules.length}`);
        logger.info(`  - Invalid recurrence rules: ${results.invalidRecurrenceRules.length}`);
        logger.info(
          `  - Inconsistent recurrence rules: ${results.inconsistentRecurrenceRules.length}`
        );
      }

      return results;
    } catch (error) {
      logger.error('Error during integrity check:', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Deletes orphaned notifications.
   * @param {Array} orphanedNotifications - Array of orphaned notification records.
   * @param {Object} results - Object to store cleanup results.
   * @private
   */
  _deleteOrphanedNotifications(orphanedNotifications, results) {
    for (const notification of orphanedNotifications) {
      try {
        const result = databaseService.delete('DELETE FROM notifications WHERE id = ?', [
          notification.id,
        ]);
        if (result && result.changes > 0) {
          results.deletedNotifications++;
        }
      } catch (error) {
        results.errors.push(`Failed to delete notification ${notification.id}: ${error.message}`);
      }
    }
  }

  /**
   * Deletes orphaned recurrence rules.
   * @param {Array} orphanedRecurrenceRules - Array of orphaned recurrence rule records.
   * @param {Object} results - Object to store cleanup results.
   * @private
   */
  _deleteOrphanedRecurrenceRules(orphanedRecurrenceRules, results) {
    for (const rule of orphanedRecurrenceRules) {
      try {
        const result = databaseService.delete('DELETE FROM recurrence_rules WHERE id = ?', [
          rule.id,
        ]);
        if (result && result.changes > 0) {
          results.deletedRecurrenceRules++;
        }
      } catch (error) {
        results.errors.push(`Failed to delete recurrence rule ${rule.id}: ${error.message}`);
      }
    }
  }

  /**
   * Deletes orphaned tasks.
   * @param {Array} orphanedTasks - Array of orphaned task records.
   * @param {Object} results - Object to store cleanup results.
   * @private
   */
  _deleteOrphanedTasks(orphanedTasks, results) {
    for (const task of orphanedTasks) {
      try {
        const result = databaseService.delete('DELETE FROM tasks WHERE id = ?', [task.id]);
        if (result && result.changes > 0) {
          results.deletedTasks++;
        }
      } catch (error) {
        results.errors.push(`Failed to delete task ${task.id}: ${error.message}`);
      }
    }
  }

  /**
   * Clean up expired recurrence rules
   * @param {Object} options - Cleanup options
   * @returns {Object} - Cleanup results
   */
  async cleanupExpiredRecurrenceRules(options = { dryRun: true }) {
    try {
      logger.info(`Starting expired recurrence rules cleanup (dry run: ${options.dryRun})...`);

      if (!options.dryRun) {
        const cleanedCount = await recurrenceService.cleanupExpiredRules();
        logger.info(`Cleaned up ${cleanedCount} expired recurrence rules`);
        return { deletedExpiredRules: cleanedCount, errors: [] };
      } else {
        const expiredRules = await this.findExpiredRecurrenceRules();
        logger.info(`Dry run: would delete ${expiredRules.length} expired recurrence rules`);
        return { deletedExpiredRules: 0, wouldDelete: expiredRules.length, errors: [] };
      }
    } catch (error) {
      logger.error('Error during expired recurrence rules cleanup:', error);
      return {
        error: error.message,
        deletedExpiredRules: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * Clean up orphaned data (use with caution!)
   * @param {Object} options - Cleanup options
   * @returns {Object} - Cleanup results
   */
  async cleanupOrphanedData(options = { dryRun: true }) {
    try {
      logger.info(`Starting orphaned data cleanup (dry run: ${options.dryRun})...`);

      const results = {
        deletedTasks: 0,
        deletedNotifications: 0,
        deletedRecurrenceRules: 0,
        deletedExpiredRules: 0,
        errors: [],
      };

      // Find orphaned data
      const orphanedTasks = await this.findOrphanedTasks();
      const orphanedNotifications = await this.findOrphanedNotifications();
      const orphanedRecurrenceRules = await this.findOrphanedRecurrenceRules();

      if (!options.dryRun) {
        // Delete orphaned notifications
        this._deleteOrphanedNotifications(orphanedNotifications, results);

        // Delete orphaned recurrence rules
        this._deleteOrphanedRecurrenceRules(orphanedRecurrenceRules, results);

        // Delete orphaned tasks
        this._deleteOrphanedTasks(orphanedTasks, results);

        // Clean up expired recurrence rules
        const expiredCleanup = await this.cleanupExpiredRecurrenceRules({ dryRun: false });
        results.deletedExpiredRules = expiredCleanup.deletedExpiredRules || 0;
        if (expiredCleanup.errors) {
          results.errors.push(...expiredCleanup.errors);
        }

        logger.info(
          `Cleanup completed: ${results.deletedTasks} tasks, ${results.deletedNotifications} notifications, ${results.deletedRecurrenceRules} orphaned rules, ${results.deletedExpiredRules} expired rules deleted`
        );
      } else {
        const expiredRules = await this.findExpiredRecurrenceRules();
        logger.info(
          `Dry run completed: would delete ${orphanedTasks.length} tasks, ${orphanedNotifications.length} notifications, ${orphanedRecurrenceRules.length} orphaned rules, ${expiredRules.length} expired rules`
        );
      }

      return results;
    } catch (error) {
      logger.error('Error during cleanup:', error);
      return {
        error: error.message,
        deletedTasks: 0,
        deletedNotifications: 0,
        deletedRecurrenceRules: 0,
        deletedExpiredRules: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * Get database statistics
   * @returns {Object} - Database statistics
   */
  async getDatabaseStats() {
    try {
      const stats = {
        projects: databaseService.queryOne('SELECT COUNT(*) as count FROM projects')?.count || 0,
        tasks: databaseService.queryOne('SELECT COUNT(*) as count FROM tasks')?.count || 0,
        notifications:
          databaseService.queryOne('SELECT COUNT(*) as count FROM notifications')?.count || 0,
        recurrenceRules:
          databaseService.queryOne('SELECT COUNT(*) as count FROM recurrence_rules')?.count || 0,
        timestamp: new Date().toISOString(),
      };

      logger.info(
        `Database stats: ${stats.projects} projects, ${stats.tasks} tasks, ${stats.notifications} notifications, ${stats.recurrenceRules} recurrence rules`
      );

      return stats;
    } catch (error) {
      logger.error('Error getting database stats:', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Create singleton instance
const dataIntegrityService = new DataIntegrityService();

export default dataIntegrityService;
