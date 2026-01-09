/**
 * Project Service
 * Handles project-related operations
 */

import databaseService from './database.js';
import Project from '../../shared/models/Project.js';
import logger from '../logger.js';
import { parseSqliteError, createValidationError, createNotFoundError } from '../../shared/utils/sqliteErrorHandler.js';

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
      const errorInfo = parseSqliteError(error, 'Get all projects');
      logger.logError(error, errorInfo.developerMessage);
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
      const errorInfo = parseSqliteError(error, 'Get project by ID', { projectId: id });
      logger.logError(error, errorInfo.developerMessage);
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
        const errorInfo = createValidationError(
          'Add project',
          `Invalid project data: project name "${project.name}" is invalid`
        );
        logger.error(errorInfo.developerMessage);
        return false;
      }

      const data = project.toDatabase();
      const result = databaseService.insert(
        'INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [data.id, data.name, data.description, data.created_at, data.updated_at]
      );

      return result && result.changes > 0;
    } catch (error) {
      const errorInfo = parseSqliteError(error, 'Add project', {
        projectId: project.id,
        projectName: project.name
      });
      logger.logError(error, errorInfo.developerMessage);

      // Special handling for constraint violations
      if (error.code === 'SQLITE_CONSTRAINT' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        logger.warn(`Project with ID ${project.id} or name "${project.name}" already exists`);
      }

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
        const errorInfo = createValidationError(
          'Update project',
          `Invalid project data: project name "${project.name}" is invalid`
        );
        logger.error(errorInfo.developerMessage);
        return false;
      }

      const data = project.toDatabase();
      const result = databaseService.update(
        'UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?',
        [data.name, data.description, data.updated_at, data.id]
      );

      if (!result || result.changes === 0) {
        logger.warn(`Project ${project.id} not found for update or no changes made`);
      }

      return result && result.changes > 0;
    } catch (error) {
      const errorInfo = parseSqliteError(error, 'Update project', {
        projectId: project.id,
        projectName: project.name
      });
      logger.logError(error, errorInfo.developerMessage);
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
        const errorInfo = createNotFoundError('Validate project deletion', 'Project', id);
        logger.warn(errorInfo.developerMessage);
        return {
          canDelete: false,
          reason: errorInfo.userMessage,
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
      const errorInfo = parseSqliteError(error, 'Validate project deletion', { projectId: id });
      logger.logError(error, errorInfo.developerMessage);
      return {
        canDelete: false,
        reason: 'Error during validation',
        details: null,
      };
    }
  }

  /**
   * Validate project deletion and log what will be deleted.
   * @private
   * @param {string} id - Project ID
   * @returns {Promise<Object>} - Validation result with canDelete flag and details
   */
  async _validateAndLogProjectDeletion(id) {
    const validation = await this.validateProjectDeletion(id);
    if (!validation.canDelete) {
      logger.warn(`Cannot delete project ${id}: ${validation.reason}`);
      return validation;
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

    return validation;
  }

  /**
   * Ensure a project exists before deletion.
   * @private
   * @param {string} id - Project ID
   * @returns {Promise<Project|null>} - Project instance or null if not found
   */
  async _ensureProjectExists(id) {
    const project = await this.getProjectById(id);
    if (!project) {
      const errorInfo = createNotFoundError('Delete project', 'Project', id);
      logger.error(errorInfo.developerMessage);
      return null;
    }
    return project;
  }


  /**
   * Delete a project and all its associated data
   * CASCADE will automatically delete all tasks, notifications, and recurrence rules
   * @param {string} id - Project ID
   * @param {boolean} force - Force deletion without validation (default: false)
   * @returns {boolean} - Success status
   */
  async deleteProject(id, force = false) {
    try {
      // Validate and log (unless forced)
      if (!force) {
        const validation = await this._validateAndLogProjectDeletion(id);
        if (!validation.canDelete) {
          return false;
        }
      }

      // Ensure project exists
      const project = await this._ensureProjectExists(id);
      if (!project) {
        return false;
      }

      // Delete project - CASCADE handles all tasks, notifications, and recurrence rules
      const result = databaseService.delete('DELETE FROM projects WHERE id = ?', [id]);

      if (result && result.changes > 0) {
        logger.info(`Successfully deleted project ${id}`);
        return true;
      } else {
        logger.error(`Failed to delete project ${id} from database`);
        return false;
      }
    } catch (error) {
      const errorInfo = parseSqliteError(error, 'Delete project', { projectId: id });
      logger.logError(error, errorInfo.developerMessage);
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
      const errorInfo = parseSqliteError(error, 'Get project count');
      logger.logError(error, errorInfo.developerMessage);
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
      const errorInfo = parseSqliteError(error, 'Search projects', { searchQuery: query });
      logger.logError(error, errorInfo.developerMessage);
      return [];
    }
  }
}

// Create singleton instance
const projectManager = new ProjectManager();

export default projectManager;
