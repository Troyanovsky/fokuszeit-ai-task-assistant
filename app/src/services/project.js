/**
 * Project Service
 * Handles project-related operations
 */

import databaseService from './database.js';
import Project from '../models/Project.js';

// Determine which logger to use based on the environment
let logger;
try {
  // Check if we're in the main process (Node.js environment)
  if (typeof window === 'undefined') {
    // We're in the main process
    logger = require('../../electron-main/logger.js').default;
  } else {
    // We're in the renderer process
    logger = require('./logger.js').default;
  }
} catch {
  // Fallback console logger
  logger = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
    verbose: console.debug,
    silly: console.debug,
    logError: (error, context = '') => {
      if (error instanceof Error) {
        console.error(`${context}: ${error.message}`, error.stack);
      } else {
        console.error(`${context}: ${error}`);
      }
    },
  };
}

class ProjectManager {
  /**
   * Get all projects
   * @returns {Array} - Array of Project instances
   */
  async getProjects() {
    try {
      const projects = databaseService.query('SELECT * FROM projects ORDER BY created_at DESC');
      return projects.map((project) => Project.fromDatabase(project));
    } catch (error) {
      logger.error('Error getting projects:', error);
      return [];
    }
  }

  /**
   * Get a project by ID
   * @param {string} id - Project ID
   * @returns {Project|null} - Project instance or null
   */
  async getProjectById(id) {
    try {
      const project = databaseService.queryOne('SELECT * FROM projects WHERE id = ?', [id]);
      return project ? Project.fromDatabase(project) : null;
    } catch (error) {
      logger.error(`Error getting project ${id}:`, error);
      return null;
    }
  }

  /**
   * Add a new project
   * @param {Project} project - Project instance
   * @returns {boolean} - Success status
   */
  async addProject(project) {
    try {
      if (!project.validate()) {
        logger.error('Invalid project data', project.name);
        return false;
      }

      const data = project.toDatabase();
      const result = databaseService.insert(
        'INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [data.id, data.name, data.description, data.created_at, data.updated_at]
      );

      return result && result.changes > 0;
    } catch (error) {
      logger.error('Error adding project:', error);
      return false;
    }
  }

  /**
   * Update an existing project
   * @param {Project} project - Project instance
   * @returns {boolean} - Success status
   */
  async updateProject(project) {
    try {
      if (!project.validate()) {
        logger.error('Invalid project data');
        return false;
      }

      const data = project.toDatabase();
      const result = databaseService.update(
        'UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?',
        [data.name, data.description, data.updated_at, data.id]
      );

      return result && result.changes > 0;
    } catch (error) {
      logger.error(`Error updating project ${project.id}:`, error);
      return false;
    }
  }

  /**
   * Check if a project can be safely deleted
   * @param {string} id - Project ID
   * @returns {Object} - Validation result with canDelete flag and details
   */
  async validateProjectDeletion(id) {
    try {
      const project = await this.getProjectById(id);
      if (!project) {
        return {
          canDelete: false,
          reason: 'Project not found',
          details: null,
        };
      }

      // Get all tasks belonging to this project
      const taskManager = (await import('./task.js')).default;
      const projectTasks = await taskManager.getTasksByProject(id);

      // Count tasks by status
      const taskCounts = {
        total: projectTasks.length,
        planning: projectTasks.filter((t) => t.status === 'planning').length,
        doing: projectTasks.filter((t) => t.status === 'doing').length,
        done: projectTasks.filter((t) => t.status === 'done').length,
      };

      return {
        canDelete: true,
        reason: null,
        details: {
          projectName: project.name,
          taskCounts,
          tasks: projectTasks.map((t) => ({ id: t.id, name: t.name, status: t.status })),
        },
      };
    } catch (error) {
      logger.error(`Error validating project deletion for ${id}:`, error);
      return {
        canDelete: false,
        reason: 'Error during validation',
        details: null,
      };
    }
  }

  /**
   * Delete a project and all its associated data
   * @param {string} id - Project ID
   * @param {boolean} force - Force deletion without validation (default: false)
   * @returns {boolean} - Success status
   */
  async deleteProject(id, force = false) {
    try {
      // Validate deletion unless forced
      if (!force) {
        const validation = await this.validateProjectDeletion(id);
        if (!validation.canDelete) {
          logger.error(`Cannot delete project ${id}: ${validation.reason}`);
          return false;
        }

        // Log what will be deleted
        if (validation.details && validation.details.taskCounts.total > 0) {
          logger.info(
            `Preparing to delete project "${validation.details.projectName}" with ${validation.details.taskCounts.total} tasks:`
          );
          logger.info(`- Planning: ${validation.details.taskCounts.planning}`);
          logger.info(`- Doing: ${validation.details.taskCounts.doing}`);
          logger.info(`- Done: ${validation.details.taskCounts.done}`);
        }
      }

      // Get project and tasks for deletion
      const project = await this.getProjectById(id);
      if (!project) {
        logger.error(`Project ${id} not found for deletion`);
        return false;
      }

      const taskManager = (await import('./task.js')).default;
      const projectTasks = await taskManager.getTasksByProject(id);

      logger.info(`Found ${projectTasks.length} tasks to delete for project ${id}`);

      // Delete all tasks and their associated data
      // This will handle notifications, recurrence rules, and other task-related cleanup
      let deletedTasksCount = 0;
      for (const task of projectTasks) {
        try {
          const taskDeleted = await taskManager.deleteTask(task.id);
          if (taskDeleted) {
            deletedTasksCount++;
          } else {
            logger.warn(`Failed to delete task ${task.id} for project ${id}`);
          }
        } catch (taskError) {
          logger.error(`Error deleting task ${task.id} for project ${id}:`, taskError);
          // Continue with other tasks even if one fails
        }
      }

      // Now delete the project itself
      const result = databaseService.delete('DELETE FROM projects WHERE id = ?', [id]);

      if (result && result.changes > 0) {
        logger.info(
          `Successfully deleted project ${id} and ${deletedTasksCount}/${projectTasks.length} associated tasks`
        );
        return true;
      } else {
        logger.error(`Failed to delete project ${id} from database`);
        return false;
      }
    } catch (error) {
      logger.error(`Error deleting project ${id}:`, error);
      return false;
    }
  }

  /**
   * Get project count
   * @returns {number} - Number of projects
   */
  async getProjectCount() {
    try {
      const result = databaseService.queryOne('SELECT COUNT(*) as count FROM projects');
      return result ? result.count : 0;
    } catch (error) {
      logger.error('Error getting project count:', error);
      return 0;
    }
  }

  /**
   * Search projects by name
   * @param {string} query - Search query
   * @returns {Array} - Array of Project instances
   */
  async searchProjects(query) {
    try {
      const projects = databaseService.query(
        'SELECT * FROM projects WHERE name LIKE ? ORDER BY created_at DESC',
        [`%${query}%`]
      );
      return projects.map((project) => Project.fromDatabase(project));
    } catch (error) {
      logger.error('Error searching projects:', error);
      return [];
    }
  }
}

// Create singleton instance
const projectManager = new ProjectManager();

export default projectManager;
